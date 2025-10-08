import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useInvoice } from '@/composables/useInvoice'
import { toast } from 'frappe-ui'
import { parseError } from '@/utils/errorHandler'
import { checkStockAvailability, formatStockError } from '@/utils/stockValidator'

export const usePOSCartStore = defineStore('posCart', () => {
	// Use the existing invoice composable for core functionality
	const {
		invoiceItems,
		customer,
		subtotal,
		totalTax,
		totalDiscount,
		grandTotal,
		posProfile,
		payments,
		addItem: addItemToInvoice,
		removeItem,
		updateItemQuantity,
		submitInvoice,
		clearCart: clearInvoiceCart,
		loadTaxRules,
		applyDiscount,
		removeDiscount,
		applyOffersResource,
		getItemDetailsResource,
		recalculateItem,
	} = useInvoice()

	// Additional cart state
	const pendingItem = ref(null)
	const pendingItemQty = ref(1)
	const autoAppliedOffer = ref(null)
	const appliedCoupon = ref(null)
	const selectionMode = ref('uom') // 'uom' or 'variant'
	const suppressOfferReapply = ref(false)

	// Computed
	const itemCount = computed(() => invoiceItems.value.length)
	const isEmpty = computed(() => invoiceItems.value.length === 0)
	const hasCustomer = computed(() => !!customer.value)

	// Actions
	function addItem(item, qty = 1, autoAdd = false, currentProfile = null) {
		// Check stock availability before adding to cart
		if (currentProfile && !autoAdd) {
			const warehouse = item.warehouse || currentProfile.warehouse
			const actualQty = item.actual_qty !== undefined ? item.actual_qty : (item.stock_qty || 0)

			if (warehouse && actualQty !== undefined && actualQty !== null) {
				const stockCheck = checkStockAvailability({
					itemCode: item.item_code,
					qty: qty,
					warehouse: warehouse,
					actualQty: actualQty
				})

				if (!stockCheck.available) {
					const errorMsg = formatStockError(
						item.item_name,
						qty,
						stockCheck.actualQty,
						warehouse
					)

					throw new Error(errorMsg)
				}
			}
		}

		addItemToInvoice(item, qty)

		if (autoAdd) {
			toast.create({
				title: "✓ Auto-Added to Cart",
				text: `${item.item_name} added to cart`,
				icon: "check",
				iconClasses: "text-blue-600",
			})
		} else {
			toast.create({
				title: "Item Added",
				text: `${item.item_name} added to cart`,
				icon: "check",
				iconClasses: "text-green-600",
			})
		}
	}

	function clearCart() {
		clearInvoiceCart()
		customer.value = null
		autoAppliedOffer.value = null
		appliedCoupon.value = null
	}

	function setCustomer(selectedCustomer) {
		customer.value = selectedCustomer
	}

	function setPendingItem(item, qty = 1, mode = 'uom') {
		pendingItem.value = item
		pendingItemQty.value = qty
		selectionMode.value = mode
	}

	function clearPendingItem() {
		pendingItem.value = null
		pendingItemQty.value = 1
		selectionMode.value = 'uom'
	}

	// Discount & Offer Management
	function applyDiscountToCart(discount) {
		applyDiscount(discount)
		appliedCoupon.value = discount
		toast.create({
			title: "Coupon Applied",
			text: `${discount.name} applied successfully`,
			icon: "check",
			iconClasses: "text-green-600",
		})
	}

	function removeDiscountFromCart() {
		suppressOfferReapply.value = true
		autoAppliedOffer.value = null
		removeDiscount()
		appliedCoupon.value = null
		toast.create({
			title: "Discount Removed",
			text: "Discount has been removed from cart",
			icon: "check",
			iconClasses: "text-blue-600",
		})
	}

	function buildInvoiceDataForOffers(currentProfile) {
		return {
			doctype: "Sales Invoice",
			pos_profile: posProfile.value,
			customer: customer.value?.name || customer.value || currentProfile?.customer,
			company: currentProfile?.company,
			selling_price_list: currentProfile?.selling_price_list,
			currency: currentProfile?.currency,
			items: invoiceItems.value.map(item => ({
				item_code: item.item_code,
				item_name: item.item_name,
				qty: item.quantity,
				rate: item.rate,
				uom: item.uom,
				warehouse: item.warehouse,
				conversion_factor: item.conversion_factor || 1,
				price_list_rate: item.price_list_rate || item.rate,
			})),
		}
	}

	function applyServerDiscounts(serverItems) {
		if (!Array.isArray(serverItems)) {
			return false
		}

		const discountMap = new Map()
		serverItems.forEach(serverItem => {
			if (serverItem?.item_code) {
				discountMap.set(serverItem.item_code, serverItem)
			}
		})

		let hasDiscounts = false

		invoiceItems.value.forEach(item => {
			const serverItem = discountMap.get(item.item_code) || {}
			const discountPercentage = parseFloat(serverItem.discount_percentage) || 0
			const discountAmount = parseFloat(serverItem.discount_amount) || 0

			item.discount_percentage = discountPercentage
			item.discount_amount = discountAmount

			if (discountPercentage || discountAmount) {
				hasDiscounts = true
			}

			updateItemQuantity(item.item_code, item.quantity)
		})

		return hasDiscounts
	}

	async function applyOffer(offer, currentProfile, offersDialogRef = null) {
		if (!offer) {
			console.error('No offer provided')
			offersDialogRef?.resetApplyingState()
			return
		}

		if (!posProfile.value || invoiceItems.value.length === 0) {
			toast.create({
				title: "Offer Unavailable",
				text: "Add items to the cart before applying an offer.",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
			offersDialogRef?.resetApplyingState()
			return
		}

		try {
			const invoiceData = buildInvoiceDataForOffers(currentProfile)
			const offerNames = [offer.name]

			const response = await applyOffersResource.submit({
				invoice_data: invoiceData,
				selected_offers: offerNames,
			})

			const payload = response?.message || response || {}
			const responseItems = payload.items || []
			const appliedRules = payload.applied_pricing_rules || offerNames

			suppressOfferReapply.value = true
			const hasDiscounts = applyServerDiscounts(responseItems)

			if (hasDiscounts) {
				autoAppliedOffer.value = {
					name: offer.title || offer.name,
					code: offer.name,
					offer: offer,
					source: "manual",
					applied: true,
					rules: appliedRules,
				}

				toast.create({
					title: "Offer Applied",
					text: `${offer.title || offer.name} applied successfully`,
					icon: "check",
					iconClasses: "text-green-600",
				})

				return true
			} else {
				toast.create({
					title: "Offer Not Eligible",
					text: "Your cart doesn't meet the requirements for this offer.",
					icon: "alert-circle",
					iconClasses: "text-orange-600",
				})
				offersDialogRef?.resetApplyingState()
				return false
			}
		} catch (error) {
			console.error("Error applying offer:", error)
			toast.create({
				title: "Error",
				text: "Failed to apply offer. Please try again.",
				icon: "x",
				iconClasses: "text-red-600",
			})
			offersDialogRef?.resetApplyingState()
			return false
		}
	}

	function removeOffer() {
		suppressOfferReapply.value = true
		autoAppliedOffer.value = null
		removeDiscount()
		toast.create({
			title: "Offer Removed",
			text: "Offer has been removed from cart",
			icon: "check",
			iconClasses: "text-blue-600",
		})
	}

	async function reapplyOffer(currentProfile) {
		if (invoiceItems.value.length === 0 && autoAppliedOffer.value) {
			autoAppliedOffer.value = null
			return
		}

		if (invoiceItems.value.length > 0 && autoAppliedOffer.value && !suppressOfferReapply.value) {
			try {
				const invoiceData = buildInvoiceDataForOffers(currentProfile)
				const offerNames = [autoAppliedOffer.value.code]

				const response = await applyOffersResource.submit({
					invoice_data: invoiceData,
					selected_offers: offerNames,
				})

				const payload = response?.message || response || {}
				const responseItems = payload.items || []

				suppressOfferReapply.value = true
				applyServerDiscounts(responseItems)
			} catch (error) {
				console.error("Error re-applying offer:", error)
			}
		}

		if (suppressOfferReapply.value) {
			suppressOfferReapply.value = false
		}
	}

	async function changeItemUOM(itemCode, newUom) {
		try {
			const cartItem = invoiceItems.value.find(i => i.item_code === itemCode)
			if (!cartItem) return

			const itemDetails = await getItemDetailsResource.submit({
				item_code: itemCode,
				pos_profile: posProfile.value,
				customer: customer.value?.name || customer.value,
				qty: cartItem.quantity,
				uom: newUom
			})

			const uomData = cartItem.item_uoms?.find(u => u.uom === newUom)

			cartItem.uom = newUom
			cartItem.conversion_factor = uomData?.conversion_factor || itemDetails.conversion_factor || 1
			cartItem.rate = itemDetails.price_list_rate || itemDetails.rate
			cartItem.price_list_rate = itemDetails.price_list_rate

			recalculateItem(cartItem)

			toast.create({
				title: "UOM Updated",
				text: `Unit changed to ${newUom}`,
				icon: "check",
				iconClasses: "text-green-600",
			})
		} catch (error) {
			console.error("Error changing UOM:", error)
			toast.create({
				title: "Error",
				text: "Failed to update UOM. Please try again.",
				icon: "alert-circle",
				iconClasses: "text-red-600",
			})
		}
	}

	return {
		// State
		invoiceItems,
		customer,
		subtotal,
		totalTax,
		totalDiscount,
		grandTotal,
		posProfile,
		payments,
		pendingItem,
		pendingItemQty,
		autoAppliedOffer,
		appliedCoupon,
		selectionMode,
		suppressOfferReapply,

		// Computed
		itemCount,
		isEmpty,
		hasCustomer,

		// Actions
		addItem,
		removeItem,
		updateItemQuantity,
		clearCart,
		setCustomer,
		setPendingItem,
		clearPendingItem,
		loadTaxRules,
		submitInvoice,
		applyDiscountToCart,
		removeDiscountFromCart,
		applyOffer,
		removeOffer,
		reapplyOffer,
		changeItemUOM,
		getItemDetailsResource,
		recalculateItem,
		applyOffersResource,
		buildInvoiceDataForOffers,
	}
})
