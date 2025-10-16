/**
 * Real-time Stock Updates Composable
 *
 * Listens to Socket.IO events for stock changes and notifies registered handlers.
 * Provides intelligent event management with deduplication and batching.
 * Each handler is responsible for filtering by warehouse and updating its cache.
 */

import { onUnmounted, ref } from "vue"

// Shared state across all instances
const isListening = ref(false)
const eventHandlers = new Set()
const pendingUpdates = new Map()
let batchTimeout = null

/**
 * Batch update configuration
 */
const BATCH_DELAY_MS = 500 // Wait 500ms before applying batched updates
const MAX_BATCH_SIZE = 100 // Maximum items to batch before forcing update

/**
 * Process pending stock updates in batch
 */
async function processBatchedUpdates() {
	if (pendingUpdates.size === 0) {
		return
	}

	const updates = Array.from(pendingUpdates.values())
	pendingUpdates.clear()

	try {
		// Notify all registered handlers
		// Each handler can filter by warehouse before applying updates
		eventHandlers.forEach((handler) => {
			try {
				handler(updates)
			} catch (error) {
				console.error("[Realtime Stock] Handler error:", error)
			}
		})
	} catch (error) {
		console.error("[Realtime Stock] Failed to process batch updates:", error)
	}
}

/**
 * Schedule batch processing
 */
function scheduleBatchUpdate() {
	if (batchTimeout) {
		clearTimeout(batchTimeout)
	}

	// Force update if batch is getting too large
	if (pendingUpdates.size >= MAX_BATCH_SIZE) {
		processBatchedUpdates()
		return
	}

	batchTimeout = setTimeout(() => {
		processBatchedUpdates()
		batchTimeout = null
	}, BATCH_DELAY_MS)
}

/**
 * Handle incoming stock update event
 */
function handleStockUpdate(data) {
	if (!data || !data.stock_updates) {
		return
	}

	// Add updates to pending batch (deduplicate by item_code + warehouse)
	data.stock_updates.forEach((update) => {
		const key = `${update.item_code}|${update.warehouse}`
		pendingUpdates.set(key, update)
	})

	scheduleBatchUpdate()
}

/**
 * Handle invoice created event (optional, for future use)
 */
function handleInvoiceCreated(data) {
	// Can be used to update sales dashboards, notifications, etc.
}

/**
 * Start listening to real-time events
 */
function startListening() {
	if (isListening.value) {
		return
	}

	if (!window.frappe?.realtime) {
		console.warn("[Realtime Stock] Socket.IO not available")
		return
	}

	// Subscribe to stock update events
	window.frappe.realtime.on("pos_stock_update", handleStockUpdate)
	window.frappe.realtime.on("pos_invoice_created", handleInvoiceCreated)

	isListening.value = true
}

/**
 * Stop listening to real-time events
 */
function stopListening() {
	if (!isListening.value) {
		return
	}

	if (window.frappe?.realtime) {
		window.frappe.realtime.off("pos_stock_update", handleStockUpdate)
		window.frappe.realtime.off("pos_invoice_created", handleInvoiceCreated)
	}

	// Clear pending updates
	if (batchTimeout) {
		clearTimeout(batchTimeout)
		batchTimeout = null
	}
	pendingUpdates.clear()

	isListening.value = false
}

/**
 * Flush pending updates immediately
 */
async function flushUpdates() {
	if (batchTimeout) {
		clearTimeout(batchTimeout)
		batchTimeout = null
	}
	await processBatchedUpdates()
}

/**
 * Main composable
 */
export function useRealtimeStock() {
	/**
	 * Register a callback to be notified of stock updates
	 * @param {Function} handler - Called with array of stock updates
	 * @returns {Function} Cleanup function to unregister handler
	 */
	function onStockUpdate(handler) {
		if (typeof handler !== "function") {
			throw new Error("Handler must be a function")
		}

		eventHandlers.add(handler)

		// Start listening when first handler is registered
		if (eventHandlers.size === 1) {
			startListening()
		}

		// Return cleanup function
		return () => {
			eventHandlers.delete(handler)

			// Stop listening when last handler is removed
			if (eventHandlers.size === 0) {
				stopListening()
			}
		}
	}

	// Cleanup on component unmount
	onUnmounted(() => {
		// Note: We don't stop listening here because other components
		// might still be using it. Each handler cleans up individually.
	})

	return {
		isListening,
		onStockUpdate,
		flushUpdates,
		startListening,
		stopListening,
	}
}
