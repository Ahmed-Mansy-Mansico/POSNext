import { io } from "socket.io-client"
import { socketio_port } from "../../../../sites/common_site_config.json"

let socket = null
export function initSocket() {
	try {
		const host = window.location.hostname
		const siteName = window.site_name || window.location.hostname
		const port = window.location.port ? `:${socketio_port}` : ""
		const protocol = port ? "http" : "https"
		const url = `${protocol}://${host}${port}/${siteName}`

		console.log("Initializing socket connection to:", url)

		socket = io(url, {
			withCredentials: true,
			reconnectionAttempts: 5,
			autoConnect: false, // Don't auto-connect, we'll connect manually when ready
		})

		// Connect with error handling
		socket.on("connect_error", (error) => {
			console.warn("Socket connection error:", error.message)
		})

		socket.on("connect", () => {
			console.log("Socket connected successfully")
		})

		// Attempt connection
		socket.connect()

		return socket
	} catch (error) {
		console.error("Failed to initialize socket:", error)
		// Return a mock socket object to prevent crashes
		return {
			on: () => {},
			emit: () => {},
			connect: () => {},
			disconnect: () => {},
		}
	}
}

export function useSocket() {
	return socket
}
