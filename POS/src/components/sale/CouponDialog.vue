<template>
	<Dialog
		v-model="show"
		:options="{ title: 'Apply Coupon / Offer', size: 'md' }"
	>
		<template #body-content>
			<div class="space-y-4">
				<!-- Coupon Code Input -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Enter Coupon Code
					</label>
					<div class="flex space-x-2">
						<Input
							v-model="couponCode"
							type="text"
							placeholder="Enter coupon code..."
							class="flex-1"
							@keyup.enter="applyCoupon"
						/>
						<Button @click="applyCoupon" :loading="applying">
							Apply
						</Button>
					</div>
				</div>

				<!-- Available Offers -->
				<div v-if="availableOffers.length > 0">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Available Offers
					</label>
					<div class="space-y-2 max-h-64 overflow-y-auto">
						<div
							v-for="offer in availableOffers"
							:key="offer.name"
							@click="selectOffer(offer)"
							class="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all"
						>
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<h4 class="text-sm font-semibold text-gray-900">
										{{ offer.offer_name || offer.name }}
									</h4>
									<p class="text-xs text-gray-600 mt-1">
										{{ offer.description || 'No description available' }}
									</p>
									<div class="flex items-center space-x-3 mt-2">
										<span class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
											{{ offer.discount_percentage }}% OFF
										</span>
										<span v-if="offer.minimum_amount" class="text-xs text-gray-500">
											Min: {{ formatCurrency(offer.minimum_amount) }}
										</span>
									</div>
								</div>
								<svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
									<path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
								</svg>
							</div>
						</div>
					</div>
				</div>

				<!-- Applied Discount Preview -->
				<div v-if="appliedDiscount" class="bg-green-50 rounded-lg p-4">
					<div class="flex items-center space-x-2 mb-2">
						<svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
						</svg>
						<h4 class="text-sm font-semibold text-green-900">
							Discount Applied
						</h4>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-sm text-gray-700">{{ appliedDiscount.name }}</span>
						<span class="text-lg font-bold text-green-600">
							-{{ formatCurrency(appliedDiscount.amount) }}
						</span>
					</div>
				</div>
			</div>
		</template>
		<template #actions>
			<div class="flex justify-between w-full">
				<Button
					v-if="appliedDiscount"
					variant="subtle"
					theme="red"
					@click="removeDiscount"
				>
					Remove Discount
				</Button>
				<div class="flex space-x-2 ml-auto">
					<Button variant="subtle" @click="show = false">
						Close
					</Button>
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Dialog, Button, Input } from 'frappe-ui'

const props = defineProps({
	modelValue: Boolean,
	cartTotal: Number,
	items: Array,
})

const emit = defineEmits(['update:modelValue', 'discount-applied', 'discount-removed'])

const show = ref(props.modelValue)
const couponCode = ref('')
const availableOffers = ref([])
const appliedDiscount = ref(null)
const applying = ref(false)

watch(() => props.modelValue, (val) => {
	show.value = val
	if (val) {
		loadAvailableOffers()
	}
})

watch(show, (val) => {
	emit('update:modelValue', val)
})

async function loadAvailableOffers() {
	// In a real implementation, this would fetch from backend
	// For now, we'll use mock data
	availableOffers.value = [
		{
			name: 'WELCOME10',
			offer_name: 'Welcome Offer',
			description: 'Get 10% off on your first purchase',
			discount_percentage: 10,
			minimum_amount: 100,
		},
		{
			name: 'SAVE15',
			offer_name: 'Save More',
			description: 'Get 15% off on orders above 500',
			discount_percentage: 15,
			minimum_amount: 500,
		},
		{
			name: 'MEGA20',
			offer_name: 'Mega Sale',
			description: 'Get 20% off on orders above 1000',
			discount_percentage: 20,
			minimum_amount: 1000,
		},
	]
}

async function applyCoupon() {
	if (!couponCode.value) return

	applying.value = true
	try {
		// Find matching offer
		const offer = availableOffers.value.find(
			o => o.name.toLowerCase() === couponCode.value.toLowerCase()
		)

		if (!offer) {
			window.frappe.msgprint({
				title: 'Invalid Coupon',
				message: 'The coupon code you entered is not valid',
				indicator: 'red'
			})
			return
		}

		// Check minimum amount
		if (offer.minimum_amount && props.cartTotal < offer.minimum_amount) {
			window.frappe.msgprint({
				title: 'Minimum Amount Required',
				message: `This offer requires a minimum purchase of ${formatCurrency(offer.minimum_amount)}`,
				indicator: 'orange'
			})
			return
		}

		// Calculate discount
		const discountAmount = (props.cartTotal * offer.discount_percentage) / 100

		appliedDiscount.value = {
			name: offer.offer_name || offer.name,
			code: offer.name,
			percentage: offer.discount_percentage,
			amount: discountAmount,
		}

		emit('discount-applied', appliedDiscount.value)

		window.frappe.msgprint({
			title: 'Success',
			message: `Coupon ${offer.name} applied successfully!`,
			indicator: 'green'
		})

		couponCode.value = ''
	} catch (error) {
		console.error('Error applying coupon:', error)
	} finally {
		applying.value = false
	}
}

function selectOffer(offer) {
	couponCode.value = offer.name
	applyCoupon()
}

function removeDiscount() {
	appliedDiscount.value = null
	emit('discount-removed')
	window.frappe.msgprint({
		title: 'Removed',
		message: 'Discount has been removed',
		indicator: 'blue'
	})
}

function formatCurrency(amount) {
	return parseFloat(amount || 0).toFixed(2)
}
</script>
