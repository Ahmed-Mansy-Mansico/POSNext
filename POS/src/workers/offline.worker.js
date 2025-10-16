/**
 * Offline Worker - Handles all offline operations in background thread
 * - Server ping and connectivity checks
 * - IndexedDB operations
 * - Invoice sync operations
 * - Cache management
 */

// Import Dexie using importScripts for worker context
// Note: In Vite, worker imports work differently
let Dexie
let db = null
let dbInitialized = false

// Initialize IndexedDB in worker context
async function initDB() {
	if (db && dbInitialized) return db

	try {
		// Dynamic import for worker context (Vite handles this)
		const dexieModule = await import("dexie")
		Dexie = dexieModule.default || dexieModule

		// Use the same database name as main thread
		db = new Dexie("pos_next_offline")

		// Open existing database - Dexie will discover the schema automatically
		await db.open()

		// Verify tables are accessible
		const tables = db.tables.map((t) => t.name)
		console.log(`Worker: Connected to database with tables: ${tables.join(", ")}`)

		dbInitialized = true
		return db
	} catch (error) {
		console.error("Worker: Failed to connect to database:", error)
		throw error
	}
}

// Server connectivity state
let serverOnline = true
let manualOffline = false

// Ping server to check connectivity
async function pingServer() {
	try {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 3000)

		const response = await fetch("/api/method/pos_next.api.ping", {
			method: "GET",
			signal: controller.signal,
		})

		clearTimeout(timeoutId)
		serverOnline = response.ok
		return serverOnline
	} catch (error) {
		serverOnline = false
		return false
	}
}

// Check offline status
function isOffline(browserOnline) {
	if (manualOffline) return true
	return !browserOnline || !serverOnline
}

// Get offline invoice count
async function getOfflineInvoiceCount() {
	try {
		const db = await initDB()
		const count = await db
			.table("invoice_queue")
			.filter((invoice) => invoice.synced === false)
			.count()
		return count
	} catch (error) {
		console.error("Worker: Error getting offline invoice count:", error)
		return 0
	}
}

// Get offline invoices
async function getOfflineInvoices() {
	try {
		const db = await initDB()
		const invoices = await db
			.table("invoice_queue")
			.filter((invoice) => invoice.synced === false)
			.toArray()
		return invoices
	} catch (error) {
		console.error("Worker: Error getting offline invoices:", error)
		return []
	}
}

// Save invoice to offline queue
async function saveOfflineInvoice(invoiceData) {
	try {
		const db = await initDB()

		if (!invoiceData.items || invoiceData.items.length === 0) {
			throw new Error("Cannot save empty invoice")
		}

		const id = await db.table("invoice_queue").add({
			data: invoiceData,
			timestamp: Date.now(),
			synced: false,
			retry_count: 0,
		})

		// NOTE: We don't update local stock here because:
		// 1. The invoice hasn't been submitted to server yet
		// 2. When we sync, the server will handle stock reduction
		// 3. Updating stock locally causes NegativeStockError on sync

		return { success: true, id }
	} catch (error) {
		console.error("Worker: Error saving offline invoice:", error)
		throw error
	}
}

// Update local stock
async function updateLocalStock(items) {
	try {
		const db = await initDB()

		for (const item of items) {
			// Skip if no warehouse specified
			if (!item.warehouse || !item.item_code) {
				continue
			}

			const currentStock = await db.table("stock").get({
				item_code: item.item_code,
				warehouse: item.warehouse,
			})

			const qty = item.quantity || item.qty || 0
			const newQty = (currentStock?.qty || 0) - qty

			await db.table("stock").put({
				item_code: item.item_code,
				warehouse: item.warehouse,
				qty: newQty,
				updated_at: Date.now(),
			})
		}
	} catch (error) {
		console.error("Worker: Error updating local stock:", error)
	}
}

