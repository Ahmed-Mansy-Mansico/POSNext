/**
 * useFormatters composable
 * Provides common formatting functions for use across all components
 */

/**
 * Format currency values to 2 decimal places
 * @param {number} amount - The amount to format
 * @returns {string} Formatted amount with 2 decimal places
 */
export function formatCurrency(amount) {
	if (amount === null || amount === undefined) return "0.00"
	return Number.parseFloat(amount).toFixed(2)
}

/**
 * Format quantity values with smart decimal handling
 * Removes trailing zeros for cleaner display
 * @param {number} quantity - The quantity to format
 * @returns {string} Formatted quantity
 */
export function formatQuantity(quantity) {
	if (quantity === null || quantity === undefined) return "0"
	const num = Number.parseFloat(quantity)
	// Round to 2 decimal places and remove trailing zeros
	return num.toFixed(2).replace(/\.?0+$/, '')
}

/**
 * Format date and time
 * @param {string|Date} datetime - The datetime to format
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(datetime) {
	if (!datetime) return ""
	return new Date(datetime).toLocaleString()
}

/**
 * Format time only (hours and minutes)
 * @param {string|Date} datetime - The datetime to format
 * @returns {string} Formatted time string (HH:MM)
 */
export function formatTime(datetime) {
	if (!datetime) return ""
	return new Date(datetime).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	})
}

/**
 * Format date only
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
	if (!date) return ""
	return new Date(date).toLocaleDateString()
}

/**
 * Format percentage values
 * @param {number} value - The value to format as percentage
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage
 */
export function formatPercentage(value, decimals = 2) {
	if (value === null || value === undefined) return "0%"
	return `${Number.parseFloat(value).toFixed(decimals).replace(/\.?0+$/, '')}%`
}

/**
 * Composable function to use formatters
 * @returns {Object} Object containing all formatter functions
 */
export function useFormatters() {
	return {
		formatCurrency,
		formatQuantity,
		formatDateTime,
		formatTime,
		formatDate,
		formatPercentage,
	}
}
