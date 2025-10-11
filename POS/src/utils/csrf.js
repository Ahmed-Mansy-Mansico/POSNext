const CSRF_COOKIE = "csrf_token"
const CSRF_PLACEHOLDER = "{{ csrf_token }}"
const LOGGED_USER_ENDPOINT = "/api/method/frappe.auth.get_logged_user"

let refreshPromise = null
let lastKnownToken = null

function readCookie(name) {
	const value = `; ${document.cookie}`
	const parts = value.split(`; ${name}=`)
	if (parts.length === 2) {
		return parts.pop().split(";").shift() || null
	}
	return null
}

function normalizeToken(token) {
	if (typeof token !== "string" || token === CSRF_PLACEHOLDER || !token) {
		return null
	}
	return token
}

function setGlobalToken(token, source) {
	if (!token) {
		return null
	}

	window.csrf_token = token

	if (token !== lastKnownToken) {
		const prefix = token.substring(0, 10)
		const context = source === "response" ? "initialized" : "loaded"
		console.log(`CSRF token ${context}: ${prefix}...`)
		lastKnownToken = token
	}

	return token
}

export function getCSRFTokenFromCookie() {
	const token = normalizeToken(readCookie(CSRF_COOKIE))
	if (token) {
		setGlobalToken(token, "cookie")
	}
	return token
}

async function fetchLoggedUser() {
	const response = await fetch(LOGGED_USER_ENDPOINT, {
		method: "GET",
		credentials: "include",
		headers: {
			Accept: "application/json",
			"X-Frappe-Site-Name": window.location.hostname,
		},
	})

	let data = null
	const contentType = response.headers.get("content-type") || ""
	if (contentType.includes("application/json")) {
		try {
			data = await response.json()
		} catch (error) {
			console.warn("Could not parse CSRF refresh response as JSON")
		}
	}

	return { response, data }
}

function extractTokenFromResponse(data) {
	return normalizeToken(data?.csrf_token)
}

export async function ensureCSRFToken({ forceRefresh = false, silent = false } = {}) {
	if (!forceRefresh) {
		const existingToken = getCSRFTokenFromCookie()
		if (existingToken) {
			return true
		}
	}

	if (refreshPromise) {
		return refreshPromise
	}

	refreshPromise = (async () => {
		try {
			const { response, data } = await fetchLoggedUser()

			if (response.status === 401 || response.status === 403) {
				if (!silent) {
					console.log("User not authenticated, skipping CSRF token refresh")
				}
				return false
			}

			if (!response.ok && !silent) {
				console.warn("Failed to refresh CSRF token, status:", response.status)
			}

			const tokenFromCookie = getCSRFTokenFromCookie()
			if (tokenFromCookie) {
				if (!silent && forceRefresh) {
					console.log("CSRF token refreshed via cookie update")
				}
				return true
			}

			const tokenFromResponse = extractTokenFromResponse(data)
			if (tokenFromResponse) {
				setGlobalToken(tokenFromResponse, "response")
				if (!silent && forceRefresh) {
					console.log("CSRF token refreshed from response payload")
				}
				return true
			}

			if (!silent) {
				console.warn("CSRF token not found after refresh attempt")
			}
			return false
		} catch (error) {
			if (!silent) {
				console.error("Failed to refresh CSRF token:", error)
			}
			return false
		} finally {
			refreshPromise = null
		}
	})()

	return refreshPromise
}

export async function forceRefreshCSRFToken(options = {}) {
	return ensureCSRFToken({ ...options, forceRefresh: true })
}

export function isCSRFApiError(error) {
	if (!error) {
		return false
	}

	if (error.exc_type === "CSRFTokenError") {
		return true
	}

	if (typeof error.message === "string" && error.message.toLowerCase().includes("csrf")) {
		return true
	}

	if (Array.isArray(error.messages)) {
		return error.messages.some(
			(message) => typeof message === "string" && message.toLowerCase().includes("csrf"),
		)
	}

	return false
}

export function createCSRFAwareRequest(originalRequest, { silent = false } = {}) {
	return async function csrfAwareRequest(...args) {
		try {
			return await originalRequest.apply(this, args)
		} catch (error) {
			if (isCSRFApiError(error)) {
				if (!silent) {
					console.warn("CSRF token error detected, refreshing token and retrying...")
				}

				const refreshed = await forceRefreshCSRFToken({ silent })
				if (refreshed) {
					if (!silent) {
						console.log("Retrying request after CSRF token refresh...")
					}
					return await originalRequest.apply(this, args)
				}

				if (!silent) {
					console.warn("CSRF token refresh failed; request will reject with original error")
				}
			}

			throw error
		}
	}
}