// Search cached items
async function searchCachedItems(searchTerm = "", limit = 50) {
	try {
		const db = await initDB()
		const term = searchTerm.toLowerCase()

		if (!term) {
			return await db.table("items").limit(limit).toArray()
		}

		// Performance: Use IndexedDB queries with multi-entry barcode index
		// Try exact barcode match first (fastest)
		const barcodeResults = await db
			.table("items")
			.where("barcodes")
			.equals(term)
			.limit(limit)
			.toArray()

		if (barcodeResults.length > 0) {
			return barcodeResults
		}

		// Fall back to prefix searches on indexed fields
		const results = await db
			.table("items")
			.where("item_code")
			.startsWithIgnoreCase(term)
			.or("item_name")
			.startsWithIgnoreCase(term)
			.limit(limit)
			.toArray()

		return results
	} catch (error) {
		console.error("Worker: Error searching cached items:", error)
		return []
	}
}

// Search cached customers
async function searchCachedCustomers(searchTerm = "", limit = 20) {
	try {
		const db = await initDB()
		const term = searchTerm.toLowerCase()

		if (!term) {
			return await db.table("customers").limit(limit).toArray()
		}

		// Get all customers and filter in memory for 'includes' behavior
		// This is fast because IndexedDB is already in-memory for small datasets
		const allCustomers = await db.table("customers").toArray()

		const results = allCustomers
			.filter((cust) => {
				const name = (cust.customer_name || "").toLowerCase()
				const mobile = (cust.mobile_no || "").toLowerCase()
				const id = (cust.name || "").toLowerCase()

				return name.includes(term) || mobile.includes(term) || id.includes(term)
			})
			.slice(0, limit)

		return results
	} catch (error) {
		console.error("Worker: Error searching cached customers:", error)
		return []
	}
}

// Cache items from server
async function cacheItemsFromServer(items) {
	try {
		const db = await initDB()

		// Performance: Process items to extract barcodes for multi-entry index
		const processedItems = items.map((item) => {
			// Extract barcodes array from various possible formats
			let barcodes = []
			if (item.barcode) {
				// Single barcode field
				barcodes = [item.barcode]
			} else if (item.item_barcode) {
				// item_barcode can be array or single value
				barcodes = Array.isArray(item.item_barcode)
					? item.item_barcode
							.map((b) => (typeof b === "object" ? b.barcode : b))
							.filter(Boolean)
					: [item.item_barcode]
			} else if (item.barcodes && Array.isArray(item.barcodes)) {
				// Already processed barcodes array
				barcodes = item.barcodes
			}

			return {
				...item,
				barcodes,
			}
		})

		await db.table("items").bulkPut(processedItems)

		// Update settings
		await db.table("settings").put({
			key: "items_last_sync",
			value: Date.now(),
		})

		return { success: true, count: items.length }
	} catch (error) {
		console.error("Worker: Error caching items:", error)
		throw error
	}
}

// Cache customers from server
async function cacheCustomersFromServer(customers) {
	try {
		const db = await initDB()
		await db.table("customers").bulkPut(customers)

		// Update settings
		await db.table("settings").put({
			key: "customers_last_sync",
			value: Date.now(),
		})

		return { success: true, count: customers.length }
	} catch (error) {
		console.error("Worker: Error caching customers:", error)
		throw error
	}
}

// Check if cache is ready
async function isCacheReady() {
	try {
		const db = await initDB()
		const itemCount = await db.table("items").count()
		return itemCount > 0
	} catch (error) {
		return false
	}
}

// Get cache stats
async function getCacheStats() {
	try {
		const db = await initDB()

		const [itemCount, customerCount, queuedInvoices, lastSyncSetting] =
			await Promise.all([
				db.table("items").count(),
				db.table("customers").count(),
				getOfflineInvoiceCount(),
				db.table("settings").get("items_last_sync"),
			])

		return {
			items: itemCount,
			customers: customerCount,
			queuedInvoices,
			cacheReady: itemCount > 0,
			lastSync: lastSyncSetting?.value || null,
		}
	} catch (error) {
		console.error("Worker: Error getting cache stats:", error)
		return {
			items: 0,
			customers: 0,
			queuedInvoices: 0,
			cacheReady: false,
			lastSync: null,
		}
	}
}

