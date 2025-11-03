<template>
	<Dialog v-model="show" :options="{ title: 'Create New Customer', size: 'md' }">
		<template #body-title>
			<span class="sr-only">Fill in the form to create a new customer</span>
		</template>
		<template #body-content>
			<div class="space-y-4">
				<!-- Customer Name -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Customer Name <span class="text-red-500">*</span>
					</label>
					<Input
						v-model="customerData.customer_name"
						type="text"
						placeholder="Enter customer name"
						required
					/>
				</div>

				<!-- Mobile Number with Country Code -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Mobile Number
					</label>
					<div class="flex space-x-2">
						<!-- Country Code Selector with Beautiful Dropdown -->
						<div class="relative flex-shrink-0" style="width: 180px;" ref="countrySelectorRef">
							<!-- Selected Country Display Button -->
							<button
								type="button"
								@click="toggleCountryDropdown"
								class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer hover:border-blue-400 transition-all duration-200 flex items-center justify-between gap-2 overflow-hidden"
								:class="{ 'ring-2 ring-blue-500 border-blue-400': showCountryDropdown }"
							>
								<!-- Flag and Code Display -->
								<div class="flex items-center gap-2 flex-1 min-w-0">
									<!-- Flag Image with Emoji Fallback -->
									<img 
										v-if="!flagImageFailed"
										:src="getSelectedCountryFlagUrl()" 
										:alt="getSelectedCountryName()"
										class="w-5 h-4 flex-shrink-0 border border-gray-200 rounded object-cover"
										loading="lazy"
										@error="handleFlagImageError"
									/>
									<!-- Emoji Fallback when image fails -->
									<span v-else class="text-lg flex-shrink-0">{{ getSelectedCountryFlagEmoji() }}</span>
									<span class="text-sm font-medium text-gray-900 whitespace-nowrap flex-shrink-0">{{ customerData.country_code }}</span>
								</div>
								<!-- Dropdown Arrow Icon -->
								<svg
									class="h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200"
									:class="{ 'rotate-180': showCountryDropdown }"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</button>
							
							<!-- Beautiful Dropdown Menu -->
							<Transition
								enter-active-class="transition ease-out duration-200"
								enter-from-class="opacity-0 scale-95 -translate-y-2"
								enter-to-class="opacity-100 scale-100 translate-y-0"
								leave-active-class="transition ease-in duration-150"
								leave-from-class="opacity-100 scale-100 translate-y-0"
								leave-to-class="opacity-0 scale-95 -translate-y-2"
							>
								<div
									v-if="showCountryDropdown"
									class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
									style="max-height: 280px;"
								>
									<div class="overflow-y-auto max-h-[280px] custom-scrollbar">
										<button
											v-for="country in countryCodes"
											:key="country.code"
											type="button"
											@click="selectCountry(country)"
											class="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-blue-50 transition-colors duration-150 border-b border-gray-100 last:border-b-0"
											:class="{ 'bg-blue-100 hover:bg-blue-100': customerData.country_code === country.code }"
										>
											<!-- Flag Image -->
											<div class="flex-shrink-0">
												<img 
													v-if="!flagImageFailed"
													:src="getFlagUrl(country.flagCode)" 
													:alt="country.name"
													class="w-6 h-4 border border-gray-200 rounded object-cover"
													loading="lazy"
													@error="handleFlagImageError"
												/>
												<span v-else class="text-2xl">{{ country.flagEmoji }}</span>
											</div>
											<!-- Country Info -->
											<div class="flex-1 min-w-0">
												<div class="text-sm font-medium text-gray-900">{{ country.code }}</div>
												<div class="text-xs text-gray-500 truncate">{{ country.name }}</div>
											</div>
											<!-- Checkmark for Selected -->
											<svg
												v-if="customerData.country_code === country.code"
												class="w-5 h-5 text-blue-600 flex-shrink-0"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M5 13l4 4L19 7"
												/>
											</svg>
										</button>
									</div>
								</div>
							</Transition>
						</div>
						<!-- Mobile Number Input -->
						<div class="flex-1">
							<Input
								v-model="customerData.mobile_no"
								type="text"
								placeholder="Enter mobile number"
								:class="[
									'w-full',
									mobileValidationError ? 'border-red-500 focus:ring-red-500' : ''
								]"
								@input="validateMobileNumber"
							/>
						</div>
					</div>
					<!-- Mobile Validation Error -->
					<p v-if="mobileValidationError" class="mt-1 text-xs text-red-600 flex items-center">
						<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
						</svg>
						{{ mobileValidationError }}
					</p>
					<!-- Selected Country Info (optional helper text) -->
					<p v-if="getSelectedCountryName() && !mobileValidationError" class="mt-1 text-xs text-gray-500 flex items-center">
						<span>Selected:</span>
						<!-- Flag Image with Emoji Fallback -->
						<img 
							v-if="!flagImageFailed"
							:src="getSelectedCountryFlagUrl()" 
							:alt="getSelectedCountryName()"
							class="w-4 h-3 mx-1 border border-gray-200 rounded object-cover"
							loading="lazy"
							@error="handleFlagImageError"
						/>
						<!-- Emoji Fallback when image fails -->
						<span v-else class="mx-1">{{ getSelectedCountryFlagEmoji() }}</span>
						<span>{{ customerData.country_code }} ({{ getSelectedCountryName() }})</span>
					</p>
				</div>

				<!-- Email -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Email
					</label>
					<Input
						v-model="customerData.email_id"
						type="email"
						placeholder="Enter email address"
					/>
				</div>

				<!-- Customer Group -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Customer Group
					</label>
					<select
						v-model="customerData.customer_group"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">Select Customer Group</option>
						<option v-for="group in customerGroups" :key="group" :value="group">
							{{ group }}
						</option>
					</select>
				</div>

				<!-- Territory -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Territory
					</label>
					<select
						v-model="customerData.territory"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">Select Territory</option>
						<option v-for="territory in territories" :key="territory" :value="territory">
							{{ territory }}
						</option>
					</select>
				</div>
			</div>
		</template>

		<template #actions>
			<div class="flex flex-col space-y-2">
				<!-- Permission Warning -->
				<div v-if="!hasPermission" class="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
					<div class="flex items-start space-x-2">
						<svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
						</svg>
						<div class="flex-1">
							<p class="text-sm font-medium text-amber-900">Permission Required</p>
							<p class="text-xs text-amber-700 mt-0.5">You don't have permission to create customers. Contact your administrator.</p>
						</div>
					</div>
				</div>

				<div class="flex space-x-2">
					<Button variant="subtle" @click="show = false">
						Cancel
					</Button>
					<Button
						variant="solid"
						@click="handleCreate"
						:loading="createCustomerResource.loading || checkingPermission"
						:disabled="!customerData.customer_name || !hasPermission"
					>
						Create Customer
					</Button>
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { usePOSPermissions } from "@/composables/usePermissions"
import { Button, Dialog, Input, createResource, toast } from "frappe-ui"
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"

