import { call as frappeCall } from 'frappe-ui'

// Function to get CSRF token from cookies
function getCookie(name) {
	const value = `; ${document.cookie}`
	const parts = value.split(`; ${name}=`)
	if (parts.length === 2) return parts.pop().split(';').shift()
}

// Initialize CSRF token by making a GET request
async function refreshCSRFToken() {
	try {
		await fetch('/api/method/frappe.auth.get_logged_user', {
			method: 'GET',
			credentials: 'include',
			headers: {
				'Accept': 'application/json',
				'X-Frappe-Site-Name': window.location.hostname,
			}
		})

		const csrfToken = getCookie('csrf_token')
		if (csrfToken && csrfToken !== '{{ csrf_token }}') {
			window.csrf_token = csrfToken
			console.log('CSRF token refreshed:', csrfToken.substring(0, 10) + '...')
			return true
		}
		console.warn('CSRF token not found in cookies after refresh')
		return false
	} catch (error) {
		console.error('Failed to refresh CSRF token:', error)
		return false
	}
}

// Wrapped call function with CSRF auto-refresh
export async function call(method, params) {
	try {
		return await frappeCall(method, params)
	} catch (error) {
		// Check if it's a CSRF error
		const isCSRFError = error?.exc_type === 'CSRFTokenError' ||
		                    error?.message?.includes('CSRFTokenError') ||
		                    error?.messages?.some(m => m?.includes('CSRF'))

		if (isCSRFError) {
			console.warn('CSRF token error in call(), refreshing token...')
			const refreshed = await refreshCSRFToken()

			if (refreshed) {
				console.log('Retrying call after CSRF refresh...')
				return await frappeCall(method, params)
			}
		}

		throw error
	}
}