// Delete offline invoice
async function deleteOfflineInvoice(id) {
	try {
		const db = await initDB()
		await db.table("invoice_queue").delete(id)
		return { success: true }
	} catch (error) {
		console.error("Worker: Error deleting offline invoice:", error)
		throw error
	}
}

// Update stock quantities in cached items
async function updateStockQuantities(stockUpdates) {
	try {
		const db = await initDB()

		if (!stockUpdates || stockUpdates.length === 0) {
			return { success: true, updated: 0 }
		}

		let updatedCount = 0

		// Process each stock update
		for (const update of stockUpdates) {
			const { item_code, warehouse, actual_qty, stock_qty } = update

			if (!item_code) {
				continue
			}

			// Get the cached item
			const item = await db.table("items").get(item_code)

			if (!item) {
				continue
			}

			// Update stock quantities for this warehouse
			item.actual_qty = actual_qty !== undefined ? actual_qty : stock_qty
			item.stock_qty = stock_qty !== undefined ? stock_qty : actual_qty
			item.warehouse = warehouse || item.warehouse

			// Save updated item back to cache
			await db.table("items").put(item)
			updatedCount++
		}

		return { success: true, updated: updatedCount }
	} catch (error) {
		console.error("Worker: Error updating stock quantities:", error)
		throw error
	}
}

// Message handler
self.onmessage = async (event) => {
	const { type, payload, id } = event.data

	try {
		let result

		switch (type) {
			case "PING_SERVER":
				result = await pingServer()
				break

			case "CHECK_OFFLINE":
				result = isOffline(payload.browserOnline)
				break

			case "GET_INVOICE_COUNT":
				result = await getOfflineInvoiceCount()
				break

			case "GET_INVOICES":
				result = await getOfflineInvoices()
				break

			case "SAVE_INVOICE":
				result = await saveOfflineInvoice(payload.invoiceData)
				break

			case "SEARCH_ITEMS":
				result = await searchCachedItems(payload.searchTerm, payload.limit)
				break

			case "SEARCH_CUSTOMERS":
				result = await searchCachedCustomers(payload.searchTerm, payload.limit)
				break

			case "CACHE_ITEMS":
				result = await cacheItemsFromServer(payload.items)
				break

			case "CACHE_CUSTOMERS":
				result = await cacheCustomersFromServer(payload.customers)
				break

			case "IS_CACHE_READY":
				result = await isCacheReady()
				break

			case "GET_CACHE_STATS":
				result = await getCacheStats()
				break

			case "DELETE_INVOICE":
				result = await deleteOfflineInvoice(payload.id)
				break

			case "SET_MANUAL_OFFLINE":
				manualOffline = payload.value
				result = { success: true, manualOffline }
				break

			case "UPDATE_STOCK_QUANTITIES":
				result = await updateStockQuantities(payload.stockUpdates)
				break

			default:
				throw new Error(`Unknown message type: ${type}`)
		}

		self.postMessage({
			type: "SUCCESS",
			id,
			payload: result,
		})
	} catch (error) {
		self.postMessage({
			type: "ERROR",
			id,
			payload: {
				message: error.message,
				stack: error.stack,
			},
		})
	}
}

// Initialize worker
async function initialize() {
	try {
		// Initialize database first
		await initDB()
		console.log("Offline worker: Database ready")

		// Start periodic server ping (every 30 seconds)
		setInterval(async () => {
			const isOnline = await pingServer()
			self.postMessage({
				type: "SERVER_STATUS_CHANGE",
				payload: { serverOnline: isOnline },
			})
		}, 30000)

		// Initial ping
		const isOnline = await pingServer()

		self.postMessage({
			type: "WORKER_READY",
			payload: { serverOnline: isOnline },
		})

		console.log("Offline worker initialized and ready")
	} catch (error) {
		console.error("Offline worker initialization failed:", error)
		self.postMessage({
			type: "ERROR",
			payload: {
				message: `Worker initialization failed: ${error.message}`,
				stack: error.stack,
			},
		})
	}
}

// Start initialization
initialize()
