import path from "node:path"
import vue from "@vitejs/plugin-vue"
import frappeui from "frappe-ui/vite"
import { defineConfig } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"
import { VitePWA } from "vite-plugin-pwa"

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		frappeui({
			frappeProxy: true,
			jinjaBootData: true,
			lucideIcons: true,
			buildConfig: {
				indexHtmlPath: "../pos_next/www/pos.html",
				outDir: "../pos_next/public/pos",
				emptyOutDir: true,
				sourcemap: true,
			},
		}),
		vue(),
		viteStaticCopy({
			targets: [
				{
					src: "src/workers",
					dest: ".",
				},
			],
		}),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.png', 'icon.svg', 'icon-maskable.svg'],
			manifest: {
				name: 'POSNext',
				short_name: 'POSNext',
				description: 'Point of Sale system with real-time billing, stock management, and offline support',
				theme_color: '#4F46E5',
				background_color: '#ffffff',
				display: 'standalone',
				scope: '/assets/pos_next/pos/',
				start_url: '/pos',
				icons: [
					{
						src: '/assets/pos_next/pos/icon.svg',
						sizes: '192x192',
						type: 'image/svg+xml',
						purpose: 'any'
					},
					{
						src: '/assets/pos_next/pos/icon.svg',
						sizes: '512x512',
						type: 'image/svg+xml',
						purpose: 'any'
					},
					{
						src: '/assets/pos_next/pos/icon-maskable.svg',
						sizes: '192x192',
						type: 'image/svg+xml',
						purpose: 'maskable'
					},
					{
						src: '/assets/pos_next/pos/icon-maskable.svg',
						sizes: '512x512',
						type: 'image/svg+xml',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 3 MB
				navigateFallback: null,
				navigateFallbackDenylist: [/^\/api/, /^\/app/],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'gstatic-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					},
					{
						urlPattern: /\/assets\/pos_next\/pos\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'pos-assets-cache',
							expiration: {
								maxEntries: 500,
								maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
							}
						}
					},
					{
						urlPattern: /\/api\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							networkTimeoutSeconds: 10,
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24 // 24 hours
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					},
					{
						urlPattern: ({ request, url }) => request.mode === 'navigate' && url.pathname.startsWith('/pos'),
						handler: 'NetworkFirst',
						options: {
							cacheName: 'pos-page-cache',
							networkTimeoutSeconds: 3,
							expiration: {
								maxEntries: 1,
								maxAgeSeconds: 60 * 60 * 24, // 24 hours
							}
						}
					}
				],
				cleanupOutdatedCaches: true,
				skipWaiting: true,
				clientsClaim: true
			},
			devOptions: {
				enabled: true,
				type: 'module'
			}
		})
	],
	build: {
		chunkSizeWarningLimit: 1500,
		outDir: "../pos_next/public/pos",
		emptyOutDir: true,
		target: "es2015",
		sourcemap: true,
	},
	worker: {
		format: "es",
		rollupOptions: {
			output: {
				format: "es"
			}
		}
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
			"tailwind.config.js": path.resolve(__dirname, "tailwind.config.js"),
		},
	},
	optimizeDeps: {
		include: ["feather-icons", "showdown", "highlight.js/lib/core", "interactjs"],
	},
	server: {
		allowedHosts: true,
		port: 8080,
		proxy: {
			'^/(app|api|assets|files)': {
				target: 'http://127.0.0.1:8000',
				ws: true,
				changeOrigin: true,
				secure: false,
				cookieDomainRewrite: 'localhost',
				router: function (req) {
					const site_name = req.headers.host.split(':')[0];
					// Support both localhost and 127.0.0.1
					const isLocalhost = site_name === 'localhost' || site_name === '127.0.0.1';
					const targetHost = isLocalhost ? '127.0.0.1' : site_name;
					return `http://${targetHost}:8000`;
				}
			}
		}
	},
})
