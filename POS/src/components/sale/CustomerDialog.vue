<template>
	<Dialog v-model="show" :options="{ title: 'Select Customer', size: 'md' }">
		<template #body-title>
			<span class="sr-only">Search and select a customer for the transaction</span>
		</template>
		<template #body-content>
			<div class="space-y-4">
				<!-- Search Input -->
				<div>
					<Input
						v-model="searchTerm"
						type="text"
						placeholder="Search customers by name, mobile, or email..."
						class="w-full"
						@keydown="handleKeydown"
						autofocus
					>
						<template #prefix>
							<svg
								class="h-5 w-5 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
						</template>
						<template #suffix v-if="searchTerm">
							<button @click="searchTerm = ''" class="text-gray-400 hover:text-gray-600">
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
								</svg>
							</button>
						</template>
					</Input>
					<p v-if="!loading && allCustomers.length > 0" class="text-xs text-gray-500 mt-1">
						{{ customers.length }} of {{ allCustomers.length }} customers
						<span v-if="customers.length > 0" class="text-gray-400">• Use ↑↓ to navigate, Enter to select</span>
					</p>
				</div>

				<!-- Customers List -->
				<div class="max-h-96 overflow-y-auto">
					<div v-if="loading" class="text-center py-8">
						<div
							class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"
						></div>
						<p class="mt-2 text-sm text-gray-500">Loading customers...</p>
					</div>

					<div
						v-else-if="allCustomers.length === 0 && !loading"
						class="text-center py-8"
					>
						<svg
							class="mx-auto h-12 w-12 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
							/>
						</svg>
						<p class="mt-2 text-sm text-gray-500">No customers available</p>
						<p class="text-xs text-gray-400 mt-1">
							Create your first customer to get started
						</p>
					</div>

					<div
						v-else-if="customers.length === 0 && searchTerm.trim().length > 0"
						class="text-center py-8"
					>
						<svg
							class="mx-auto h-12 w-12 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						<p class="mt-2 text-sm text-gray-500">No customers found for "{{ searchTerm }}"</p>
						<p class="text-xs text-gray-400 mt-1">
							Try a different search term or create a new customer
						</p>
					</div>

					<div v-else class="space-y-2">
						<button
							v-for="(customer, index) in customers"
							:key="customer.name"
							@click="selectCustomer(customer)"
							:class="[
								'w-full text-left p-3 rounded-lg border transition-all duration-75',
								index === selectedIndex
									? 'border-blue-500 bg-blue-50 shadow-sm'
									: 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
							]"
						>
							<div class="flex items-start justify-between">
								<div class="flex-1 min-w-0">
									<div class="font-semibold text-sm text-gray-900 truncate">
										{{ customer.customer_name }}
									</div>
									<div class="text-xs text-gray-600 mt-1 space-x-2">
										<span v-if="customer.mobile_no">📱 {{ customer.mobile_no }}</span>
										<span v-if="customer.email_id">✉️ {{ customer.email_id }}</span>
									</div>
									<div v-if="customer.customer_group" class="text-xs text-gray-500 mt-1">
										{{ customer.customer_group }}
									</div>
								</div>
								<div v-if="index === selectedIndex" class="ml-2 flex-shrink-0">
									<svg class="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
									</svg>
								</div>
							</div>
						</button>
					</div>
				</div>

				<!-- Create New Customer Link -->
				<div class="pt-4 border-t border-gray-200">
					<button
						@click="createNewCustomer"
						class="w-full py-2 px-4 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
					>
						+ Create New Customer
					</button>
				</div>
			</div>
		</template>

		<template #actions>
			<Button variant="subtle" @click="show = false">Cancel</Button>
		</template>
	</Dialog>

	<!-- Create Customer Dialog -->
	<CreateCustomerDialog
		v-model="showCreateDialog"
		:pos-profile="posProfile"
		@customer-created="handleCustomerCreated"
	/>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue"
import { Dialog, Input, Button } from "frappe-ui"
import CreateCustomerDialog from "./CreateCustomerDialog.vue"
import { isOffline } from "@/utils/offline"
import { offlineWorker } from "@/utils/offline/workerClient"
import { call } from "@/utils/apiWrapper"

const props = defineProps({
	modelValue: Boolean,
	posProfile: String,
})

