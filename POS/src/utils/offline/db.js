import Dexie from 'dexie'

// Initialize Dexie database
export const db = new Dexie('pos_next_offline')

// Define database schema
db.version(1).stores({
	// Key-value store for settings and metadata
	settings: '&key',

	// Invoice queue for offline submissions
	invoice_queue: '++id, timestamp, synced',

	// Items cache with searchable fields
	items: '&item_code, item_name, item_group, *barcodes',

	// Customers cache
	customers: '&name, customer_name, mobile_no, email_id',

	// Price list cache
	item_prices: '&[price_list+item_code], price_list, item_code',

	// Local stock cache
	stock: '&[item_code+warehouse], item_code, warehouse',

	// Payment queue for offline payments
	payment_queue: '++id, timestamp, synced',

	// Drafts (already handled by draftManager, but keeping for consistency)
	drafts: '++id, draft_id, timestamp',
})

// Database initialization
export const initDB = async () => {
	try {
		await db.open()
		console.log('POS Next offline database initialized')
		return true
	} catch (error) {
		console.error('Failed to initialize offline database:', error)
		return false
	}
}

// Health check
export const checkDBHealth = async () => {
	try {
		await db.settings.get('health_check')
		return true
	} catch (error) {
		console.error('Database health check failed:', error)

		// Try to reopen
		try {
			if (db.isOpen()) {
				await db.close()
			}
			await db.open()
			console.log('Database reopened successfully')
			return true
		} catch (reopenError) {
			console.error('Failed to reopen database:', reopenError)

			// If corrupted, recreate
			if (reopenError.name === 'VersionError' || reopenError.name === 'InvalidStateError') {
				console.log('Database appears corrupted, recreating...')
				try {
					await Dexie.delete('pos_next_offline')
					await db.open()
					console.log('Database recreated successfully')
					return true
				} catch (recreateError) {
					console.error('Failed to recreate database:', recreateError)
					return false
				}
			}
			return false
		}
	}
}

// Get/Set settings
export const getSetting = async (key, defaultValue = null) => {
	try {
		const result = await db.settings.get(key)
		return result ? result.value : defaultValue
	} catch (error) {
		console.error(`Error getting setting ${key}:`, error)
		return defaultValue
	}
}

export const setSetting = async (key, value) => {
	try {
		await db.settings.put({ key, value })
	} catch (error) {
		console.error(`Error setting ${key}:`, error)
	}
}

// Initialize database on import
initDB()
