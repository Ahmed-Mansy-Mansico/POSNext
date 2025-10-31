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
								class="w-full"
							/>
						</div>
					</div>
					<!-- Selected Country Info (optional helper text) -->
					<p v-if="getSelectedCountryName()" class="mt-1 text-xs text-gray-500 flex items-center">
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
import { computed, onMounted, onUnmounted, ref, watch } from "vue"

const props = defineProps({
	modelValue: Boolean,
	posProfile: String,
	initialName: String,
})

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

// Reset flag image error state when country code changes
watch(
	() => customerData.value.country_code,
	() => {
		// Reset the error state when country changes, try loading image again
		flagImageFailed.value = false
	}
)

// Watch for dialog open and populate initial name
watch(
	() => props.modelValue,
	(newVal) => {
		if (newVal && props.initialName) {
			customerData.value.customer_name = props.initialName
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