const props = defineProps({
	modelValue: Boolean,
	posProfile: String,
	initialName: String,
	initialPhone: String,
})

// Debug: Log props when they change
watch(
	() => [props.modelValue, props.initialPhone, props.initialName],
	([modelVal, phone, name]) => {
		console.log("📋 CreateCustomerDialog props:", { modelVal, phone, name })
	},
	{ immediate: true }
)

const emit = defineEmits(["update:modelValue", "customer-created"])

// Permission check
const { canCreateCustomer } = usePOSPermissions()
const hasPermission = ref(true)
const checkingPermission = ref(false)

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit("update:modelValue", val),
})
const creating = ref(false)
const customerGroups = ref([
	"Commercial",
	"Individual",
	"Non Profit",
	"Government",
])
const territories = ref(["All Territories"])

// Country codes with flag codes and emoji fallbacks (prioritizing Saudi Arabia first)
// Using ISO 3166-1 alpha-2 country codes for local flags (offline support)
const countryCodes = [
	{ code: "+966", flagCode: "sa", flagEmoji: "🇸🇦", name: "Saudi Arabia" },
	{ code: "+971", flagCode: "ae", flagEmoji: "🇦🇪", name: "UAE" },
	{ code: "+965", flagCode: "kw", flagEmoji: "🇰🇼", name: "Kuwait" },
	{ code: "+974", flagCode: "qa", flagEmoji: "🇶🇦", name: "Qatar" },
	{ code: "+968", flagCode: "om", flagEmoji: "🇴🇲", name: "Oman" },
	{ code: "+973", flagCode: "bh", flagEmoji: "🇧🇭", name: "Bahrain" },
	{ code: "+961", flagCode: "lb", flagEmoji: "🇱🇧", name: "Lebanon" },
	{ code: "+962", flagCode: "jo", flagEmoji: "🇯🇴", name: "Jordan" },
	{ code: "+20", flagCode: "eg", flagEmoji: "🇪🇬", name: "Egypt" },
	{ code: "+212", flagCode: "ma", flagEmoji: "🇲🇦", name: "Morocco" },
	{ code: "+1", flagCode: "us", flagEmoji: "🇺🇸", name: "USA/Canada" },
	{ code: "+44", flagCode: "gb", flagEmoji: "🇬🇧", name: "UK" },
	{ code: "+33", flagCode: "fr", flagEmoji: "🇫🇷", name: "France" },
	{ code: "+49", flagCode: "de", flagEmoji: "🇩🇪", name: "Germany" },
	{ code: "+39", flagCode: "it", flagEmoji: "🇮🇹", name: "Italy" },
	{ code: "+34", flagCode: "es", flagEmoji: "🇪🇸", name: "Spain" },
	{ code: "+91", flagCode: "in", flagEmoji: "🇮🇳", name: "India" },
	{ code: "+86", flagCode: "cn", flagEmoji: "🇨🇳", name: "China" },
	{ code: "+81", flagCode: "jp", flagEmoji: "🇯🇵", name: "Japan" },
	{ code: "+82", flagCode: "kr", flagEmoji: "🇰🇷", name: "South Korea" },
	{ code: "+61", flagCode: "au", flagEmoji: "🇦🇺", name: "Australia" },
	{ code: "+27", flagCode: "za", flagEmoji: "🇿🇦", name: "South Africa" },
]

