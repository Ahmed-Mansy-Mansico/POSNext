import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useOffline } from '@/composables/useOffline'
import { toast } from 'frappe-ui'
import { parseError } from '@/utils/errorHandler'
import {
	cacheItemsFromServer,
	cacheCustomersFromServer,
	cachePaymentMethodsFromServer
} from '@/utils/offline'

export const usePOSSyncStore = defineStore('posSync', () => {
	// Use the existing offline composable
	const {
		isOffline,
		pendingInvoicesCount,
		isSyncing,
		saveInvoiceOffline,
		syncPending,
		getPending,
		deletePending,
		cacheData,
		checkCacheReady,
		getCacheStats,
	} = useOffline()

	// Additional offline state
	const pendingInvoicesList = ref([])

	// Computed
	const hasPendingInvoices = computed(() => pendingInvoicesCount.value > 0)

	// Actions
	async function loadPendingInvoices() {
		try {
			pendingInvoicesList.value = await getPending()
		} catch (error) {
			console.error('Error loading pending invoices:', error)
			pendingInvoicesList.value = []
		}
	}

	async function deleteOfflineInvoice(invoiceId) {
		try {
			await deletePending(invoiceId)
			await loadPendingInvoices()
			toast.create({
				title: "Invoice Deleted",
				text: "Offline invoice deleted successfully",
				icon: "check",
				iconClasses: "text-green-600",
			})
		} catch (error) {
			console.error('Error deleting offline invoice:', error)
			toast.create({
				title: "Delete Failed",
				text: error.message || "Failed to delete offline invoice",
				icon: "alert-circle",
				iconClasses: "text-red-600",
			})
			throw error
		}
	}

	async function syncAllPending() {
		if (isOffline.value) {
			toast.create({
				title: "Offline Mode",
				text: "Cannot sync while offline",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
			return { success: 0, failed: 0, errors: [] }
		}

		try {
			const result = await syncPending()

			if (result.success > 0) {
				toast.create({
					title: "Sync Complete",
					text: `${result.success} invoice(s) synced successfully`,
					icon: "check",
					iconClasses: "text-green-600",
				})
				await loadPendingInvoices()
			}

			return result
		} catch (error) {
			console.error('Sync error:', error)
			throw error
		}
	}

	async function preloadDataForOffline(currentProfile) {
		if (!currentProfile || isOffline.value) {
			return
		}

		try {
			// Check cache status
			const cacheReady = await checkCacheReady()
			const stats = await getCacheStats()
			const needsRefresh = !stats.lastSync || (Date.now() - stats.lastSync) > (24 * 60 * 60 * 1000)

			if (!cacheReady || needsRefresh) {
				toast.create({
					title: "Syncing Data",
					text: "Loading items and customers for offline use...",
					icon: "download",
					iconClasses: "text-blue-600",
				})

				// Fetch from server
				const [itemsData, customersData, paymentMethodsData] = await Promise.all([
					cacheItemsFromServer(currentProfile.name),
					cacheCustomersFromServer(currentProfile.name),
					cachePaymentMethodsFromServer(currentProfile.name)
				])

				// Cache data using composable
				await cacheData(itemsData.items || [], customersData.customers || [])

				toast.create({
					title: "Sync Complete",
					text: "Data is ready for offline use",
					icon: "check",
					iconClasses: "text-green-600",
				})
			}
		} catch (error) {
			console.error('Error pre-loading data:', error)
			toast.create({
				title: "Sync Warning",
				text: "Some data may not be available offline",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
		}
	}

	async function checkOfflineCacheAvailability() {
		const cacheReady = await checkCacheReady()
		if (!cacheReady && isOffline.value) {
			toast.create({
				title: "Limited Functionality",
				text: "POS is offline without cached data. Please connect to sync.",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
		}
		return cacheReady
	}

	return {
		// State
		isOffline,
		pendingInvoicesCount,
		isSyncing,
		pendingInvoicesList,

		// Computed
		hasPendingInvoices,

		// Actions
		saveInvoiceOffline,
		loadPendingInvoices,
		deleteOfflineInvoice,
		syncAllPending,
		preloadDataForOffline,
		checkOfflineCacheAvailability,
		checkCacheReady,
		getCacheStats,
	}
})
