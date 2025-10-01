// Main offline module - exports all offline functionality

export { db, initDB, checkDBHealth, getSetting, setSetting } from './db'

export {
	isOffline,
	pingServer,
	saveOfflineInvoice,
	getOfflineInvoices,
	getOfflineInvoiceCount,
	syncOfflineInvoices,
	deleteOfflineInvoice,
	updateLocalStock,
	getLocalStock,
	saveOfflinePayment,
} from './sync'

export {
	cacheItems,
	getCachedItems,
	searchCachedItems as searchCachedItemsOld,
	getItemByBarcode,
	getItemWithPrice,
	cacheCustomers,
	searchCachedCustomers as searchCachedCustomersOld,
	getItemsLastSync,
	getCustomersLastSync,
	isCacheFresh,
	clearItemsCache,
	clearCustomersCache,
} from './items'

// New cache system exports
export {
	memory,
	initMemoryCache,
	isCacheReady,
	isStockCacheReady,
	isManualOffline,
	setManualOffline,
	toggleManualOffline,
	cacheItemsFromServer,
	cacheCustomersFromServer,
	searchCachedItems,
	searchCachedCustomers,
	getCachedItem,
	getCachedCustomer,
	needsCacheRefresh,
	clearAllCache,
	getCacheStats,
} from './cache'
