import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
	isOffline as checkOffline,
	saveOfflineInvoice,
	getOfflineInvoiceCount,
	syncOfflineInvoices,
	getOfflineInvoices,
	deleteOfflineInvoice,
	cacheItems,
	cacheCustomers,
	searchCachedItems,
	searchCachedCustomers,
	isCacheFresh,
} from '@/utils/offline'

export function useOffline() {
	const isOffline = ref(false)
	const pendingInvoicesCount = ref(0)
	const isSyncing = ref(false)

	// Check offline status
	const updateOfflineStatus = () => {
		isOffline.value = checkOffline()
	}

	// Update pending invoices count
	const updatePendingCount = async () => {
		pendingInvoicesCount.value = await getOfflineInvoiceCount()
	}

	// Save invoice offline
	const saveInvoiceOffline = async (invoiceData) => {
		try {
			await saveOfflineInvoice(invoiceData)
			await updatePendingCount()
			return true
		} catch (error) {
			console.error('Error saving invoice offline:', error)
			throw error
		}
	}

	// Sync pending invoices
	const syncPending = async () => {
		if (isOffline.value) {
			throw new Error('Cannot sync while offline')
		}

		isSyncing.value = true
		try {
			const result = await syncOfflineInvoices()
			await updatePendingCount()
			return result
		} catch (error) {
			console.error('Error syncing invoices:', error)
			throw error
		} finally {
			isSyncing.value = false
		}
	}

	// Get pending invoices
	const getPending = async () => {
		return await getOfflineInvoices()
	}

	// Delete pending invoice
	const deletePending = async (id) => {
		await deleteOfflineInvoice(id)
		await updatePendingCount()
	}

	// Cache data for offline use
	const cacheData = async (items, customers, priceList) => {
		try {
			if (items && items.length > 0) {
				await cacheItems(items, priceList)
			}
			if (customers && customers.length > 0) {
				await cacheCustomers(customers)
			}
			return true
		} catch (error) {
			console.error('Error caching data:', error)
			return false
		}
	}

	// Search cached items
	const searchItems = async (searchTerm, limit = 50) => {
		return await searchCachedItems(searchTerm, limit)
	}

	// Search cached customers
	const searchCustomers = async (searchTerm, limit = 20) => {
		return await searchCachedCustomers(searchTerm, limit)
	}

	// Check if cache is fresh
	const checkCacheFreshness = async (type = 'items') => {
		return await isCacheFresh(type)
	}

	// Event listeners
	const handleOnline = () => {
		updateOfflineStatus()
		// Auto-sync when coming back online
		syncPending().catch(console.error)
	}

	const handleOffline = () => {
		updateOfflineStatus()
	}

	onMounted(() => {
		updateOfflineStatus()
		updatePendingCount()

		// Listen to online/offline events
		window.addEventListener('online', handleOnline)
		window.addEventListener('offline', handleOffline)
	})

	onUnmounted(() => {
		window.removeEventListener('online', handleOnline)
		window.removeEventListener('offline', handleOffline)
	})

	return {
		isOffline,
		pendingInvoicesCount,
		isSyncing,
		saveInvoiceOffline,
		syncPending,
		getPending,
		deletePending,
		cacheData,
		searchItems,
		searchCustomers,
		checkCacheFreshness,
		updateOfflineStatus,
		updatePendingCount,
	}
}
