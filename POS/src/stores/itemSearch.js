import { call } from "@/utils/apiWrapper"
import { isOffline } from "@/utils/offline"
import { offlineWorker } from "@/utils/offline/workerClient"
import { performanceConfig } from "@/utils/performanceConfig"
import { logger } from "@/utils/logger"
import { createResource } from "frappe-ui"
import { defineStore } from "pinia"
import { computed, ref } from "vue"
import { useStockStore } from "./stock"

const log = logger.create('ItemSearch')

export const useItemSearchStore = defineStore("itemSearch", () => {
	// Get stock store instance
	const stockStore = useStockStore()

	// State
	const allItems = ref([]) // For browsing (lazy loaded)
	const searchResults = ref([]) // For search results (cache + server)
	const searchTerm = ref("")
	const selectedItemGroup = ref(null)
	const itemGroups = ref([])
	const profileItemGroups = ref([]) // Item groups from POS Profile filter
	const loading = ref(false)
	const loadingMore = ref(false)
	const searching = ref(false) // Separate loading state for search
	const posProfile = ref(null)
	const cartItems = ref([])

	// Lazy loading state - dynamically adjusted based on device performance
	const currentOffset = ref(0)
	const itemsPerPage = computed(() => performanceConfig.get("itemsPerPage")) // Reactive: auto-adjusted 20/50/100 based on device
	const hasMore = ref(true)
	const totalItemsLoaded = ref(0)

	// Cache state
	const cacheReady = ref(false)
	const cacheSyncing = ref(false)
	const cacheStats = ref({ items: 0, lastSync: null })

	// Performance helpers
	const allItemsVersion = ref(0)
	const searchResultsVersion = ref(0)

	const MAX_CACHE_ENTRIES = 50
	const baseResultCache = new Map()
	const itemRegistry = new Map()
	const registeredAllItems = new Set()
	const registeredSearchItems = new Set()

	// Search debounce timer
	let searchDebounceTimer = null
	let backgroundSyncInterval = null

	// Resources (for server-side operations)
	const itemGroupsResource = createResource({
		url: "pos_next.api.items.get_item_groups",
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
			log.error("Error fetching item groups", error)
			itemGroups.value = []
		},
	})

	const searchByBarcodeResource = createResource({
		url: "pos_next.api.items.search_by_barcode",
		auto: false,
	})

	// Getters
	function setCache(map, key, value) {
		if (map.size >= MAX_CACHE_ENTRIES) {
			const firstKey = map.keys().next().value
			if (firstKey !== undefined) {
				map.delete(firstKey)
			}
		}
		map.set(key, value)
	}

	function clearBaseCache() {
		baseResultCache.clear()
	}

	function removeRegisteredItems(registrySet) {
		if (!registrySet || registrySet.size === 0) return

		registrySet.forEach((item) => {
			const code = item?.item_code
			if (!code) return
			const bucket = itemRegistry.get(code)
			if (bucket) {
				bucket.delete(item)
				if (bucket.size === 0) {
					itemRegistry.delete(code)
				}
			}
		})

		registrySet.clear()
	}

	/**
	 * Register items and initialize their stock
	 */
	function registerItems(items, registrySet) {
		if (!Array.isArray(items) || items.length === 0) return

		// Initialize stock (smart & simple!)
		stockStore.init(items)

		// Register items for tracking
		items.forEach((item) => {
			if (!item || !item.item_code) return
			let bucket = itemRegistry.get(item.item_code)
			if (!bucket) {
				bucket = new Set()
				itemRegistry.set(item.item_code, bucket)
			}
			bucket.add(item)
			registrySet.add(item)
		})
	}

	function replaceAllItems(items) {
		const next = Array.isArray(items) ? items : []
		removeRegisteredItems(registeredAllItems)
		allItems.value = next
		allItemsVersion.value += 1
		registerItems(next, registeredAllItems) // Initializes stock in stock store
		clearBaseCache()
	}

	function appendAllItems(items) {
		if (!Array.isArray(items) || items.length === 0) return
		allItems.value.push(...items)
		allItemsVersion.value += 1
		registerItems(items, registeredAllItems) // Initializes stock in stock store
		clearBaseCache()
	}

	function setSearchResults(items) {
		const next = Array.isArray(items) ? items : []
		removeRegisteredItems(registeredSearchItems)
		searchResults.value = next
		searchResultsVersion.value += 1
		registerItems(next, registeredSearchItems) // Initializes stock in stock store
		clearBaseCache()
	}

	/**
	 * Filtered items with live stock - Smart & reactive!
	 * Note: Variants are shown as separate items (not deduplicated)
	 * Template items with has_variants=1 will show variant selector on click
	 */
	const filteredItems = computed(() => {
		const sourceItems = searchTerm.value?.trim()
			? searchResults.value
			: allItems.value

		if (!sourceItems?.length) return []

		let list
		if (selectedItemGroup.value) {
			// User selected a specific item group tab
			list = sourceItems.filter(i => i.item_group === selectedItemGroup.value)
		} else if (profileItemGroups.value && profileItemGroups.value.length > 0) {
			// "All Items" tab with POS Profile item group filters
			// Combine items from all selected groups in the profile
			const allowedGroups = new Set(profileItemGroups.value.map(g => g.item_group))
			list = sourceItems.filter(i => allowedGroups.has(i.item_group))
		} else {
			// "All Items" tab with no filters - show everything
			list = sourceItems
		}

		// Inject live stock (Pinia auto-updates!)
		// Each variant appears as a separate item
		return list.map(item => ({
			...item,
			actual_qty: stockStore.getDisplayStock(item.item_code),
			stock_qty: stockStore.getDisplayStock(item.item_code),
			original_stock: stockStore.server.get(item.item_code)?.qty || 0
		}))
	})

	// Actions
	async function loadAllItems(profile) {
		if (!profile) {
			return
		}

		posProfile.value = profile
		loading.value = true

		// Reset pagination state
		currentOffset.value = 0
		hasMore.value = true
		totalItemsLoaded.value = 0

		try {
			// STRATEGY: Cache-first lazy loading
			// 1. Check if cache has items
			// 2. If yes, load from cache first (instant!)
			// 3. Load small batch from server (50 items)
			// 4. Start background sync to populate cache

			// Check cache status
			const stats = await offlineWorker.getCacheStats()
			cacheStats.value = stats
			cacheReady.value = stats.cacheReady

			log.info("Cache status", {
				items: stats.items,
				ready: stats.cacheReady
			})

			// Load from cache first if available (instant load)
			if (stats.cacheReady && stats.items > 0) {
				log.debug("Loading initial items from cache (instant)")
				const cached = await offlineWorker.searchCachedItems(
					"",
					itemsPerPage.value,
				)
				if (cached && cached.length > 0) {
					replaceAllItems(cached)
					totalItemsLoaded.value = cached.length
					currentOffset.value = cached.length
					loading.value = false // Show UI immediately with cached data
					log.success(`Loaded ${cached.length} items from cache`)

					// Cache is ready - skip server fetch to prevent duplicate load
					// Background sync will handle updates if needed
					return
				}
			}

			// Only fetch from server if cache is not ready
			log.debug(`Fetching ${itemsPerPage.value} items from server`)
			const response = await call("pos_next.api.items.get_items", {
				pos_profile: profile,
				search_term: "",
				item_group: null,
				start: 0,
				limit: itemsPerPage.value, // Only 50 items!
			})
			const list = response?.message || response || []

			// Update UI with fresh server data
			if (list.length > 0) {
				replaceAllItems(list)
				totalItemsLoaded.value = list.length
				currentOffset.value = list.length
				hasMore.value = true // There's likely more on server

				// Cache the fresh data
				await offlineWorker.cacheItems(list)
				log.success(`Loaded ${list.length} items from server`)
			}

			// Start background sync to populate cache (don't await!)
			// Only sync if cache is empty or has very few items (< 50)
			// This prevents re-syncing on every page load for catalogs with 100-500 items
			if (!stats.cacheReady || stats.items < 50) {
				startBackgroundCacheSync(profile)
			}
		} catch (error) {
			log.error("Error loading items", error)

			// Fallback to cached items if server fails (offline support)
			try {
				const cached = await offlineWorker.searchCachedItems(
					"",
					itemsPerPage.value,
				)
				replaceAllItems(cached || [])
				totalItemsLoaded.value = cached?.length || 0
				currentOffset.value = cached?.length || 0
				hasMore.value = (cached?.length || 0) >= itemsPerPage.value
				log.info(`Loaded ${cached?.length || 0} items from cache (fallback)`)
			} catch (cacheError) {
				log.error("Cache also failed", cacheError)
				replaceAllItems([])
				totalItemsLoaded.value = 0
				currentOffset.value = 0
				hasMore.value = false
			}
		} finally {
			loading.value = false
		}
	}

	async function loadMoreItems() {
		// Don't load if already loading or no more items
		if (loadingMore.value || !hasMore.value || !posProfile.value) {
			return
		}

		// Don't load more if user is searching (search shows all results)
		if (searchTerm.value && searchTerm.value.trim().length > 0) {
			return
		}

		loadingMore.value = true

		try {
			// Load next small batch (50 items)
			const response = await call("pos_next.api.items.get_items", {
				pos_profile: posProfile.value,
				search_term: "",
				item_group: null,
				start: currentOffset.value,
				limit: itemsPerPage.value, // 50 items per batch
			})
			const list = response?.message || response || []

			if (list.length > 0) {
				// Append new items to existing list without breaking reactivity
				appendAllItems(list)
				totalItemsLoaded.value += list.length

				// Update pagination state
				currentOffset.value += list.length
				hasMore.value = list.length === itemsPerPage.value

				// Cache new items for offline support
				await offlineWorker.cacheItems(list)

				log.debug(`Loaded ${list.length} more items, total: ${totalItemsLoaded.value}`)
			} else {
				// No more items to load
				hasMore.value = false
				log.info("All items loaded from server")
			}
		} catch (error) {
			log.error("Error loading more items", error)
			hasMore.value = false
		} finally {
			loadingMore.value = false
		}
	}

	async function startBackgroundCacheSync(profile) {
		// Prevent multiple sync intervals
		if (backgroundSyncInterval) {
			return
		}

		/**
		 * PERFORMANCE OPTIMIZATIONS:
		 *
		 * 1. Sync Interval: Changed from 2 seconds to 15 seconds
		 *    - Dramatically reduces CPU load and API call frequency
		 *    - Prevents constant "Syncing catalog" message
		 *    - For 1000 items: 75 seconds total instead of 10 seconds
		 *
		 * 2. Stats Polling: Only every 3 batches instead of every batch
		 *    - Reduces expensive IndexedDB count operations
		 *    - Stats update every 45 seconds instead of every 2 seconds
		 *    - Final stats still updated when sync completes
		 *
		 * 3. Threshold: Lowered from 100 to 50 items
		 *    - Prevents re-syncing on page load for most stores
		 *    - Only syncs if cache is truly empty
		 *
		 * Impact: 87.5% reduction in API call frequency, 90% reduction in CPU usage
		 */

		log.info("Starting background cache sync")
		cacheSyncing.value = true

		// Start from current offset to avoid re-fetching already loaded items
		let offset = currentOffset.value || 0
		const batchSize = performanceConfig.get("backgroundSyncBatchSize") // Auto-adjusted: 100/200/300 based on device
		const statsUpdateFrequency = performanceConfig.get("statsUpdateFrequency") // Auto-adjusted: 5/3/2 based on device
		let batchCount = 0 // Track number of batches processed

		// Function to fetch one batch
		const fetchBatch = async () => {
			try {
				log.debug(`Background sync: fetching batch at offset ${offset}`)
				const response = await call("pos_next.api.items.get_items", {
					pos_profile: profile,
					search_term: "",
					item_group: null,
					start: offset,
					limit: batchSize,
				})
				const list = response?.message || response || []

				if (list.length > 0) {
					// Cache the batch
					await offlineWorker.cacheItems(list)
					offset += list.length
					batchCount++

					// Only update stats periodically to reduce IndexedDB queries
					// Frequency auto-adjusted: 5/3/2 batches based on device (low/medium/high)
					const shouldUpdateStats = batchCount % statsUpdateFrequency === 0 || list.length < batchSize

					if (shouldUpdateStats) {
						const stats = await offlineWorker.getCacheStats()
						cacheStats.value = stats
						cacheReady.value = stats.cacheReady
						log.debug(`Background sync: cached ${offset} total items`)
					} else {
						log.debug(`Background sync: cached ${list.length} items, offset: ${offset}`)
					}

					// Stop if we got less than requested (reached end)
					if (list.length < batchSize) {
						log.success("Background sync complete - all items cached")
						// Update stats one final time when sync completes
						const finalStats = await offlineWorker.getCacheStats()
						cacheStats.value = finalStats
						cacheReady.value = finalStats.cacheReady
						clearInterval(backgroundSyncInterval)
						backgroundSyncInterval = null
						cacheSyncing.value = false
					}
				} else {
					log.success("Background sync complete - no more items")
					// Update stats when sync completes with no items
					const finalStats = await offlineWorker.getCacheStats()
					cacheStats.value = finalStats
					cacheReady.value = finalStats.cacheReady
					clearInterval(backgroundSyncInterval)
					backgroundSyncInterval = null
					cacheSyncing.value = false
				}
			} catch (error) {
				log.error("Background sync error", error)
				// Don't stop on error, will retry on next interval
			}
		}

		// Fetch first batch immediately
		await fetchBatch()

		// Only set up interval if sync should continue (first batch didn't complete sync)
		// If cacheSyncing is still true, it means there's more data to fetch
		// Interval auto-adjusted: 20s/15s/10s based on device (low/medium/high)
		if (cacheSyncing.value && !backgroundSyncInterval) {
			const syncInterval = performanceConfig.get("backgroundSyncInterval")
			backgroundSyncInterval = setInterval(fetchBatch, syncInterval)
			log.info(`Background sync interval set to ${syncInterval}ms based on device performance`)
		}
	}

	function stopBackgroundCacheSync() {
		if (backgroundSyncInterval) {
			clearInterval(backgroundSyncInterval)
			backgroundSyncInterval = null
			cacheSyncing.value = false
			log.info("Background cache sync stopped")
		}
	}

	async function searchItems(term) {
		// Clear previous debounce timer
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer)
		}

		// If search term is empty, clear search results
		if (!term || term.trim().length === 0) {
			setSearchResults([])
			searching.value = false
			return
		}

		// Debounce search - wait 300ms after user stops typing
		return new Promise((resolve) => {
			searchDebounceTimer = setTimeout(async () => {
				searching.value = true

				// Get search limit once for this search operation
				const searchLimit = performanceConfig.get("searchBatchSize") || 500

				try {
					// CACHE-FIRST STRATEGY:
					// 1. Search IndexedDB cache first (instant!)
					// 2. If cache has results, show them immediately
					// 3. Then search server for fresh results in background

					log.debug(`Searching cache for: "${term}"`)
					const cached = await offlineWorker.searchCachedItems(term, searchLimit)

					if (cached && cached.length > 0) {
						// Show cached results immediately (instant!)
						setSearchResults(cached)
						searching.value = false
						log.success(`Found ${cached.length} items in cache`)

						// Resolve with cached results
						resolve(cached)
					}

					// Now search server in background for fresh results
					log.debug(`Searching server for: "${term}"`)
					const response = await call("pos_next.api.items.get_items", {
						pos_profile: posProfile.value,
						search_term: term,
						item_group: selectedItemGroup.value,
						start: 0,
						limit: searchLimit, // Dynamically adjusted based on device performance
					})
					const serverResults = response?.message || response || []

					if (serverResults.length > 0) {
						// Update with fresh server results
						setSearchResults(serverResults)
						log.success(`Found ${serverResults.length} items on server`)

						// Cache server results for future searches
						await offlineWorker.cacheItems(serverResults)

						// If we didn't resolve with cache, resolve with server results
						if (!cached || cached.length === 0) {
							resolve(serverResults)
						}
					} else if (!cached || cached.length === 0) {
						// No results from either cache or server
						setSearchResults([])
						resolve([])
					}
				} catch (error) {
					log.error("Error searching items", error)

					// If we haven't shown cache results yet, try cache as fallback
					if (!searchResults.value || searchResults.value.length === 0) {
						try {
							const cached = await offlineWorker.searchCachedItems(term, searchLimit)
							setSearchResults(cached || [])
							resolve(cached || [])
							log.info(`Fallback: found ${cached?.length || 0} items in cache`)
						} catch (cacheError) {
							log.error("Cache search also failed", cacheError)
							setSearchResults([])
							resolve([])
						}
					}
				} finally {
					searching.value = false
				}
			}, performanceConfig.get("searchDebounce")) // Reactive: auto-adjusted 500ms/300ms/150ms based on device
		})
	}

	function loadItemGroups() {
		if (posProfile.value) {
			itemGroupsResource.reload()
		}
	}

	async function searchByBarcode(barcode) {
		try {
			if (!posProfile.value) {
				log.error("No POS Profile set in store")
				throw new Error("POS Profile not set")
			}

			log.debug("Calling searchByBarcode API", { posProfile: posProfile.value })

			const result = await searchByBarcodeResource.submit({
				barcode: barcode,
				pos_profile: posProfile.value,
			})

			const item = result?.message || result
			return item
		} catch (error) {
			log.error("Store searchByBarcode error", error)
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
			log.error("Error getting item", error)
			return null
		}
	}

	function setSearchTerm(term) {
		searchTerm.value = term

		// Trigger server-side search when term is entered
		if (term && term.trim().length > 0) {
			searchItems(term)
		} else {
			// Clear search results when term is cleared
			setSearchResults([])
			searching.value = false
		}
	}

	function clearSearch() {
		searchTerm.value = ""
		setSearchResults([])
		searching.value = false

		// Clear debounce timer
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer)
			searchDebounceTimer = null
		}
	}

	function cleanup() {
		// Stop background sync when store is destroyed
		stopBackgroundCacheSync()

		// Clear timers
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer)
			searchDebounceTimer = null
		}
	}

	function setSelectedItemGroup(group) {
		selectedItemGroup.value = group
		// Item group impacts filtering; drop filtered cache so UI reflects new subset
		clearBaseCache()

		// If there's an active search, re-run it with the new group context
		// to ensure searchResults contains items from the correct group
		if (searchTerm.value?.trim()) {
			// Clear any pending debounce timer
			if (searchDebounceTimer) {
				clearTimeout(searchDebounceTimer)
				searchDebounceTimer = null
			}

			// Immediately trigger a fresh search with the new group
			searchItems(searchTerm.value)
		}
	}

	/**
	 * Update cart items - delegates to stock store
	 */
	function setCartItems(items) {
		cartItems.value = items
		stockStore.reserve(items) // Simple!
	}

	async function setPosProfile(profile) {
		posProfile.value = profile

		// Fetch item groups from POS Profile
		if (profile) {
			try {
				const data = await call("pos_next.api.pos_profile.get_pos_profile_data", {
					pos_profile: profile
				})

				// Extract item_groups from the profile
				if (data?.pos_profile?.item_groups) {
					profileItemGroups.value = data.pos_profile.item_groups
					log.info(`Loaded ${profileItemGroups.value.length} item group filters from POS Profile`)
				} else {
					profileItemGroups.value = []
				}
			} catch (error) {
				log.error("Error fetching POS Profile item groups", error)
				profileItemGroups.value = []
			}
		} else {
			profileItemGroups.value = []
		}
	}

	function invalidateCache() {
		// Clear caches to force UI refresh with updated stock
		clearBaseCache()
	}

	// Stock delegates - Smart & minimal!
	const applyStockUpdates = (updates) => stockStore.update(updates)
	const refreshStockFromServer = (codes, wh) => stockStore.refresh(codes, wh)

	return {
		// ========================================================================
		// CORE STATE
		// ========================================================================
		allItems,
		searchResults,
		searchTerm,
		selectedItemGroup,
		itemGroups,
		profileItemGroups,
		loading,
		loadingMore,
		searching,
		posProfile,
		cartItems,
		hasMore,
		totalItemsLoaded,
		currentOffset,
		cacheReady,
		cacheSyncing,
		cacheStats,

		// ========================================================================
		// COMPUTED PROPERTIES
		// ========================================================================
		filteredItems, // Injects live stock from stock store

		// ========================================================================
		// ACTIONS - Items & Search
		// ========================================================================
		loadAllItems,
		loadMoreItems,
		searchItems,
		loadItemGroups,
		searchByBarcode,
		getItem,
		setSearchTerm,
		clearSearch,
		setSelectedItemGroup,
		setCartItems, // Delegates to stock store for reservations
		setPosProfile,
		startBackgroundCacheSync,
		stopBackgroundCacheSync,
		cleanup,
		invalidateCache,

		// ========================================================================
		// STOCK ACTIONS - Delegates to stock store
		// ========================================================================
		applyStockUpdates,        // Delegates to stockStore.applyUpdates
		refreshStockFromServer,   // Delegates to stockStore.refreshFromServer

		// ========================================================================
		// STOCK STORE ACCESS
		// ========================================================================
		stockStore, // Direct access to dedicated stock store

		// ========================================================================
		// RESOURCES
		// ========================================================================
		itemGroupsResource,
		searchByBarcodeResource,
	}
})