// Track image load failures to use emoji fallback
const flagImageFailed = ref(false)

// Country dropdown state
const showCountryDropdown = ref(false)
const countrySelectorRef = ref(null)

// Helper function to get flag URL - uses local flags from public directory
function getFlagUrl(flagCode) {
	// Use flags from public/flags directory (served directly, works offline)
	// In dev: /flags/{code}.png
	// In production: /assets/pos_next/pos/flags/{code}.png
	// Vite will copy public/flags to build output
	
	// Base path depends on environment
	const basePath = import.meta.env.PROD 
		? '/assets/pos_next/pos' 
		: ''
	
	return `${basePath}/flags/${flagCode}.png`
}

const customerData = ref({
	customer_name: "",
	mobile_no: "",
	country_code: "+966", // Default to Saudi Arabia
	email_id: "",
	customer_group: "",
	territory: "",
})

// Mobile number validation error message
const mobileValidationError = ref("")

// Phone number validation patterns by country code
// Format: { countryCode: { pattern: regex, message: error message, example: example format } }
const phoneValidationPatterns = {
	"+966": {
		// Saudi Arabia: Mobile numbers only
		// Mobile: 5X XXXXXXX (50-59 followed by 7 digits = 9 digits, or 05X + 7 digits = 10 digits with leading 0)
		// Examples: 540562793, 551552999, 570851040, 0501234567, 501234567
		pattern: /^0?5[0-9]\d{7}$/,
		message: "Saudi Arabia mobile numbers must start with 5 (50-59) followed by 7 digits (e.g., 0501234567 or 501234567)",
		example: "0501234567"
	},
	"+20": {
		// Egypt: Mobile numbers start with 01 followed by 9 digits (11 digits total)
		// Format: 01XXXXXXXXX (e.g., 01012345678, 01091710358)
		// Second digit after 0 can be 0, 1, 2, or 5
		pattern: /^0?1[0125]\d{8}$/,
		message: "Egypt mobile numbers must start with 01 followed by 9 digits (e.g., 01012345678). The second digit must be 0, 1, 2, or 5.",
		example: "01012345678"
	},
	"+971": {
		// UAE: Mobile numbers only
		// Mobile: 050, 052, 054, 055, 056, 058 (5X where X is even or 5) followed by 7 digits (9 digits total, or 10 with leading 0)
		// Examples: 501234567, 551234567, 0501234567
		pattern: /^0?5[024568]\d{7}$/,
		message: "UAE mobile numbers must start with 50, 52, 54, 55, 56, or 58 followed by 7 digits (e.g., 0501234567 or 501234567)",
		example: "0501234567"
	},
	"+965": {
		// Kuwait: Mobile numbers only
		// Mobile: 5, 6, 9 followed by 7 digits (8 digits total, or 9 with leading 0)
		// Examples: 51234567, 61234567, 91234567, 051234567
		pattern: /^0?[569]\d{7}$/,
		message: "Kuwait mobile numbers must start with 5, 6, or 9 followed by 7 digits (e.g., 51234567 or 051234567)",
		example: "51234567"
	},
	"+974": {
		// Qatar: Mobile numbers only
		// Mobile: 3, 5, 6, 7 followed by 7 digits (8 digits total, or 9 with leading 0)
		// Examples: 33123456, 55123456, 033123456
		pattern: /^0?[3567]\d{7}$/,
		message: "Qatar mobile numbers must start with 3, 5, 6, or 7 followed by 7 digits (e.g., 33123456 or 033123456)",
		example: "33123456"
	},
	"+968": {
		// Oman: Mobile numbers only
		// Mobile: 9 followed by 7 digits (8 digits total, or 9 with leading 0)
		// Examples: 91234567, 091234567
		pattern: /^0?9\d{7}$/,
		message: "Oman mobile numbers must start with 9 followed by 7 digits (e.g., 91234567 or 091234567)",
		example: "91234567"
	},
	"+973": {
		// Bahrain: Mobile numbers only
		// Mobile: 3 followed by 7 digits (8 digits total, or 9 with leading 0)
		// Examples: 31234567, 031234567
		pattern: /^0?3\d{7}$/,
		message: "Bahrain mobile numbers must start with 3 followed by 7 digits (e.g., 31234567 or 031234567)",
		example: "31234567"
	},
	"+961": {
		// Lebanon: Mobile numbers only
		// Mobile: 3, 7, 70, 71, 76, 78, 79, 81 followed by 6-7 digits
		// Examples: 3123456, 70123456, 703123456
		pattern: /^0?([37]\d{6,7}|70\d{6}|71\d{6}|76\d{6}|78\d{6}|79\d{6}|81\d{6})$/,
		message: "Lebanon mobile numbers must start with 3, 7, 70, 71, 76, 78, 79, or 81 followed by 6-7 digits (e.g., 3123456 or 70123456)",
		example: "3123456"
	},
	"+962": {
		// Jordan: Mobile numbers only
		// Mobile: 7 followed by 8 digits (9 digits total, or 10 with leading 0)
		// Examples: 712345678, 0712345678
		pattern: /^0?7\d{8}$/,
		message: "Jordan mobile numbers must start with 7 followed by 8 digits (e.g., 712345678 or 0712345678)",
		example: "712345678"
	},
	"+212": {
		// Morocco: Mobile numbers only
		// Mobile: 6, 7 followed by 8 digits (9 digits total, or 10 with leading 0)
		// Examples: 612345678, 712345678, 0612345678
		pattern: /^0?[67]\d{8}$/,
		message: "Morocco mobile numbers must start with 6 or 7 followed by 8 digits (e.g., 612345678 or 0612345678)",
		example: "612345678"
	},
	"+1": {
		// USA/Canada: 10 digits total (no leading 0)
		// Area code: 2-9 followed by 2 digits, exchange: 2-9 followed by 6 digits
		// Format: NXX-NXX-XXXX where N=2-9, X=0-9
		// Examples: 2125551234, 4161234567, 6041234567
		pattern: /^[2-9]\d{2}[2-9]\d{6}$/,
		message: "USA/Canada: 10 digits (XXX-XXX-XXXX). Area code and exchange cannot start with 0 or 1.",
		example: "2125551234"
	},
	"+44": {
		// UK: Mobile numbers only
		// Mobile: 7 followed by 9 digits (10 digits total with leading 0, or 9 without)
		// Examples: 7123456789, 07123456789
		pattern: /^0?7\d{9}$/,
		message: "UK mobile numbers must start with 7 followed by 9 digits (e.g., 7123456789 or 07123456789)",
		example: "7123456789"
	},
	"+33": {
		// France: Mobile numbers only
		// Mobile: 6, 7 followed by 8 digits (9 digits total, or 10 with leading 0)
		// Examples: 612345678, 712345678, 0612345678
		pattern: /^0?[67]\d{8}$/,
		message: "France mobile numbers must start with 6 or 7 followed by 8 digits (e.g., 612345678 or 0612345678)",
		example: "612345678"
	},
	"+49": {
		// Germany: Mobile numbers only
		// Mobile: 15, 16, 17 followed by 8-9 digits (11-12 digits total, or 12-13 with leading 0)
		// Examples: 15123456789, 16123456789, 17123456789, 015123456789
		pattern: /^0?1[567]\d{8,9}$/,
		message: "Germany mobile numbers must start with 15, 16, or 17 followed by 8-9 digits (e.g., 15123456789 or 015123456789)",
		example: "15123456789"
	},
	"+39": {
		// Italy: Mobile numbers only
		// Mobile: 3 followed by 9 digits (10 digits total, or 11 with leading 0)
		// Examples: 3123456789, 03123456789
		pattern: /^0?3\d{9}$/,
		message: "Italy mobile numbers must start with 3 followed by 9 digits (e.g., 3123456789 or 03123456789)",
		example: "3123456789"
	},
	"+34": {
		// Spain: Mobile numbers only
		// Mobile: 6, 7 followed by 8 digits (9 digits total, or 10 with leading 0)
		// Examples: 612345678, 712345678, 0612345678
		pattern: /^0?[67]\d{8}$/,
		message: "Spain mobile numbers must start with 6 or 7 followed by 8 digits (e.g., 612345678 or 0612345678)",
		example: "612345678"
	},
	"+91": {
		// India: Mobile numbers start with 6, 7, 8, or 9 followed by 9 digits (10 digits total)
		pattern: /^0?[6789]\d{9}$/,
		message: "India mobile numbers must start with 6, 7, 8, or 9 followed by 9 digits (e.g., 9123456789)",
		example: "9123456789"
	},
	"+86": {
		// China: Mobile numbers start with 1 followed by 10 digits (11 digits total, first digit after 1 is 3-9)
		pattern: /^0?1[3-9]\d{9}$/,
		message: "China mobile numbers must start with 1 followed by 10 digits (e.g., 13812345678)",
		example: "13812345678"
	},
	"+81": {
		// Japan: Mobile numbers only
		// Mobile: 70, 80, 90 followed by 8 digits (10 digits total, or 11 with leading 0)
		// Examples: 7012345678, 8012345678, 9012345678, 09012345678
		pattern: /^0?[789]0\d{8}$/,
		message: "Japan mobile numbers must start with 70, 80, or 90 followed by 8 digits (e.g., 9012345678 or 09012345678)",
		example: "9012345678"
	},
	"+82": {
		// South Korea: Mobile numbers only
		// Mobile: 10X (where X=0-9) followed by 7-8 digits (10-11 digits total, or 11-12 with leading 0)
		// Examples: 1012345678, 10212345678, 01012345678
		pattern: /^0?10\d{7,8}$/,
		message: "South Korea mobile numbers must start with 10 followed by 7-8 digits (e.g., 1012345678 or 01012345678)",
		example: "1012345678"
	},
	"+61": {
		// Australia: Mobile numbers only
		// Mobile: 4 followed by 8 digits (9 digits total, or 10 with leading 0)
		// Examples: 412345678, 0412345678
		pattern: /^0?4\d{8}$/,
		message: "Australia mobile numbers must start with 4 followed by 8 digits (e.g., 412345678 or 0412345678)",
		example: "412345678"
	},
	"+27": {
		// South Africa: Mobile numbers only
		// Mobile: 6, 7, 8 followed by 8 digits (9 digits total, or 10 with leading 0)
		// Examples: 612345678, 712345678, 812345678, 0612345678
		pattern: /^0?[678]\d{8}$/,
		message: "South Africa mobile numbers must start with 6, 7, or 8 followed by 8 digits (e.g., 612345678 or 0612345678)",
		example: "612345678"
	},
}

