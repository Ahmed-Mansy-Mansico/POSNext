import { db, getSetting, setSetting } from './db'

// Cache version - increment when cache structure changes
export const CACHE_VERSION = 1

// In-memory cache for fast access
export const memory = {
	// Offline queues
	offline_invoices: [],
	offline_customers: [],
	offline_payments: [],

	// Cached data
	items: [],
	customers: [],
	item_prices: {},
	local_stock: {},

	// Metadata
	items_last_sync: null,
	customers_last_sync: null,
	cache_ready: false,
	stock_cache_ready: false,
	manual_offline: false,

	// Cache version
	cache_version: CACHE_VERSION,
}

// Initialize memory cache from IndexedDB
export const initMemoryCache = async () => {
	try {
		console.log('Initializing memory cache...')

		// Load cache version
		const storedVersion = await getSetting('cache_version', CACHE_VERSION)
		if (storedVersion !== CACHE_VERSION) {
			console.log('Cache version mismatch, clearing cache...')
			await clearAllCache()
			await setSetting('cache_version', CACHE_VERSION)
			memory.cache_version = CACHE_VERSION
		}

		// Load items last sync timestamp
		memory.items_last_sync = await getSetting('items_last_sync', null)
		memory.customers_last_sync = await getSetting('customers_last_sync', null)
		memory.cache_ready = await getSetting('cache_ready', false)
		memory.stock_cache_ready = await getSetting('stock_cache_ready', false)
		memory.manual_offline = await getSetting('manual_offline', false)

		// Load items count (don't load all items into memory, too heavy)
		const itemsCount = await db.items.count()
		const customersCount = await db.customers.count()

		console.log(`Cache initialized: ${itemsCount} items, ${customersCount} customers`)
		console.log(`Cache ready: ${memory.cache_ready}, Stock ready: ${memory.stock_cache_ready}`)

		return true
	} catch (error) {
		console.error('Failed to initialize memory cache:', error)
		return false
	}
}

// Check if cache is ready for offline use
export const isCacheReady = () => {
	return memory.cache_ready
}

// Check if stock cache is ready
export const isStockCacheReady = () => {
	return memory.stock_cache_ready
}

// Get manual offline state
export const isManualOffline = () => {
	return memory.manual_offline
}

// Set manual offline state
export const setManualOffline = async (state) => {
	memory.manual_offline = !!state
	await setSetting('manual_offline', memory.manual_offline)
}

// Toggle manual offline
export const toggleManualOffline = async () => {
	await setManualOffline(!memory.manual_offline)
	return memory.manual_offline
}

// Load items from server (returns data for worker to cache)
export const cacheItemsFromServer = async (posProfile) => {
	try {
		console.log('Fetching items from server...')

		const response = await window.frappe.call({
			method: 'pos_next.api.invoices.get_items',
			args: {
				pos_profile: posProfile,
				start: 0,
				limit: 9999 // Get all items
			}
		})

		if (response.message && Array.isArray(response.message)) {
			const items = response.message

			// Process items to add searchable fields
			const processedItems = items.map(item => ({
				...item,
				barcodes: item.item_barcode
					? Array.isArray(item.item_barcode)
						? item.item_barcode.map(b => b.barcode).filter(Boolean)
						: [item.item_barcode]
					: []
			}))

			console.log(`Fetched ${processedItems.length} items from server`)
			return { items: processedItems }
		}

		return { items: [] }
	} catch (error) {
		console.error('Error fetching items from server:', error)
		throw error
	}
}

// Load customers from server (returns data for worker to cache)
export const cacheCustomersFromServer = async (posProfile) => {
	try {
		console.log('Fetching customers from server...')

		const response = await window.frappe.call({
			method: 'pos_next.api.invoices.get_customers',
			args: {
				pos_profile: posProfile,
				start: 0,
				limit: 9999 // Get all customers
			}
		})

		if (response.message && Array.isArray(response.message)) {
			const customers = response.message

			console.log(`Fetched ${customers.length} customers from server`)
			return { customers }
		}

		return { customers: [] }
	} catch (error) {
		console.error('Error fetching customers from server:', error)
		throw error
	}
}

