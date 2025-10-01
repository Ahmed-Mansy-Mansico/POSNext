// Main offline module - exports all offline functionality

export { db, initDB, checkDBHealth, getSetting, setSetting } from './db'

export {
	isOffline,
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
	searchCachedItems,
	getItemByBarcode,
	getItemWithPrice,
	cacheCustomers,
	searchCachedCustomers,
	getItemsLastSync,
	getCustomersLastSync,
	isCacheFresh,
	clearItemsCache,
	clearCustomersCache,
} from './items'
