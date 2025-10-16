import { createPinia } from "pinia"
import { createApp } from "vue"

import App from "./App.vue"
import { userResource } from "./data/user"
import router from "./router"
import { initSocket } from "./socket"
import {
	createCSRFAwareRequest,
	ensureCSRFToken,
	getCSRFTokenFromCookie,
} from "./utils/csrf"

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

// Register service worker for PWA
if ("serviceWorker" in navigator) {
	window.addEventListener(
		"load",
		() => {
			import("virtual:pwa-register").then(({ registerSW }) => {
				registerSW({
					immediate: true,
					onNeedRefresh() {
						console.log("New content available, reloading...")
					},
					onOfflineReady() {
						console.log("App ready to work offline")
					},
					onRegistered(registration) {
						console.log("Service Worker registered:", registration)
					},
					onRegisterError(error) {
						console.error("Service Worker registration error:", error)
					},
				})
			})
		},
		{ passive: true },
	)
}

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

// Initialize CSRF token and user session before mounting
async function initializeApp() {
	// Set up the app - CSRF token will be initialized after login
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

	// Add touch-action directive for mobile optimization
	app.directive("touch-action", {
		mounted(el) {
			el.style.touchAction = "manipulation"
		},
	})

	// Mount app with CSRF token initialized
	app.mount("#app")

	// After mounting, try to load user data (non-blocking)
	// If user is already logged in, get CSRF token
	try {
		await userResource.fetch()

		// User is logged in, ensure CSRF token is ready
		const hadToken = !!getCSRFTokenFromCookie()
		if (!hadToken) {
			console.log("User already logged in, initializing CSRF token...")
		}

		const tokenReady = await ensureCSRFToken()
		if (!tokenReady) {
			console.warn(
				"CSRF token unavailable after user fetch; will retry automatically",
			)
		}
	} catch (error) {
		// User not logged in - that's okay, they'll login and get the token then
		console.log("User not logged in, will get CSRF token after login")
		// Check if it's an auth error - redirect to login
		if (error?.exc_type === "AuthenticationError") {
			router.push({ name: "Login" })
		}
	}

	// Set up periodic token refresh (every 30 minutes)
	setInterval(
		async () => {
			console.log("Performing scheduled CSRF token refresh...")
			await ensureCSRFToken({ forceRefresh: true, silent: true })
		},
		30 * 60 * 1000,
	) // 30 minutes
}

initializeApp()