// Validate mobile number based on selected country code
function validateMobileNumber() {
	const mobileNo = customerData.value.mobile_no.trim()
	const countryCode = customerData.value.country_code
	
	// Clear error if mobile number is empty
	if (!mobileNo) {
		mobileValidationError.value = ""
		return true
	}
	
	// Get validation pattern for the selected country
	const validation = phoneValidationPatterns[countryCode]
	
	if (!validation) {
		// No validation pattern for this country - allow it
		mobileValidationError.value = ""
		return true
	}
	
	// Remove spaces and special characters except digits
	let cleanNumber = mobileNo.replace(/\s+/g, "").replace(/[^\d]/g, "")
	
	// Remove leading 0 if present (common in many countries)
	if (cleanNumber.startsWith("0")) {
		cleanNumber = cleanNumber.substring(1)
	}
	
	// Test against pattern
	if (!validation.pattern.test(cleanNumber)) {
		mobileValidationError.value = validation.message
		return false
	}
	
	// Valid number
	mobileValidationError.value = ""
	return true
}

// Reset flag image error state when country code changes
watch(
	() => customerData.value.country_code,
	() => {
		// Reset the error state when country changes, try loading image again
		flagImageFailed.value = false
		// Re-validate mobile number when country code changes
		validateMobileNumber()
	}
)