const emit = defineEmits(["update:modelValue", "customer-selected"])

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit("update:modelValue", val),
})

const searchTerm = ref("")
const allCustomers = ref([])
const showCreateDialog = ref(false)
const loading = ref(false)
const selectedIndex = ref(-1)

// Real-time filtered customers - instant results!
const customers = computed(() => {
	const startTime = performance.now()
	const term = searchTerm.value.trim().toLowerCase()

	if (!term) {
		const result = allCustomers.value.slice(0, 50)
		const elapsed = performance.now() - startTime
		console.log(`⚡ Computed ${result.length} customers in ${elapsed.toFixed(2)}ms`)
		return result
	}

	// Instant in-memory filtering
	const filtered = allCustomers.value.filter(cust => {
		const name = (cust.customer_name || '').toLowerCase()
		const mobile = (cust.mobile_no || '').toLowerCase()
		const email = (cust.email_id || '').toLowerCase()
		const id = (cust.name || '').toLowerCase()

		return name.includes(term) ||
		       mobile.includes(term) ||
		       email.includes(term) ||
		       id.includes(term)
	}).slice(0, 50)

	const elapsed = performance.now() - startTime
	console.log(`⚡ Filtered ${filtered.length} customers in ${elapsed.toFixed(2)}ms (search: "${term}")`)
	return filtered
})

// Load all customers into memory once
async function loadAllCustomers() {
	if (!props.posProfile) {
		return
	}

	loading.value = true
	try {
		// Try to get from worker cache first
		const cachedCustomers = await offlineWorker.searchCachedCustomers("", 9999)

		if (cachedCustomers && cachedCustomers.length > 0) {
			allCustomers.value = cachedCustomers
			console.log(`✓ Loaded ${cachedCustomers.length} customers for instant search`)
		} else if (!isOffline()) {
			// Fetch from server if cache is empty
			const response = await call("pos_next.api.customers.get_customers", {
				pos_profile: props.posProfile,
				search_term: "",
				start: 0,
				limit: 9999,
			})
			const list = response?.message || response || []
			allCustomers.value = list

			// Cache for future use
			if (list.length) {
				await offlineWorker.cacheCustomers(list)
			}
			console.log(`✓ Loaded ${list.length} customers for instant search`)
		}
	} catch (error) {
		console.error("Error loading customers:", error)
		allCustomers.value = []
	} finally {
		loading.value = false
	}
}

// Reset selection when results change
watch(customers, () => {
	selectedIndex.value = -1
})

// Load customers when dialog opens
watch(show, (newVal) => {
	if (newVal) {
		searchTerm.value = ""
		if (allCustomers.value.length === 0) {
			loadAllCustomers()
		}
	}
})

// Keyboard navigation
function handleKeydown(event) {
	if (customers.value.length === 0) return

	if (event.key === 'ArrowDown') {
		event.preventDefault()
		selectedIndex.value = Math.min(selectedIndex.value + 1, customers.value.length - 1)
	} else if (event.key === 'ArrowUp') {
		event.preventDefault()
		selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
	} else if (event.key === 'Enter') {
		event.preventDefault()
		if (selectedIndex.value >= 0 && selectedIndex.value < customers.value.length) {
			selectCustomer(customers.value[selectedIndex.value])
		} else if (customers.value.length === 1) {
			selectCustomer(customers.value[0])
		}
	} else if (event.key === 'Escape') {
		show.value = false
	}
}

onMounted(() => {
	if (props.posProfile) {
		loadAllCustomers()
	}
})

function selectCustomer(customer) {
	emit("customer-selected", customer)
	show.value = false
}

function createNewCustomer() {
	showCreateDialog.value = true
}

async function handleCustomerCreated(customer) {
	if (props.posProfile) {
		try {
			// Add to local array
			const existingWithoutNew = allCustomers.value.filter(
				(cust) => cust.name !== customer.name
			)
			allCustomers.value = [customer, ...existingWithoutNew]

			// Cache in worker
			await offlineWorker.cacheCustomers([customer])
			console.log("✓ New customer cached for instant search")
		} catch (error) {
			console.error("Error caching newly created customer:", error)
		}
	}

	emit("customer-selected", customer)
	show.value = false
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
</style>
