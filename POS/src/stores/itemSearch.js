import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { offlineWorker } from '@/utils/offline/workerClient'
import { isOffline } from '@/utils/offline'
import { call } from '@/utils/apiWrapper'
import { createResource } from 'frappe-ui'

export const useItemSearchStore = defineStore('itemSearch', () => {
	// State
	const allItems = ref([])
	const searchTerm = ref('')
	const selectedItemGroup = ref(null)
	const itemGroups = ref([])
	const loading = ref(false)
	const posProfile = ref(null)
	const cartItems = ref([])

	// Performance optimization: Result cache for instant searches
	const resultCache = ref(new Map())

	// Resources (for server-side operations)
	const itemGroupsResource = createResource({
		url: 'pos_next.api.items.get_item_groups',
		makeParams() {
			return {
				pos_profile: posProfile.value,
			}
		},
		auto: false,
		onSuccess(data) {
			itemGroups.value = data?.message || data || []
		},
		onError(error) {
			console.error('Error fetching item groups:', error)
			itemGroups.value = []
		},
	})

	const searchByBarcodeResource = createResource({
		url: 'pos_next.api.items.search_by_barcode',
		auto: false,
	})

	// Getters
	const filteredItems = computed(() => {
		if (!allItems.value || allItems.value.length === 0) return []

		let filtered = allItems.value

		// Filter by item group
		if (selectedItemGroup.value) {
			filtered = filtered.filter(
				(item) => item.item_group === selectedItemGroup.value
			)
		}

		// Filter by search term
		if (searchTerm.value && searchTerm.value.length > 0) {
			const term = searchTerm.value.toLowerCase()
			filtered = filtered.filter(
				(item) =>
					item.item_name?.toLowerCase().includes(term) ||
					item.item_code?.toLowerCase().includes(term) ||
					item.barcode?.toLowerCase().includes(term)
			)
		}

		// Limit results for performance
		filtered = filtered.slice(0, 100)

		// Create a map of cart items for faster lookup
		const cartItemsMap = new Map()
		if (cartItems.value.length > 0) {
			cartItems.value.forEach(ci => {
				cartItemsMap.set(ci.item_code, ci.quantity)
			})
		}

		// Adjust stock quantities based on cart items
		const result = filtered.map(item => {
			const cartQty = cartItemsMap.get(item.item_code)
			if (cartQty) {
				const originalStock = item.actual_qty || item.stock_qty || 0
				const availableStock = originalStock - cartQty
				return {
					...item,
					actual_qty: availableStock,
					stock_qty: availableStock,
					original_stock: originalStock
				}
			}
			return item
		})

		return result
	})

	// Actions
	async function loadAllItems(profile) {
		if (!profile) {
			return
		}

		posProfile.value = profile
		loading.value = true

		try {
			// Always fetch from server first to get latest data with item_group
			const response = await call('pos_next.api.items.get_items', {
				pos_profile: profile,
				search_term: '',
				item_group: null,
				start: 0,
				limit: 9999,
			})
			const list = response?.message || response || []
			allItems.value = list

			// Cache for future use
			if (list.length) {
				await offlineWorker.cacheItems(list)
			}

			// Clear result cache when new data is loaded
			resultCache.value.clear()
		} catch (error) {
			console.error('Error loading items:', error)

			// Fallback to cache if server fails
			try {
				const cached = await offlineWorker.searchCachedItems('', 9999)
				allItems.value = cached || []
			} catch (cacheError) {
				console.error('Cache also failed:', cacheError)
				allItems.value = []
			}
		} finally {
			loading.value = false
		}
	}

	function loadItemGroups() {
		if (posProfile.value) {
			itemGroupsResource.reload()
		}
	}

	async function searchByBarcode(barcode) {
		try {
			if (!posProfile.value) {
				console.error('No POS Profile set in store')
				throw new Error('POS Profile not set')
			}

			console.log('Calling searchByBarcode API with posProfile:', posProfile.value)

			const result = await searchByBarcodeResource.submit({
				barcode: barcode,
				pos_profile: posProfile.value,
			})

			const item = result?.message || result
			return item
		} catch (error) {
			console.error('Store searchByBarcode error:', error)
			throw error
		}
	}

	async function getItem(itemCode) {
		try {
			const cacheReady = await offlineWorker.isCacheReady()
			if (isOffline() || cacheReady) {
				const items = await offlineWorker.searchCachedItems(itemCode, 1)
				return items?.[0] || null
			} else {
				// Fallback to server (implement if needed)
				return null
			}
		} catch (error) {
			console.error('Error getting item:', error)
			return null
		}
	}

	function setSearchTerm(term) {
		searchTerm.value = term
	}

	function clearSearch() {
		searchTerm.value = ''
	}

	function setSelectedItemGroup(group) {
		selectedItemGroup.value = group
		// Clear result cache when item group changes to force re-filtering
		resultCache.value.clear()
	}

	function setCartItems(items) {
		cartItems.value = items
	}

	function setPosProfile(profile) {
		posProfile.value = profile
	}

	return {
		// State
		allItems,
		searchTerm,
		selectedItemGroup,
		itemGroups,
		loading,
		posProfile,
		cartItems,

		// Getters
		filteredItems,

		// Actions
		loadAllItems,
		loadItemGroups,
		searchByBarcode,
		getItem,
		setSearchTerm,
		clearSearch,
		setSelectedItemGroup,
		setCartItems,
		setPosProfile,

		// Resources
		itemGroupsResource,
		searchByBarcodeResource,
	}
})
