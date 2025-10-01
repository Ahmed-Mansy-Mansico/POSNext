import { ref, computed, onMounted, onUnmounted } from 'vue'
import { offlineWorker } from '@/utils/offline/workerClient'
import { syncOfflineInvoices } from '@/utils/offline'

export function useOffline() {
	const isOffline = ref(false)
	const pendingInvoicesCount = ref(0)
	const isSyncing = ref(false)

	// Check offline status using worker
	const updateOfflineStatus = async () => {
		const browserOnline = navigator.onLine
		const offline = await offlineWorker.checkOffline(browserOnline)

		if (isOffline.value !== offline) {
			console.log(`Offline status changed: ${isOffline.value} -> ${offline}`)
			isOffline.value = offline
		}
	}

	// Update pending invoices count using worker
	const updatePendingCount = async () => {
		pendingInvoicesCount.value = await offlineWorker.getOfflineInvoiceCount()
	}

	// Save invoice offline using worker
	const saveInvoiceOffline = async (invoiceData) => {
		try {
			await offlineWorker.saveOfflineInvoice(invoiceData)
			await updatePendingCount()
			return true
		} catch (error) {
			console.error('Error saving invoice offline:', error)
			throw error
		}
	}

	// Sync pending invoices (this still needs main thread for frappe.call)
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

	// Get pending invoices using worker
	const getPending = async () => {
		return await offlineWorker.getOfflineInvoices()
	}

	// Delete pending invoice using worker
	const deletePending = async (id) => {
		await offlineWorker.deleteOfflineInvoice(id)
		await updatePendingCount()
	}

	// Cache data using worker
	const cacheData = async (items, customers) => {
		try {
			if (items && items.length > 0) {
				await offlineWorker.cacheItems(items)
			}
			if (customers && customers.length > 0) {
				await offlineWorker.cacheCustomers(customers)
			}
			return true
		} catch (error) {
			console.error('Error caching data:', error)
			return false
		}
	}

	// Search cached items using worker
	const searchItems = async (searchTerm, limit = 50) => {
		return await offlineWorker.searchCachedItems(searchTerm, limit)
	}

	// Search cached customers using worker
	const searchCustomers = async (searchTerm, limit = 20) => {
		return await offlineWorker.searchCachedCustomers(searchTerm, limit)
	}

	// Check if cache is ready using worker
	const checkCacheReady = async () => {
		return await offlineWorker.isCacheReady()
	}

	// Get cache stats using worker
	const getCacheStats = async () => {
		return await offlineWorker.getCacheStats()
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

	const handleWorkerStatusChange = (event) => {
		// Worker detected server status change
		updateOfflineStatus()
	}

	onMounted(() => {
		// Initial check
		updateOfflineStatus()
		updatePendingCount()

		// Listen to online/offline events
		window.addEventListener('online', handleOnline)
		window.addEventListener('offline', handleOffline)

		// Listen to worker status changes
		window.addEventListener('offlineStatusChange', handleWorkerStatusChange)
	})

	onUnmounted(() => {
		window.removeEventListener('online', handleOnline)
		window.removeEventListener('offline', handleOffline)
		window.removeEventListener('offlineStatusChange', handleWorkerStatusChange)
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
		checkCacheReady,
		getCacheStats,
		updateOfflineStatus,
		updatePendingCount,
	}
}
