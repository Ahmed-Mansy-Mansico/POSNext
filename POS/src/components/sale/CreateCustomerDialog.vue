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
			<div class="flex space-x-2">
				<Button variant="subtle" @click="show = false">
					Cancel
				</Button>
				<Button
					variant="solid"
					@click="handleCreate"
					:loading="createCustomerResource.loading"
					:disabled="!customerData.customer_name"
				>
					Create Customer
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { Dialog, Input, Button, toast, createResource } from 'frappe-ui'

const props = defineProps({
	modelValue: Boolean,
	posProfile: String,
})

const emit = defineEmits(['update:modelValue', 'customer-created'])

const show = ref(props.modelValue)
const creating = ref(false)
const customerGroups = ref(['Commercial', 'Individual', 'Non Profit', 'Government'])
const territories = ref(['All Territories'])

const customerData = ref({
	customer_name: '',
	mobile_no: '',
	email_id: '',
	customer_group: 'Individual',
	territory: 'All Territories',
})

// Create customer resource
const createCustomerResource = createResource({
	url: 'frappe.client.insert',
	makeParams() {
		return {
			doc: {
				doctype: 'Customer',
				customer_name: customerData.value.customer_name,
				customer_type: 'Individual',
				customer_group: customerData.value.customer_group || 'Individual',
				territory: customerData.value.territory || 'All Territories',
				mobile_no: customerData.value.mobile_no || '',
				email_id: customerData.value.email_id || '',
			}
		}
	},
	onSuccess(data) {
		toast.create({
			title: 'Success',
			text: `Customer ${data.customer_name} created successfully`,
			icon: 'check',
			iconClasses: 'text-green-600',
		})

		emit('customer-created', data)
		show.value = false
	},
	onError(error) {
		console.error('Error creating customer:', error)
		toast.create({
			title: 'Error',
			text: error.message || 'Failed to create customer',
			icon: 'alert-circle',
			iconClasses: 'text-red-600',
		})
	}
})

// Customer groups resource
const customerGroupsResource = createResource({
	url: 'frappe.client.get_list',
	makeParams() {
		return {
			doctype: 'Customer Group',
			fields: ['name'],
			filters: { is_group: 0 },
			limit_page_length: 100,
		}
	},
	auto: false,
	onSuccess(data) {
		if (data && data.length > 0) {
			customerGroups.value = data.map(g => g.name)
		}
	},
	onError(error) {
		console.error('Error loading customer groups:', error)
	}
})

// Territories resource
const territoriesResource = createResource({
	url: 'frappe.client.get_list',
	makeParams() {
		return {
			doctype: 'Territory',
			fields: ['name'],
			filters: { is_group: 0 },
			limit_page_length: 100,
		}
	},
	auto: false,
	onSuccess(data) {
		if (data && data.length > 0) {
			territories.value = data.map(t => t.name)
		}
	},
	onError(error) {
		console.error('Error loading territories:', error)
	}
})

watch(() => props.modelValue, (val) => {
	show.value = val
	if (val) {
		// Load data when dialog opens
		customerGroupsResource.reload()
		territoriesResource.reload()
	} else {
		resetForm()
	}
})

watch(show, (val) => {
	emit('update:modelValue', val)
})

onMounted(() => {
	// Initial load
	customerGroupsResource.reload()
	territoriesResource.reload()
})

async function handleCreate() {
	if (!customerData.value.customer_name) {
		toast.create({
			title: 'Required Field',
			text: 'Customer Name is required',
			icon: 'alert-circle',
			iconClasses: 'text-red-600',
		})
		return
	}

	// Use the resource to submit
	await createCustomerResource.submit()
}

function resetForm() {
	customerData.value = {
		customer_name: '',
		mobile_no: '',
		email_id: '',
		customer_group: 'Individual',
		territory: 'All Territories',
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
