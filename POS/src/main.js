import { createApp } from "vue"

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
		const response = await fetch('/api/method/frappe.auth.get_logged_user', {
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
		}

		return response.ok
	} catch (error) {
		console.error('Failed to initialize CSRF token:', error)
		return false
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

	setConfig("resourceFetcher", frappeRequest)

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
}

initializeApp()