// Helper function to extract country code from phone number
function extractCountryCodeFromPhone(phoneNumber) {
	if (!phoneNumber) return { countryCode: "+966", phone: "" }
	
	let cleanPhone = phoneNumber.trim().replace(/[^\d+]/g, "")
	
	// If it starts with +, extract country code directly
	if (cleanPhone.startsWith("+")) {
		const match = cleanPhone.match(/^\+(\d{1,3})/)
		if (match) {
			const code = "+" + match[1]
			const remainingPhone = cleanPhone.substring(code.length)
			const phone = remainingPhone.startsWith("0") ? remainingPhone.substring(1) : remainingPhone
			return { countryCode: code, phone }
		}
	}
	
	// Auto-detect from pattern (number-based detection)
	const originalPhone = phoneNumber.trim()
	let detectedCode = "+966" // Default
	
	// Egyptian pattern: 01 (11 digits total with leading 0)
	if (originalPhone.match(/^0?1[0-2]\d{8}$/)) {
		detectedCode = "+20" // Egypt
	}
	// Saudi Arabia pattern: 05 (9 digits total with leading 0)
	else if (originalPhone.match(/^0?5[0-9]\d{7}$/) && !originalPhone.match(/^0?5[024568]\d{7}$/)) {
		detectedCode = "+966" // Saudi Arabia
	}
	// UAE pattern: 050/052/054/055/056/058
	else if (originalPhone.match(/^0?5[024568]\d{7}$/)) {
		detectedCode = "+971" // UAE
	}
	// Kuwait pattern: starts with 5/6/9 (8 digits total)
	else if (originalPhone.match(/^0?[569]\d{7}$/)) {
		detectedCode = "+965" // Kuwait
	}
	
	// Remove leading zero and any non-digit characters
	const phone = cleanPhone.replace(/^0/, "").replace(/\D/g, "")
	
	return { countryCode: detectedCode, phone }
}

