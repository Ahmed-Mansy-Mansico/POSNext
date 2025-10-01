<template>
	<Dialog
		v-model="show"
		:options="{ title: 'Create Return Invoice', size: 'xl' }"
	>
		<template #body-content>
			<div class="space-y-4">
				<!-- Search Invoice -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Search Invoice
					</label>
					<div class="flex space-x-2">
						<Input
							v-model="invoiceSearch"
							type="text"
							placeholder="Enter invoice number..."
							class="flex-1"
						/>
						<Button @click="searchInvoice" :loading="searching">
							Search
						</Button>
					</div>
				</div>

				<!-- Invoice Details -->
				<div v-if="originalInvoice" class="bg-blue-50 rounded-lg p-4">
					<div class="flex items-start justify-between">
						<div>
							<h3 class="text-sm font-semibold text-gray-900">
								{{ originalInvoice.name }}
							</h3>
							<p class="text-xs text-gray-600 mt-1">
								Customer: {{ originalInvoice.customer_name }}
							</p>
							<p class="text-xs text-gray-600">
								Date: {{ formatDate(originalInvoice.posting_date) }}
							</p>
						</div>
						<div class="text-right">
							<p class="text-sm font-bold text-gray-900">
								{{ formatCurrency(originalInvoice.grand_total) }}
							</p>
							<p class="text-xs text-green-600 mt-1">
								{{ originalInvoice.status }}
							</p>
						</div>
					</div>
				</div>

				<!-- Return Items -->
				<div v-if="originalInvoice">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Select Items to Return
					</label>
					<div class="space-y-2 max-h-96 overflow-y-auto">
						<div
							v-for="(item, index) in returnItems"
							:key="index"
							class="bg-white border border-gray-200 rounded-lg p-3"
						>
							<div class="flex items-center space-x-3">
								<!-- Checkbox -->
								<input
									type="checkbox"
									v-model="item.selected"
									class="h-4 w-4 text-blue-600 rounded"
								/>

								<!-- Item Info -->
								<div class="flex-1">
									<h4 class="text-sm font-semibold text-gray-900">
										{{ item.item_name }}
									</h4>
									<p class="text-xs text-gray-500">
										{{ item.item_code }}
									</p>
								</div>

								<!-- Quantity Controls -->
								<div class="flex items-center space-x-2">
									<span class="text-xs text-gray-600">Qty:</span>
									<input
										v-model.number="item.return_qty"
										:max="item.qty"
										:disabled="!item.selected"
										type="number"
										min="1"
										class="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
									/>
									<span class="text-xs text-gray-500">/ {{ item.qty }}</span>
								</div>

								<!-- Rate -->
								<div class="text-right">
									<p class="text-sm font-bold text-gray-900">
										{{ formatCurrency(item.rate) }}
									</p>
									<p class="text-xs text-gray-500">per {{ item.uom }}</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Return Summary -->
				<div v-if="selectedItems.length > 0" class="bg-gray-50 rounded-lg p-4">
					<div class="space-y-2">
						<div class="flex justify-between text-sm">
							<span class="text-gray-600">Items to Return:</span>
							<span class="font-semibold text-gray-900">{{ selectedItems.length }}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-gray-600">Return Amount:</span>
							<span class="font-bold text-red-600">
								{{ formatCurrency(returnTotal) }}
							</span>
						</div>
					</div>
				</div>

				<!-- Return Reason -->
				<div v-if="selectedItems.length > 0">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Return Reason
					</label>
					<textarea
						v-model="returnReason"
						rows="3"
						placeholder="Enter reason for return..."
						class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					></textarea>
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
					theme="red"
					@click="handleCreateReturn"
					:disabled="selectedItems.length === 0"
					:loading="creating"
				>
					Create Return
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Dialog, Button, Input, createResource } from 'frappe-ui'

const props = defineProps({
	modelValue: Boolean,
	posProfile: String
})

const emit = defineEmits(['update:modelValue', 'return-created'])

const show = ref(props.modelValue)
const invoiceSearch = ref('')
const originalInvoice = ref(null)
const returnItems = ref([])
const returnReason = ref('')
const searching = ref(false)
const creating = ref(false)

watch(() => props.modelValue, (val) => {
	show.value = val
	if (!val) {
		resetForm()
	}
})

watch(show, (val) => {
	emit('update:modelValue', val)
})

const selectedItems = computed(() => {
	return returnItems.value.filter(item => item.selected && item.return_qty > 0)
})

const returnTotal = computed(() => {
	return selectedItems.value.reduce((sum, item) => {
		return sum + (item.return_qty * item.rate)
	}, 0)
})

async function searchInvoice() {
	if (!invoiceSearch.value) return

	searching.value = true
	try {
		const response = await window.frappe.call({
			method: 'frappe.client.get',
			args: {
				doctype: 'Sales Invoice',
				name: invoiceSearch.value
			}
		})

		if (response.message) {
			originalInvoice.value = response.message

			// Prepare return items
			returnItems.value = response.message.items.map(item => ({
				...item,
				selected: false,
				return_qty: item.qty,
			}))
		}
	} catch (error) {
		console.error('Error fetching invoice:', error)
		window.frappe.msgprint({
			title: 'Error',
			message: 'Invoice not found or you do not have permission to access it',
			indicator: 'red'
		})
	} finally {
		searching.value = false
	}
}

async function handleCreateReturn() {
	if (selectedItems.value.length === 0) return

	creating.value = true
	try {
		// Prepare return invoice data
		const returnInvoiceData = {
			pos_profile: props.posProfile,
			customer: originalInvoice.value.customer,
			is_return: 1,
			return_against: originalInvoice.value.name,
			items: selectedItems.value.map(item => ({
				item_code: item.item_code,
				qty: -Math.abs(item.return_qty), // Negative quantity for return
				rate: item.rate,
				warehouse: item.warehouse,
				uom: item.uom,
			})),
			remarks: returnReason.value || `Return against ${originalInvoice.value.name}`
		}

		// Submit the return invoice
		const result = await window.frappe.call({
			method: 'pos_next.api.invoices.submit_invoice',
			args: {
				invoice_data: returnInvoiceData
			}
		})

		if (result.message) {
			emit('return-created', result.message)
			show.value = false

			window.frappe.msgprint({
				title: 'Success',
				message: `Return invoice ${result.message.name} created successfully`,
				indicator: 'green'
			})
		}
	} catch (error) {
		console.error('Error creating return:', error)
		window.frappe.msgprint({
			title: 'Error',
			message: error.message || 'Failed to create return invoice',
			indicator: 'red'
		})
	} finally {
		creating.value = false
	}
}

function resetForm() {
	invoiceSearch.value = ''
	originalInvoice.value = null
	returnItems.value = []
	returnReason.value = ''
}

function formatDate(dateStr) {
	if (!dateStr) return ''
	return new Date(dateStr).toLocaleDateString()
}

function formatCurrency(amount) {
	return parseFloat(amount || 0).toFixed(2)
}
</script>
