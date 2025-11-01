#!/usr/bin/env node

/**
 * Script to download country flags from flagcdn.com
 * Downloads flags as PNG files (20px width) for the countries we need
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Country codes we need (ISO 3166-1 alpha-2)
const countries = [
	{ code: 'sa', name: 'Saudi Arabia' },
	{ code: 'ae', name: 'UAE' },
	{ code: 'kw', name: 'Kuwait' },
	{ code: 'qa', name: 'Qatar' },
	{ code: 'om', name: 'Oman' },
	{ code: 'bh', name: 'Bahrain' },
	{ code: 'lb', name: 'Lebanon' },
	{ code: 'jo', name: 'Jordan' },
	{ code: 'eg', name: 'Egypt' },
	{ code: 'ma', name: 'Morocco' },
	{ code: 'us', name: 'USA' },
	{ code: 'gb', name: 'UK' },
	{ code: 'fr', name: 'France' },
	{ code: 'de', name: 'Germany' },
	{ code: 'it', name: 'Italy' },
	{ code: 'es', name: 'Spain' },
	{ code: 'in', name: 'India' },
	{ code: 'cn', name: 'China' },
	{ code: 'jp', name: 'Japan' },
	{ code: 'kr', name: 'South Korea' },
	{ code: 'au', name: 'Australia' },
	{ code: 'za', name: 'South Africa' },
]

const flagsDir = path.join(__dirname, '../public/flags')
const flagWidth = 'w20' // 20px width flags

// Ensure flags directory exists
if (!fs.existsSync(flagsDir)) {
	fs.mkdirSync(flagsDir, { recursive: true })
}

function downloadFlag(countryCode) {
	return new Promise((resolve, reject) => {
		const url = `https://flagcdn.com/${flagWidth}/${countryCode}.png`
		const filePath = path.join(flagsDir, `${countryCode}.png`)

		console.log(`Downloading flag for ${countryCode}...`)

		const file = fs.createWriteStream(filePath)

		https.get(url, (response) => {
			if (response.statusCode === 200) {
				response.pipe(file)
				file.on('finish', () => {
					file.close()
					console.log(`✓ Downloaded ${countryCode}.png`)
					resolve()
				})
			} else {
				fs.unlinkSync(filePath) // Delete empty file on error
				reject(new Error(`Failed to download ${countryCode}: ${response.statusCode}`))
			}
		}).on('error', (err) => {
			fs.unlinkSync(filePath) // Delete empty file on error
			reject(err)
		})
	})
}

async function downloadAllFlags() {
	console.log('Starting flag downloads...\n')
	
	const results = {
		success: [],
		failed: []
	}

	for (const country of countries) {
		try {
			await downloadFlag(country.code)
			results.success.push(country.code)
			// Small delay to avoid rate limiting
			await new Promise(resolve => setTimeout(resolve, 100))
		} catch (error) {
			console.error(`✗ Failed to download ${country.code}:`, error.message)
			results.failed.push(country.code)
		}
	}

	console.log('\n' + '='.repeat(50))
	console.log(`Download Summary:`)
	console.log(`✓ Successfully downloaded: ${results.success.length} flags`)
	if (results.failed.length > 0) {
		console.log(`✗ Failed: ${results.failed.length} flags`)
		console.log(`Failed codes: ${results.failed.join(', ')}`)
	}
	console.log('='.repeat(50))
	console.log(`\nFlags saved to: ${flagsDir}`)
}

// Run the download
downloadAllFlags().catch(console.error)