/**
 * Set initial data from props when dialog opens
 * Priority: Phone number > Customer name
 * 
 * Use cases covered:
 * 1. Phone number search (e.g., "056565666") → Sets mobile number, clears customer name
 * 2. Name search (e.g., "John Doe") → Sets customer name, clears mobile number
 * 3. Empty search → Both fields remain empty
 */
function setInitialData() {
	console.log("📋 setInitialData called with:", { 
		initialPhone: props.initialPhone, 
		initialName: props.initialName,
		modelValue: props.modelValue 
	})
	
	if (!props.modelValue) return
	
	// CRITICAL: If initialPhone exists, it takes priority (most common use case)
	if (props.initialPhone) {
		console.log("📱 Setting phone from initialPhone:", props.initialPhone)
		const { countryCode, phone } = extractCountryCodeFromPhone(props.initialPhone)
		// Set phone fields
		customerData.value.country_code = countryCode
		customerData.value.mobile_no = phone
		// CRITICAL: Clear customer name - phone number should NEVER go in customer name
		customerData.value.customer_name = ""
		console.log("✅ Phone set:", { countryCode, phone, customerName: customerData.value.customer_name })
	} else if (props.initialName) {
		// Second most common use case: Name search → set customer name
		console.log("📝 Setting name from initialName:", props.initialName)
		customerData.value.customer_name = props.initialName
		// Clear phone when name is provided
		customerData.value.mobile_no = ""
		customerData.value.country_code = "+966" // Reset to default
	}
	// If neither is provided, both fields remain empty (user starts fresh)
}

