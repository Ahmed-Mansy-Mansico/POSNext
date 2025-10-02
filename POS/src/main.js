import { createApp } from "vue"
import { createPinia } from "pinia"

import App from "./App.vue"
import router from "./router"
import { initSocket } from "./socket"
import { userResource } from "./data/user"

import {
	Alert,
	Badge,
	Button,
	Dialog,
	ErrorMessage,
	FormControl,
	Input,
	TextInput,
	frappeRequest,
	pageMetaPlugin,
	resourcesPlugin,
	setConfig,
} from "frappe-ui"

import "./index.css"

const globalComponents = {
	Button,
	TextInput,
	Input,
	FormControl,
	ErrorMessage,
	Dialog,
	Alert,
	Badge,
}

// Function to get CSRF token from cookies
function getCookie(name) {
	const value = `; ${document.cookie}`
	const parts = value.split(`; ${name}=`)
	if (parts.length === 2) return parts.pop().split(';').shift()
}

// Initialize CSRF token by making a GET request (doesn't require CSRF token)
async function initializeCSRFToken() {
	try {
		// Make a simple GET request to initialize session and get CSRF token
		await fetch('/api/method/frappe.auth.get_logged_user', {
			method: 'GET',
			credentials: 'include',
			headers: {
				'Accept': 'application/json',
				'X-Frappe-Site-Name': window.location.hostname,
			}
		})

		// After the request, CSRF token should be in cookies
		const csrfToken = getCookie('csrf_token')
		if (csrfToken && csrfToken !== '{{ csrf_token }}') {
			window.csrf_token = csrfToken
			console.log('CSRF token initialized:', csrfToken.substring(0, 10) + '...')
			return true
		}

		console.warn('CSRF token not found in cookies')
		return false
	} catch (error) {
		console.error('Failed to initialize CSRF token:', error)
		return false
	}
}

// Custom request wrapper that handles CSRF token refresh
function createCSRFAwareRequest(originalRequest) {
	return async function(options) {
		try {
			// Try the original request
			return await originalRequest(options)
		} catch (error) {
			// Check if it's a CSRF error
			const isCSRFError = error?.exc_type === 'CSRFTokenError' ||
			                    error?.message?.includes('CSRFTokenError') ||
			                    error?.messages?.some(m => m?.includes('CSRF'))

			if (isCSRFError) {
				console.warn('CSRF token error detected, refreshing token...')

				// Refresh the CSRF token
				const refreshed = await initializeCSRFToken()

				if (refreshed) {
					console.log('CSRF token refreshed, retrying request...')
					// Retry the request with new token
					return await originalRequest(options)
				}
			}

			// Re-throw the error if not CSRF or refresh failed
			throw error
		}
	}
}

// Initialize CSRF token and user session before mounting
async function initializeApp() {
	// First, initialize CSRF token with a GET request
	// This doesn't require CSRF token and will set it for us
	const tokenInitialized = await initializeCSRFToken()

	if (!tokenInitialized) {
		console.warn("CSRF token initialization failed, but continuing...")
	}

	// Now set up the app with CSRF token ready
	const app = createApp(App)
	const pinia = createPinia()

	// Wrap frappeRequest with CSRF auto-refresh
	const csrfAwareFrappeRequest = createCSRFAwareRequest(frappeRequest)
	setConfig("resourceFetcher", csrfAwareFrappeRequest)

	app.use(pinia)
	app.use(router)
	app.use(resourcesPlugin)
	app.use(pageMetaPlugin)

	const socket = initSocket()
	app.config.globalProperties.$socket = socket

	for (const key in globalComponents) {
		app.component(key, globalComponents[key])
	}

	// Mount app with CSRF token initialized
	app.mount("#app")

	// After mounting, try to load user data (non-blocking)
	try {
		await userResource.fetch()
	} catch (error) {
		console.error("Failed to load user data:", error)
		// App is already mounted, so this won't block the UI
	}

	// Set up periodic token refresh (every 30 minutes)
	setInterval(async () => {
		console.log('Performing scheduled CSRF token refresh...')
		await initializeCSRFToken()
	}, 30 * 60 * 1000) // 30 minutes
}

initializeApp()
