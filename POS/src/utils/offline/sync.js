import { db, getSetting, setSetting } from './db'

// Server connectivity state
if (typeof window !== 'undefined') {
	window.posNextServerOnline = true // Default to online
	window.posNextManualOffline = false // Default to auto mode
}

// Ping server to check connectivity
export const pingServer = async () => {
	if (typeof window === 'undefined') return true

	try {
		// Quick ping to check if server is reachable
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

		const response = await fetch('/api/method/pos_next.api.ping', {
			method: 'GET',
			signal: controller.signal,
		})

		clearTimeout(timeoutId)
		const isOnline = response.ok
		window.posNextServerOnline = isOnline
		return isOnline
	} catch (error) {
		// Server unreachable
		window.posNextServerOnline = false
		return false
	}
}

// Check if offline
export const isOffline = () => {
	if (typeof window === 'undefined') return false

	// Check manual offline mode
	const manualOffline = window.posNextManualOffline || false
	if (manualOffline) return true

	// Check browser online status
	const browserOnline = navigator.onLine

	// Check server connectivity (can be set by ping mechanism)
	const serverOnline = window.posNextServerOnline !== false

	return !browserOnline || !serverOnline
}

// Start periodic server ping
if (typeof window !== 'undefined') {
	// Ping server every 30 seconds
	setInterval(() => {
		if (navigator.onLine) {
			pingServer()
		}
	}, 30000)

	// Initial ping
	pingServer()
}

// Save invoice to offline queue
export const saveOfflineInvoice = async (invoiceData) => {
	try {
		// Validate invoice has items
		if (!invoiceData.items || invoiceData.items.length === 0) {
			throw new Error('Cannot save empty invoice')
		}

		// Clean data (remove reactive properties)
		const cleanData = JSON.parse(JSON.stringify(invoiceData))

		// Add to queue
		await db.invoice_queue.add({
			data: cleanData,
			timestamp: Date.now(),
			synced: false,
			retry_count: 0,
		})

		// Update local stock
		await updateLocalStock(cleanData.items)

		console.log('Invoice saved to offline queue')
		return true
	} catch (error) {
		console.error('Error saving offline invoice:', error)
		throw error
	}
}

// Get pending offline invoices
export const getOfflineInvoices = async () => {
	try {
		// Use filter instead of where/equals for boolean values
		const invoices = await db.invoice_queue
			.filter(invoice => invoice.synced === false)
			.toArray()
		return invoices
	} catch (error) {
		console.error('Error getting offline invoices:', error)
		return []
	}
}

// Get offline invoice count
export const getOfflineInvoiceCount = async () => {
	try {
		// Use filter instead of where/equals for boolean values
		const count = await db.invoice_queue
			.filter(invoice => invoice.synced === false)
			.count()
		return count
	} catch (error) {
		console.error('Error getting offline invoice count:', error)
		return 0
	}
}

// Sync offline invoices to server
export const syncOfflineInvoices = async () => {
	if (isOffline()) {
		console.log('Cannot sync while offline')
		return { success: 0, failed: 0 }
	}

	const pendingInvoices = await getOfflineInvoices()
	if (pendingInvoices.length === 0) {
		return { success: 0, failed: 0 }
	}

	let successCount = 0
	let failedCount = 0

	for (const invoice of pendingInvoices) {
		try {
			// Submit invoice to server
			const response = await window.frappe.call({
				method: 'pos_next.api.invoices.submit_invoice',
				args: {
					invoice_data: invoice.data
				}
			})

			if (response.message) {
				// Mark as synced
				await db.invoice_queue.update(invoice.id, { synced: true })
				successCount++
				console.log(`Invoice ${invoice.id} synced successfully`)
			}
		} catch (error) {
			console.error(`Error syncing invoice ${invoice.id}:`, error)

			// Increment retry count
			await db.invoice_queue.update(invoice.id, {
				retry_count: (invoice.retry_count || 0) + 1
			})

			failedCount++

			// If retry count exceeds threshold, mark as failed
			if ((invoice.retry_count || 0) >= 3) {
				await db.invoice_queue.update(invoice.id, {
					sync_failed: true,
					error: error.message
				})
			}
		}
	}

	// Clean up synced invoices older than 7 days
	const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
	await db.invoice_queue
		.filter(item => item.synced === true && item.timestamp < weekAgo)
		.delete()

	return { success: successCount, failed: failedCount }
}

// Delete offline invoice
export const deleteOfflineInvoice = async (id) => {
	try {
		await db.invoice_queue.delete(id)
		return true
	} catch (error) {
		console.error('Error deleting offline invoice:', error)
		return false
	}
}

// Update local stock after invoice
export const updateLocalStock = async (items) => {
	try {
		for (const item of items) {
			const stockKey = `${item.item_code}_${item.warehouse}`
			const currentStock = await db.stock.get({
				item_code: item.item_code,
				warehouse: item.warehouse
			})

			const qty = item.quantity || item.qty || 0
			const newQty = (currentStock?.qty || 0) - qty

			await db.stock.put({
				item_code: item.item_code,
				warehouse: item.warehouse,
				qty: newQty,
				updated_at: Date.now()
			})
		}
	} catch (error) {
		console.error('Error updating local stock:', error)
	}
}

// Get local stock
export const getLocalStock = async (itemCode, warehouse) => {
	try {
		const stock = await db.stock.get({
			item_code: itemCode,
			warehouse: warehouse
		})
		return stock?.qty || 0
	} catch (error) {
		console.error('Error getting local stock:', error)
		return 0
	}
}

// Save offline payment
export const saveOfflinePayment = async (paymentData) => {
	try {
		const cleanData = JSON.parse(JSON.stringify(paymentData))

		await db.payment_queue.add({
			data: cleanData,
			timestamp: Date.now(),
			synced: false,
			retry_count: 0,
		})

		console.log('Payment saved to offline queue')
		return true
	} catch (error) {
		console.error('Error saving offline payment:', error)
		throw error
	}
}

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
	window.addEventListener('online', async () => {
		console.log('Back online, syncing pending invoices...')
		window.posNextServerOnline = true
		const result = await syncOfflineInvoices()
		if (result.success > 0) {
			console.log(`Successfully synced ${result.success} invoices`)
			if (window.frappe?.msgprint) {
				window.frappe.msgprint({
					title: 'Sync Complete',
					message: `Successfully synced ${result.success} offline invoices`,
					indicator: 'green'
				})
			}
		}
	})

	window.addEventListener('offline', () => {
		console.log('Gone offline')
		window.posNextServerOnline = false
	})
}