// Watch for dialog open and populate initial data
watch(
	() => props.modelValue,
	(newVal) => {
		if (newVal) {
			// Use nextTick to ensure props are fully set before setting initial data
			nextTick(() => {
				setInitialData()
			})
		} else if (!newVal) {
			// Reset form when dialog closes
			customerData.value = {
				customer_name: "",
				mobile_no: "",
				country_code: "+966", // Reset to Saudi Arabia
				email_id: "",
				customer_group: "",
				territory: "",
			}
			// Close dropdown when dialog closes
			showCountryDropdown.value = false
		}
	},
)

// Watch initialPhone directly - this is CRITICAL for when dialog opens with phone
watch(
	() => props.initialPhone,
	(initialPhone, oldPhone) => {
		console.log("📱 initialPhone prop watcher triggered:", { 
			newValue: initialPhone, 
			oldValue: oldPhone,
			modelValue: props.modelValue,
			initialName: props.initialName
		})
		if (props.modelValue) {
			setInitialData()
		}
	},
	{ immediate: true }
)

// Watch initialName to ensure it doesn't override phone
watch(
	() => props.initialName,
	(initialName) => {
		// Only set name if dialog is open, no phone was provided, and name exists
		if (props.modelValue && !props.initialPhone && initialName) {
			console.log("📝 initialName prop changed (no phone):", initialName)
			customerData.value.customer_name = initialName
			// Clear phone when name is provided
			customerData.value.mobile_no = ""
		}
	},
)

// Helper function to handle flag image loading errors
function handleFlagImageError(event) {
	// If local flag fails to load, use emoji fallback (no internet requests)
	// Flags are in public/flags/ and should always be available offline
	flagImageFailed.value = true
}

// Helper function to get selected country flag URL
function getSelectedCountryFlagUrl() {
	const selected = countryCodes.find((c) => c.code === customerData.value.country_code)
	return getFlagUrl(selected ? selected.flagCode : "sa")
}

// Helper function to get selected country flag emoji (fallback)
function getSelectedCountryFlagEmoji() {
	const selected = countryCodes.find((c) => c.code === customerData.value.country_code)
	return selected ? selected.flagEmoji : "🇸🇦"
}

// Helper function to get selected country name
function getSelectedCountryName() {
	const selected = countryCodes.find((c) => c.code === customerData.value.country_code)
	return selected ? selected.name : "Saudi Arabia"
}

// Country dropdown functions
function toggleCountryDropdown() {
	showCountryDropdown.value = !showCountryDropdown.value
}

function selectCountry(country) {
	customerData.value.country_code = country.code
	showCountryDropdown.value = false
	// Reset flag image error state when selecting a new country
	flagImageFailed.value = false
}

// Close dropdown when clicking outside
function handleClickOutside(event) {
	if (countrySelectorRef.value && !countrySelectorRef.value.contains(event.target)) {
		showCountryDropdown.value = false
	}
}

// Helper function to combine country code with mobile number
function getFullMobileNumber() {
	if (!customerData.value.mobile_no) {
		return ""
	}
	// Remove any existing country code from the mobile number
	let mobileNo = customerData.value.mobile_no.trim()
	
	// Remove leading + if present
	if (mobileNo.startsWith("+")) {
		mobileNo = mobileNo.substring(1)
	}
	
	// Remove spaces and special characters except digits
	mobileNo = mobileNo.replace(/\s+/g, "").replace(/[^\d]/g, "")
	
	// If the number already starts with the country code, don't duplicate it
	const countryCodeDigits = customerData.value.country_code.replace(/[^\d]/g, "")
	if (mobileNo.startsWith(countryCodeDigits)) {
		return customerData.value.country_code + mobileNo.substring(countryCodeDigits.length)
	}
	
	// Combine country code with mobile number
	return customerData.value.country_code + mobileNo
}

