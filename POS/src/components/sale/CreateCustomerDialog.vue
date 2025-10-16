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

				<!-- Mobile Number -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Mobile Number
					</label>
					<Input
						v-model="customerData.mobile_no"
						type="text"
						placeholder="Enter mobile number"
					/>
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
import { computed, onMounted, ref, watch } from "vue"

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

const customerData = ref({
	customer_name: "",
	mobile_no: "",
	email_id: "",
	customer_group: "Individual",
	territory: "All Territories",
})

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
				email_id: "",
				customer_group: "Individual",
				territory: "All Territories",
			}
		}
	},
)

// Create customer resource
const createCustomerResource = createResource({
	url: "frappe.client.insert",
	makeParams() {
		return {
			doc: {
				doctype: "Customer",
				customer_name: customerData.value.customer_name,
				customer_type: "Individual",
				customer_group: customerData.value.customer_group || "Individual",
				territory: customerData.value.territory || "All Territories",
				mobile_no: customerData.value.mobile_no || "",
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
		email_id: "",
		customer_group: "Individual",
		territory: "All Territories",
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
</style>
