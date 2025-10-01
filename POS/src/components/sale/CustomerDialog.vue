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
						placeholder="Search customers by name or mobile..."
						class="w-full"
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
					</Input>
				</div>

				<!-- Customers List -->
				<div class="max-h-96 overflow-y-auto">
					<div v-if="loading || customersResource.loading" class="text-center py-8">
						<div
							class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"
						></div>
						<p class="mt-2 text-sm text-gray-500">Loading customers...</p>
					</div>

					<div
						v-else-if="!customers || customers.length === 0"
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
						<p class="mt-2 text-sm text-gray-500">No customers found</p>
						<p class="text-xs text-gray-400 mt-1">
							Try a different search term
						</p>
					</div>

					<div v-else class="space-y-2">
						<button
							v-for="customer in customers"
							:key="customer.name"
							@click="selectCustomer(customer)"
							class="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all"
						>
							<div class="font-medium text-sm text-gray-900">
								{{ customer.customer_name }}
							</div>
							<div class="text-xs text-gray-500 mt-1">
								<span v-if="customer.mobile_no">{{ customer.mobile_no }}</span>
								<span v-if="customer.mobile_no && customer.email_id">
									•
								</span>
								<span v-if="customer.email_id">{{ customer.email_id }}</span>
							</div>
							<div v-if="customer.customer_group" class="text-xs text-gray-400 mt-1">
								{{ customer.customer_group }}
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
import { ref, computed, watch } from "vue"
import { Dialog, Input, Button, createResource } from "frappe-ui"
import CreateCustomerDialog from "./CreateCustomerDialog.vue"
import {
	searchCachedCustomers,
	isOffline,
	isCacheReady,
} from "@/utils/offline"

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
const customers = ref([])
const showCreateDialog = ref(false)
const loading = ref(false)

const customersResource = createResource({
	url: "pos_next.api.invoices.get_customers",
	makeParams() {
		return {
			pos_profile: props.posProfile,
			search_term: searchTerm.value || null,
			start: 0,
			limit: 50,
		}
	},
	auto: false,
	onSuccess(data) {
		customers.value = data?.message || data || []
	},
	onError(error) {
		console.error("Error fetching customers:", error)
		customers.value = []
	},
})

// Cache-first customer loading
async function loadCustomers() {
	// Use cache if offline or cache is ready
	if (isOffline() || isCacheReady()) {
		loading.value = true
		try {
			const cached = await searchCachedCustomers(searchTerm.value, 50)
			customers.value = cached || []
		} catch (error) {
			console.error('Error loading from cache:', error)
			customers.value = []
		} finally {
			loading.value = false
		}
	} else {
		// Use server if online and cache not ready
		customersResource.reload()
	}
}

// Watch for dialog open/close
watch(show, (newVal) => {
	if (newVal) {
		searchTerm.value = ""
		if (props.posProfile) {
			loadCustomers()
		}
	}
})

// Watch for search term changes with debounce
let searchTimeout = null
watch(searchTerm, () => {
	if (searchTimeout) {
		clearTimeout(searchTimeout)
	}

	searchTimeout = setTimeout(() => {
		if (props.posProfile) {
			loadCustomers()
		}
	}, 300)
})

function selectCustomer(customer) {
	emit("customer-selected", customer)
	show.value = false
}

function createNewCustomer() {
	showCreateDialog.value = true
}

function handleCustomerCreated(customer) {
	// Reload customers list to include the new customer
	if (props.posProfile) {
		customersResource.reload()
	}

	// Automatically select the newly created customer
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
