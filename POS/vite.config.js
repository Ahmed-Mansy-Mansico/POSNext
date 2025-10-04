import path from "node:path"
import vue from "@vitejs/plugin-vue"
import frappeui from "frappe-ui/vite"
import { defineConfig } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"

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
				router: function(req) {
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
