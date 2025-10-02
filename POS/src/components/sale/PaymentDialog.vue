<template>
	<Dialog v-model="show" :options="{ title: 'Payment', size: 'lg' }">
		<template #body-content>
			<div class="space-y-4">
				<!-- Amount Summary -->
				<div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
					<div class="flex justify-between items-center mb-2">
						<span class="text-sm text-gray-600">Total Amount:</span>
						<span class="text-2xl font-bold text-gray-900">{{
							formatCurrency(grandTotal)
						}}</span>
					</div>
					<div class="flex justify-between items-center text-sm">
						<span class="text-gray-600">Amount Paid:</span>
						<span
							:class="[
								'font-semibold',
								totalPaid >= grandTotal ? 'text-green-600' : 'text-orange-600',
							]"
							>{{ formatCurrency(totalPaid) }}</span
						>
					</div>
					<div
						v-if="remainingAmount > 0"
						class="flex justify-between items-center text-sm mt-1"
					>
						<span class="text-gray-600">Remaining:</span>
						<span class="font-semibold text-red-600">{{
							formatCurrency(remainingAmount)
						}}</span>
					</div>
					<div
						v-if="changeAmount > 0"
						class="flex justify-between items-center text-sm mt-1"
					>
						<span class="text-gray-600">Change to Return:</span>
						<span class="font-semibold text-blue-600">{{
							formatCurrency(changeAmount)
						}}</span>
					</div>
				</div>

				<!-- Payment Methods -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Select Payment Method
					</label>
					<div class="grid grid-cols-2 gap-2">
						<button
							v-for="method in paymentMethods"
							:key="method.mode_of_payment"
							@click="selectPaymentMethod(method)"
							:class="[
								'p-3 rounded-lg border-2 transition-all text-left',
								selectedMethod?.mode_of_payment === method.mode_of_payment
									? 'border-blue-500 bg-blue-50'
									: 'border-gray-200 hover:border-gray-300',
							]"
						>
							<div class="font-medium text-sm">{{ method.mode_of_payment }}</div>
							<div class="text-xs text-gray-500">{{ method.type || "Cash" }}</div>
						</button>
					</div>
				</div>

				<!-- Payment Amount Input -->
				<div v-if="selectedMethod">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Enter Amount for {{ selectedMethod.mode_of_payment }}
					</label>
					<div class="flex space-x-2">
						<Input
							v-model="paymentAmount"
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							class="flex-1"
							@keyup.enter="addPaymentEntry"
						/>
						<Button variant="solid" theme="blue" @click="addPaymentEntry">
							Add
						</Button>
					</div>

					<!-- Quick Amount Buttons -->
					<div class="grid grid-cols-4 gap-2 mt-2">
						<button
							v-for="amount in quickAmounts"
							:key="amount"
							@click="paymentAmount = amount"
							class="px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
						>
							{{ formatCurrency(amount) }}
						</button>
					</div>
				</div>

				<!-- Payment Entries List -->
				<div v-if="paymentEntries.length > 0">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Payment Entries
					</label>
					<div class="space-y-2">
						<div
							v-for="(entry, index) in paymentEntries"
							:key="index"
							class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
						>
							<div>
								<div class="font-medium text-sm">{{ entry.mode_of_payment }}</div>
								<div class="text-xs text-gray-500">{{ entry.type }}</div>
							</div>
							<div class="flex items-center space-x-3">
								<span class="font-semibold text-gray-900">{{
									formatCurrency(entry.amount)
								}}</span>
								<button
									@click="removePaymentEntry(index)"
									class="text-red-500 hover:text-red-700"
								>
									<svg
										class="h-5 w-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>

		<template #actions>
			<div class="flex space-x-2">
				<Button variant="subtle" @click="show = false">Cancel</Button>
				<Button
					variant="solid"
					theme="blue"
					@click="completePayment"
					:disabled="!canComplete"
				>
					Complete Payment
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue"
import { Dialog, Input, Button, createResource } from "frappe-ui"

const props = defineProps({
	modelValue: Boolean,
	grandTotal: {
		type: Number,
		default: 0,
	},
	posProfile: String,
})

const emit = defineEmits(["update:modelValue", "payment-completed"])

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit("update:modelValue", val),
})

const paymentMethods = ref([])
const selectedMethod = ref(null)
const paymentAmount = ref("")
const paymentEntries = ref([])

const paymentMethodsResource = createResource({
	url: "pos_next.api.pos_profile.get_payment_methods",
	params: {
		pos_profile: props.posProfile,
	},
	auto: false,
	onSuccess(data) {
		paymentMethods.value = data?.message || data || []
		// Select default payment method if available
		const defaultMethod = paymentMethods.value.find((m) => m.default)
		if (defaultMethod) {
			selectedMethod.value = defaultMethod
		} else if (paymentMethods.value.length > 0) {
			selectedMethod.value = paymentMethods.value[0]
		}
	},
})

const totalPaid = computed(() => {
	return paymentEntries.value.reduce((sum, entry) => sum + (entry.amount || 0), 0)
})

const remainingAmount = computed(() => {
	const remaining = props.grandTotal - totalPaid.value
	return remaining > 0 ? remaining : 0
})

const changeAmount = computed(() => {
	const change = totalPaid.value - props.grandTotal
	return change > 0 ? change : 0
})

const canComplete = computed(() => {
	return totalPaid.value >= props.grandTotal && paymentEntries.value.length > 0
})

const quickAmounts = computed(() => {
	const remaining = remainingAmount.value
	if (remaining > 0) {
		return [
			Math.ceil(remaining),
			Math.ceil(remaining / 10) * 10,
			Math.ceil(remaining / 50) * 50,
			Math.ceil(remaining / 100) * 100,
		].filter((amt) => amt > 0)
	}
	return [10, 20, 50, 100]
})

watch(show, (newVal) => {
	if (newVal) {
		// Reset state when dialog opens
		paymentEntries.value = []
		paymentAmount.value = ""
		selectedMethod.value = null

		// Load payment methods
		if (props.posProfile) {
			paymentMethodsResource.reload()
		}
	}
})

function selectPaymentMethod(method) {
	selectedMethod.value = method
	// Auto-fill remaining amount if nothing entered yet
	if (!paymentAmount.value && remainingAmount.value > 0) {
		paymentAmount.value = remainingAmount.value.toFixed(2)
	}
}

function addPaymentEntry() {
	if (!selectedMethod.value || !paymentAmount.value || paymentAmount.value <= 0) {
		return
	}

	paymentEntries.value.push({
		mode_of_payment: selectedMethod.value.mode_of_payment,
		amount: parseFloat(paymentAmount.value),
		type: selectedMethod.value.type || "Cash",
	})

	// Reset input
	paymentAmount.value = ""

	// If payment is complete, don't select next method
	if (totalPaid.value >= props.grandTotal) {
		selectedMethod.value = null
	}
}

function removePaymentEntry(index) {
	paymentEntries.value.splice(index, 1)
}

function completePayment() {
	if (!canComplete.value) return

	emit("payment-completed", {
		payments: paymentEntries.value,
		change_amount: changeAmount.value,
	})

	show.value = false
}

function formatCurrency(amount) {
	return parseFloat(amount || 0).toFixed(2)
}
</script>
