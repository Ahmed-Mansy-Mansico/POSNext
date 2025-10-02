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

				<!-- My Gift Cards -->
				<div v-if="giftCards.length > 0">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						My Gift Cards
					</label>
					<div class="space-y-2 max-h-40 overflow-y-auto">
						<div
							v-for="card in giftCards"
							:key="card.coupon_code"
							@click="applyGiftCard(card)"
							class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all"
						>
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<div class="flex items-center space-x-2">
										<svg class="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
											<path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
											<path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/>
										</svg>
										<h4 class="text-sm font-semibold text-gray-900">
											{{ card.coupon_code }}
										</h4>
									</div>
									<p class="text-xs text-gray-600 mt-1">{{ card.coupon_name }}</p>
								</div>
								<svg class="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
								</svg>
							</div>
						</div>
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
										{{ offer.title || offer.name }}
									</h4>
									<p class="text-xs text-gray-600 mt-1">
										{{ offer.description || 'Special offer' }}
									</p>
									<div class="flex items-center space-x-3 mt-2">
										<span v-if="offer.discount_percentage" class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
											{{ offer.discount_percentage }}% OFF
										</span>
										<span v-if="offer.discount_amount" class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
											{{ formatCurrency(offer.discount_amount) }} OFF
										</span>
										<span v-if="offer.min_amt" class="text-xs text-gray-500">
											Min: {{ formatCurrency(offer.min_amt) }}
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
import { Dialog, Button, Input, createResource, toast } from 'frappe-ui'
import { formatCurrency as formatCurrencyUtil } from '@/utils/currency'

const props = defineProps({
	modelValue: Boolean,
	cartTotal: Number,
	items: Array,
	posProfile: String,
	customer: String,
	company: String,
	currency: {
		type: String,
		default: 'USD'
	}
})

const emit = defineEmits(['update:modelValue', 'discount-applied', 'discount-removed'])

const show = ref(props.modelValue)
const couponCode = ref('')
const availableOffers = ref([])
const giftCards = ref([])
const appliedDiscount = ref(null)
const applying = ref(false)

// Resource to load gift cards
const giftCardsResource = createResource({
	url: 'pos_next.api.offers.get_active_coupons',
	makeParams() {
		return {
			customer: props.customer,
			company: props.company
		}
	},
	auto: false,
	onSuccess(data) {
		giftCards.value = data?.message || data || []
	}
})

// Resource to load offers
const offersResource = createResource({
	url: 'pos_next.api.offers.get_offers',
	makeParams() {
		return {
			pos_profile: props.posProfile
		}
	},
	auto: false,
	onSuccess(data) {
		const offers = data?.message || data || []
		// Filter auto offers that are not coupon-based
		availableOffers.value = offers.filter(offer =>
			offer.auto && !offer.coupon_based &&
			checkOfferEligibility(offer)
		)
	}
})

// Resource to validate coupon
const couponResource = createResource({
	url: 'pos_next.api.offers.validate_coupon',
	makeParams() {
		return {
			coupon_code: couponCode.value,
			customer: props.customer,
			company: props.company
		}
	},
	auto: false
})

watch(() => props.modelValue, (val) => {
	show.value = val
	if (val) {
		loadAvailableOffers()
	}
})

watch(show, (val) => {
	emit('update:modelValue', val)
})

function checkOfferEligibility(offer) {
	// Check minimum amount
	if (offer.min_amt && props.cartTotal < offer.min_amt) {
		return false
	}
	// Check maximum amount
	if (offer.max_amt && props.cartTotal > offer.max_amt) {
		return false
	}
	return true
}

async function loadAvailableOffers() {
	if (!props.posProfile) return
	try {
		await offersResource.reload()
		// Also load gift cards if customer is selected
		if (props.customer && props.company) {
			await giftCardsResource.reload()
		}
	} catch (error) {
		console.error('Error loading offers:', error)
	}
}

function applyGiftCard(card) {
	couponCode.value = card.coupon_code
	applyCoupon()
}

async function applyCoupon() {
	if (!couponCode.value.trim()) return

	applying.value = true
	try {
		await couponResource.reload()
		const result = couponResource.data?.message || couponResource.data

		if (!result || !result.valid) {
			toast.create({
				title: 'Invalid Coupon',
				text: result?.message || 'The coupon code you entered is not valid',
				icon: 'x',
				iconClasses: 'text-red-600'
			})
			return
		}

		const offer = result.offer

		// Check minimum amount
		if (offer.min_amt && props.cartTotal < offer.min_amt) {
			toast.create({
				title: 'Minimum Amount Required',
				text: `This offer requires a minimum purchase of ${formatCurrency(offer.min_amt)}`,
				icon: 'alert-circle',
				iconClasses: 'text-orange-600'
			})
			return
		}

		// Calculate discount based on discount type
		let discountAmount = 0
		if (offer.discount_percentage) {
			discountAmount = (props.cartTotal * offer.discount_percentage) / 100
		} else if (offer.discount_amount) {
			discountAmount = offer.discount_amount
		}

		appliedDiscount.value = {
			name: offer.title || offer.name,
			code: couponCode.value.toUpperCase(),
			percentage: offer.discount_percentage || 0,
			amount: discountAmount,
			type: offer.discount_type,
			coupon: result.coupon,
			offer: offer
		}

		emit('discount-applied', appliedDiscount.value)

		toast.create({
			title: 'Success',
			text: `Coupon ${couponCode.value.toUpperCase()} applied successfully!`,
			icon: 'check',
			iconClasses: 'text-green-600'
		})

		couponCode.value = ''
	} catch (error) {
		console.error('Error applying coupon:', error)
		toast.create({
			title: 'Error',
			text: 'Failed to apply coupon. Please try again.',
			icon: 'x',
			iconClasses: 'text-red-600'
		})
	} finally {
		applying.value = false
	}
}

function selectOffer(offer) {
	// For auto offers, apply directly
	let discountAmount = 0
	if (offer.discount_percentage) {
		discountAmount = (props.cartTotal * offer.discount_percentage) / 100
	} else if (offer.discount_amount) {
		discountAmount = offer.discount_amount
	}

	appliedDiscount.value = {
		name: offer.title || offer.name,
		code: offer.name,
		percentage: offer.discount_percentage || 0,
		amount: discountAmount,
		type: offer.discount_type,
		offer: offer
	}

	emit('discount-applied', appliedDiscount.value)

	toast.create({
		title: 'Offer Applied',
		text: `${offer.title} applied successfully!`,
		icon: 'check',
		iconClasses: 'text-green-600'
	})
}

function removeDiscount() {
	appliedDiscount.value = null
	emit('discount-removed')
	toast.create({
		title: 'Removed',
		text: 'Discount has been removed',
		icon: 'info',
		iconClasses: 'text-blue-600'
	})
}

function formatCurrency(amount) {
	return formatCurrencyUtil(parseFloat(amount || 0), props.currency)
}
</script>