// Search items in cache
export const searchCachedItems = async (searchTerm = '', limit = 50) => {
	try {
		if (!searchTerm) {
			return await db.items.limit(limit).toArray()
		}

		const term = searchTerm.toLowerCase()

		// Search by item code, name, or barcode
		const results = await db.items
			.where('item_code').startsWithIgnoreCase(term)
			.or('item_name').startsWithIgnoreCase(term)
			.or('barcodes').equals(term)
			.limit(limit)
			.toArray()

		return results
	} catch (error) {
		console.error('Error searching cached items:', error)
		return []
	}
}

// Search customers in cache
export const searchCachedCustomers = async (searchTerm = '', limit = 50) => {
	try {
		if (!searchTerm) {
			return await db.customers.limit(limit).toArray()
		}

		const term = searchTerm.toLowerCase()

		// Search by name, mobile, or email
		const results = await db.customers
			.where('customer_name').startsWithIgnoreCase(term)
			.or('mobile_no').startsWithIgnoreCase(term)
			.or('email_id').startsWithIgnoreCase(term)
			.limit(limit)
			.toArray()

		return results
	} catch (error) {
		console.error('Error searching cached customers:', error)
		return []
	}
}

// Get item from cache by code
export const getCachedItem = async (itemCode) => {
	try {
		return await db.items.get(itemCode)
	} catch (error) {
		console.error('Error getting cached item:', error)
		return null
	}
}

// Get customer from cache by name
export const getCachedCustomer = async (customerName) => {
	try {
		return await db.customers.get(customerName)
	} catch (error) {
		console.error('Error getting cached customer:', error)
		return null
	}
}

// Check if cache needs refresh (older than 24 hours)
export const needsCacheRefresh = () => {
	if (!memory.items_last_sync) return true

	const ONE_DAY = 24 * 60 * 60 * 1000
	const now = Date.now()
	return (now - memory.items_last_sync) > ONE_DAY
}

// Clear all cached data
export const clearAllCache = async () => {
	try {
		console.log('Clearing all cache...')

		// Clear IndexedDB tables
		await db.items.clear()
		await db.customers.clear()
		await db.item_prices.clear()
		await db.stock.clear()

		// Reset memory
		memory.items = []
		memory.customers = []
		memory.item_prices = {}
		memory.local_stock = {}
		memory.items_last_sync = null
		memory.customers_last_sync = null
		memory.cache_ready = false
		memory.stock_cache_ready = false

		// Update settings
		await setSetting('items_last_sync', null)
		await setSetting('customers_last_sync', null)
		await setSetting('cache_ready', false)
		await setSetting('stock_cache_ready', false)

		console.log('Cache cleared successfully')
		return true
	} catch (error) {
		console.error('Error clearing cache:', error)
		return false
	}
}

// Get cache stats
export const getCacheStats = async () => {
	try {
		const itemsCount = await db.items.count()
		const customersCount = await db.customers.count()
		const queuedInvoices = await db.invoice_queue
			.filter(inv => inv.synced === false)
			.count()

		return {
			items: itemsCount,
			customers: customersCount,
			queuedInvoices,
			cacheReady: memory.cache_ready,
			stockReady: memory.stock_cache_ready,
			lastSync: memory.items_last_sync
				? new Date(memory.items_last_sync).toLocaleString()
				: 'Never'
		}
	} catch (error) {
		console.error('Error getting cache stats:', error)
		return {
			items: 0,
			customers: 0,
			queuedInvoices: 0,
			cacheReady: false,
			stockReady: false,
			lastSync: 'Error'
		}
	}
}

// Initialize cache on import
initMemoryCache()