// Create customer resource
const createCustomerResource = createResource({
	url: "frappe.client.insert",
	makeParams() {
		const fullMobileNumber = getFullMobileNumber()
		
		return {
			doc: {
				doctype: "Customer",
				customer_name: customerData.value.customer_name,
				customer_type: "Individual",
				customer_group: customerData.value.customer_group,
				territory: customerData.value.territory,
				mobile_no: fullMobileNumber || "",
				email_id: customerData.value.email_id || "",
			},
		}
	},
	onSuccess(data) {
		toast.create({
			title: "Success",
			text: `Customer ${data.customer_name} created successfully`,
			icon: "check",
			iconClasses: "text-green-600",
		})

		emit("customer-created", data)
		show.value = false
	},
	onError(error) {
		console.error("Error creating customer:", error)
		toast.create({
			title: "Error",
			text: error.message || "Failed to create customer",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	},
})

// Customer groups resource
const customerGroupsResource = createResource({
	url: "frappe.client.get_list",
	makeParams() {
		return {
			doctype: "Customer Group",
			fields: ["name"],
			filters: { is_group: 0 },
			limit_page_length: 100,
		}
	},
	auto: false,
	onSuccess(data) {
		if (data && data.length > 0) {
			customerGroups.value = data.map((g) => g.name)
		}
	},
	onError(error) {
		console.error("Error loading customer groups:", error)
	},
})

// Territories resource
const territoriesResource = createResource({
	url: "frappe.client.get_list",
	makeParams() {
		return {
			doctype: "Territory",
			fields: ["name"],
			filters: { is_group: 0 },
			limit_page_length: 100,
		}
	},
	auto: false,
	onSuccess(data) {
		if (data && data.length > 0) {
			territories.value = data.map((t) => t.name)
		}
	},
	onError(error) {
		console.error("Error loading territories:", error)
	},
})

watch(
	() => props.modelValue,
	(val) => {
		show.value = val
		if (val) {
			// Load data when dialog opens
			customerGroupsResource.reload()
			territoriesResource.reload()
			checkPermissions()
			// IMPORTANT: Do NOT reset form here - let the other watch handle initial data
		} else {
			resetForm()
		}
	},
)

watch(show, (val) => {
	emit("update:modelValue", val)
})

onMounted(() => {
	// Initial load
	customerGroupsResource.reload()
	territoriesResource.reload()
	checkPermissions()
	// Add click outside listener for country dropdown
	document.addEventListener("click", handleClickOutside)
})

onUnmounted(() => {
	// Remove click outside listener
	document.removeEventListener("click", handleClickOutside)
})

async function checkPermissions() {
	checkingPermission.value = true
	try {
		hasPermission.value = await canCreateCustomer()
	} catch (error) {
		console.error("Error checking customer create permission:", error)
		hasPermission.value = false
	} finally {
		checkingPermission.value = false
	}
}

async function handleCreate() {
	if (!customerData.value.customer_name) {
		toast.create({
			title: "Required Field",
			text: "Customer Name is required",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
		return
	}

	// Validate mobile number if provided
	if (customerData.value.mobile_no && !validateMobileNumber()) {
		toast.create({
			title: "Invalid Mobile Number",
			text: mobileValidationError.value || "The entered mobile number does not match the format for the selected country code.",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
		return
	}

	// Use the resource to submit
	await createCustomerResource.submit()
}

function resetForm() {
	customerData.value = {
		customer_name: "",
		mobile_no: "",
		country_code: "+966", // Reset to Saudi Arabia
		email_id: "",
		customer_group: "",
		territory: "",
	}
}
</script>

<style scoped>
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border-width: 0;
}

/* Custom scrollbar for country dropdown */
.custom-scrollbar::-webkit-scrollbar {
	width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
	background: #f3f4f6;
	border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
	background: #d1d5db;
	border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
	background: #9ca3af;
}
</style>
