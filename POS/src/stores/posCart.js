import { useInvoice } from "@/composables/useInvoice"
import { usePOSOffersStore } from "@/stores/posOffers"
import { usePOSSettingsStore } from "@/stores/posSettings"
import { parseError } from "@/utils/errorHandler"
import {
	checkStockAvailability,
	formatStockError,
} from "@/utils/stockValidator"
import { toast } from "frappe-ui"
import { defineStore } from "pinia"
import { computed, nextTick, ref, watch } from "vue"

export const usePOSCartStore = defineStore("posCart", () => {
	// Use the existing invoice composable for core functionality
	const {
		invoiceItems,
		customer,
		subtotal,
		totalTax,
		totalDiscount,
		grandTotal,
		posProfile,
		posOpeningShift,
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
		rebuildIncrementalCache,
	} = useInvoice()

	const offersStore = usePOSOffersStore()
	const settingsStore = usePOSSettingsStore()

	// Additional cart state
	const pendingItem = ref(null)
	const pendingItemQty = ref(1)
	const appliedOffers = ref([])
	const appliedCoupon = ref(null)
	const selectionMode = ref("uom") // 'uom' or 'variant'
	const suppressOfferReapply = ref(false)

	// Computed
	const itemCount = computed(() => invoiceItems.value.length)
	const isEmpty = computed(() => invoiceItems.value.length === 0)
	const hasCustomer = computed(() => !!customer.value)

	// Actions
	function addItem(item, qty = 1, autoAdd = false, currentProfile = null) {
		// Check stock availability before adding to cart
		// Only enforce stock validation if negative stock is not allowed
		if (currentProfile && !autoAdd && settingsStore.shouldEnforceStockValidation()) {
			const warehouse = item.warehouse || currentProfile.warehouse
			const actualQty =
				item.actual_qty !== undefined ? item.actual_qty : item.stock_qty || 0

			if (warehouse && actualQty !== undefined && actualQty !== null) {
				const stockCheck = checkStockAvailability({
					itemCode: item.item_code,
					qty: qty,
					warehouse: warehouse,
					actualQty: actualQty,
				})

				if (!stockCheck.available) {
					const errorMsg = formatStockError(
						item.item_name,
						qty,
						stockCheck.actualQty,
						warehouse,
					)

					throw new Error(errorMsg)
				}
			}
		}

		// Add item to cart - no toast notification for performance
		addItemToInvoice(item, qty)
	}

	function clearCart() {
		clearInvoiceCart()
		customer.value = null
		appliedOffers.value = []
		appliedCoupon.value = null
	}

	function setCustomer(selectedCustomer) {
		customer.value = selectedCustomer
	}

	function setPendingItem(item, qty = 1, mode = "uom") {
		pendingItem.value = item
		pendingItemQty.value = qty
		selectionMode.value = mode
	}

	function clearPendingItem() {
		pendingItem.value = null
		pendingItemQty.value = 1
		selectionMode.value = "uom"
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
		appliedOffers.value = []
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
			customer:
				customer.value?.name || customer.value || currentProfile?.customer,
			company: currentProfile?.company,
			selling_price_list: currentProfile?.selling_price_list,
			currency: currentProfile?.currency,
			items: invoiceItems.value.map((item) => ({
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
		serverItems.forEach((serverItem) => {
			if (serverItem?.item_code) {
				discountMap.set(serverItem.item_code, serverItem)
			}
		})

		let hasDiscounts = false

		invoiceItems.value.forEach((item) => {
			const serverItem = discountMap.get(item.item_code) || {}
			const discountPercentage =
				Number.parseFloat(serverItem.discount_percentage) || 0
			const discountAmount = Number.parseFloat(serverItem.discount_amount) || 0

			item.discount_percentage = discountPercentage
			item.discount_amount = discountAmount

			if (discountPercentage || discountAmount) {
				hasDiscounts = true
			}

			// Recalculate item (from useInvoice)
			recalculateItem(item)
		})

		// Rebuild cache after bulk operation
		rebuildIncrementalCache()

		return hasDiscounts
	}

	function getAppliedOfferCodes() {
		return appliedOffers.value.map((entry) => entry.code)
	}

	function filterActiveOffers(appliedRuleNames = []) {
		if (!Array.isArray(appliedRuleNames) || appliedRuleNames.length === 0) {
			appliedOffers.value = []
			return
		}

		appliedOffers.value = appliedOffers.value.filter((entry) =>
			appliedRuleNames.includes(entry.code),
		)
	}

	async function applyOffer(offer, currentProfile, offersDialogRef = null) {
		if (!offer) {
			console.error("No offer provided")
			offersDialogRef?.resetApplyingState()
			return false
		}

		const offerCode = offer.name
		const existingCodes = getAppliedOfferCodes()
		const alreadyApplied = existingCodes.includes(offerCode)

		if (alreadyApplied) {
			return await removeOffer(offerCode, currentProfile, offersDialogRef)
		}

		if (!posProfile.value || invoiceItems.value.length === 0) {
			toast.create({
				title: "Offer Unavailable",
				text: "Add items to the cart before applying an offer.",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
			offersDialogRef?.resetApplyingState()
			return false
		}

		try {
			const invoiceData = buildInvoiceDataForOffers(currentProfile)
			const offerNames = [...new Set([...existingCodes, offerCode])]

			const response = await applyOffersResource.submit({
				invoice_data: invoiceData,
				selected_offers: offerNames,
			})

			const payload = response?.message || response || {}
			const responseItems = payload.items || []
			const rawAppliedRules = payload.applied_pricing_rules
			const appliedRules =
				Array.isArray(rawAppliedRules) && rawAppliedRules.length
					? rawAppliedRules
					: existingCodes
			const freeItems = Array.isArray(payload.free_items)
				? payload.free_items
				: []

			suppressOfferReapply.value = true
			applyServerDiscounts(responseItems)

			filterActiveOffers(appliedRules)

			const offerApplied =
				appliedRules.includes(offerCode) ||
				freeItems.some((item) => {
					const ruleName = item?.pricing_rules
					if (Array.isArray(ruleName)) {
						return ruleName.includes(offerCode)
					}
					return ruleName === offerCode
				})

			if (!offerApplied) {
				// No new offer applied - restore previous state without new offer
				if (existingCodes.length) {
					try {
						const rollbackResponse = await applyOffersResource.submit({
							invoice_data: invoiceData,
							selected_offers: existingCodes,
						})
						const rollbackPayload =
							rollbackResponse?.message || rollbackResponse || {}
						const rollbackItems = rollbackPayload.items || []
						const rollbackRawRules = rollbackPayload.applied_pricing_rules
						const rollbackRules =
							Array.isArray(rollbackRawRules) && rollbackRawRules.length
								? rollbackRawRules
								: existingCodes
						applyServerDiscounts(rollbackItems)
						filterActiveOffers(rollbackRules)
					} catch (rollbackError) {
						console.error("Error rolling back offers:", rollbackError)
					}
				}

				toast.create({
					title: "Offer Not Eligible",
					text: "Your cart doesn't meet the requirements for this offer.",
					icon: "alert-circle",
					iconClasses: "text-orange-600",
				})
				offersDialogRef?.resetApplyingState()
				return false
			}

			const offerRuleCodes = appliedRules.includes(offerCode)
				? appliedRules.filter((ruleName) => ruleName === offerCode)
				: [offerCode]

			const updatedEntries = appliedOffers.value.filter(
				(entry) => entry.code !== offerCode,
			)
			updatedEntries.push({
				name: offer.title || offer.name,
				code: offerCode,
				offer,
				source: "manual",
				applied: true,
				rules: offerRuleCodes,
			})
			appliedOffers.value = updatedEntries

			toast.create({
				title: "Offer Applied",
				text: `${offer.title || offer.name} applied successfully`,
				icon: "check",
				iconClasses: "text-green-600",
			})

			return true
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

	async function removeOffer(
		offer,
		currentProfile = null,
		offersDialogRef = null,
	) {
		const offerCode =
			typeof offer === "string" ? offer : offer?.name || offer?.code

		if (!offerCode) {
			// Remove all offers
			suppressOfferReapply.value = true
			appliedOffers.value = []
			removeDiscount()
			toast.create({
				title: "Offer Removed",
				text: "Offer has been removed from cart",
				icon: "check",
				iconClasses: "text-blue-600",
			})
			offersDialogRef?.resetApplyingState()
			return true
		}

		const remainingOffers = appliedOffers.value.filter(
			(entry) => entry.code !== offerCode,
		)
		const remainingCodes = remainingOffers.map((entry) => entry.code)

		if (remainingCodes.length === 0) {
			suppressOfferReapply.value = true
			appliedOffers.value = []
			removeDiscount()
			toast.create({
				title: "Offer Removed",
				text: "Offer has been removed from cart",
				icon: "check",
				iconClasses: "text-blue-600",
			})
			offersDialogRef?.resetApplyingState()
			return true
		}

		try {
			const invoiceData = buildInvoiceDataForOffers(currentProfile)

			const response = await applyOffersResource.submit({
				invoice_data: invoiceData,
				selected_offers: remainingCodes,
			})

			const payload = response?.message || response || {}
			const responseItems = payload.items || []
			const rawAppliedRules = payload.applied_pricing_rules
			const appliedRules =
				Array.isArray(rawAppliedRules) && rawAppliedRules.length
					? rawAppliedRules
					: remainingCodes

			suppressOfferReapply.value = true
			applyServerDiscounts(responseItems)
			filterActiveOffers(appliedRules)

			appliedOffers.value = appliedOffers.value.filter((entry) =>
				remainingCodes.includes(entry.code),
			)

			toast.create({
				title: "Offer Removed",
				text: "Offer has been removed from cart",
				icon: "check",
				iconClasses: "text-blue-600",
			})
			offersDialogRef?.resetApplyingState()
			return true
		} catch (error) {
			console.error("Error removing offer:", error)
			toast.create({
				title: "Error",
				text: "Failed to update cart after removing offer.",
				icon: "x",
				iconClasses: "text-red-600",
			})
			offersDialogRef?.resetApplyingState()
			return false
		}
	}

	async function reapplyOffer(currentProfile) {
		// Clear offers if cart is empty
		if (invoiceItems.value.length === 0 && appliedOffers.value.length) {
			appliedOffers.value = []
			return
		}

		// Reapply or discover offers when cart has items
		// - If appliedOffers.length > 0: re-validates existing offers
		// - If appliedOffers.length === 0: discovers new eligible offers
		if (invoiceItems.value.length > 0 && !suppressOfferReapply.value) {
			try {
				const invoiceData = buildInvoiceDataForOffers(currentProfile)
				const offerNames = getAppliedOfferCodes()

				const response = await applyOffersResource.submit({
					invoice_data: invoiceData,
					selected_offers: offerNames,
				})

				const payload = response?.message || response || {}
				const responseItems = payload.items || []
				const rawAppliedRules = payload.applied_pricing_rules
				const appliedRules =
					Array.isArray(rawAppliedRules) && rawAppliedRules.length
						? rawAppliedRules
						: offerNames

				suppressOfferReapply.value = true
				applyServerDiscounts(responseItems)
				filterActiveOffers(appliedRules)
			} catch (error) {
				console.error("Error re-applying offers:", error)
			}
		}

		if (suppressOfferReapply.value) {
			suppressOfferReapply.value = false
		}
	}

	async function changeItemUOM(itemCode, newUom) {
		try {
			const cartItem = invoiceItems.value.find((i) => i.item_code === itemCode)
			if (!cartItem) return

			const itemDetails = await getItemDetailsResource.submit({
				item_code: itemCode,
				pos_profile: posProfile.value,
				customer: customer.value?.name || customer.value,
				qty: cartItem.quantity,
				uom: newUom,
			})

			const uomData = cartItem.item_uoms?.find((u) => u.uom === newUom)

			cartItem.uom = newUom
			cartItem.conversion_factor =
				uomData?.conversion_factor || itemDetails.conversion_factor || 1
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

	async function updateItemDetails(itemCode, updatedDetails) {
		try {
			const cartItem = invoiceItems.value.find((i) => i.item_code === itemCode)
			if (!cartItem) {
				throw new Error("Item not found in cart")
			}

			// If UOM changed, fetch new rate from server
			if (updatedDetails.uom && updatedDetails.uom !== cartItem.uom) {
				try {
					const itemDetails = await getItemDetailsResource.submit({
						item_code: itemCode,
						pos_profile: posProfile.value,
						customer: customer.value?.name || customer.value,
						qty: updatedDetails.quantity || cartItem.quantity,
						uom: updatedDetails.uom,
					})

					const uomData = cartItem.item_uoms?.find(
						(u) => u.uom === updatedDetails.uom,
					)

					// Update with server response
					cartItem.uom = updatedDetails.uom
					cartItem.conversion_factor =
						uomData?.conversion_factor || itemDetails.conversion_factor || 1
					cartItem.rate = itemDetails.price_list_rate || itemDetails.rate
					cartItem.price_list_rate = itemDetails.price_list_rate
				} catch (error) {
					console.warn(
						"Failed to fetch UOM details, using provided rate:",
						error,
					)
					// Fall back to using the provided rate
					cartItem.uom = updatedDetails.uom
				}
			}

			// Update all provided details
			if (updatedDetails.quantity !== undefined) {
				cartItem.quantity = updatedDetails.quantity
			}
			if (updatedDetails.rate !== undefined) {
				cartItem.rate = updatedDetails.rate
			}
			if (updatedDetails.warehouse !== undefined) {
				cartItem.warehouse = updatedDetails.warehouse
			}
			if (updatedDetails.discount_percentage !== undefined) {
				cartItem.discount_percentage = updatedDetails.discount_percentage
			}
			if (updatedDetails.discount_amount !== undefined) {
				cartItem.discount_amount = updatedDetails.discount_amount
			}

			// Recalculate item totals
			recalculateItem(cartItem)

			toast.create({
				title: "Item Updated",
				text: `${cartItem.item_name} updated successfully`,
				icon: "check",
				iconClasses: "text-green-600",
			})

			return true
		} catch (error) {
			console.error("Error updating item details:", error)
			toast.create({
				title: "Error",
				text: parseError(error) || "Failed to update item. Please try again.",
				icon: "alert-circle",
				iconClasses: "text-red-600",
			})
			return false
		}
	}

	// Performance: Cache previous item codes hash to avoid unnecessary recalculations
	let previousItemCodesHash = ""
	let cachedItemCodes = []
	let cachedItemGroups = []
	let cachedBrands = []

	function syncOfferSnapshot() {
		// Only sync if values are initialized
		if (subtotal.value !== undefined && invoiceItems.value) {
			// Create hash for item codes to detect actual changes
			const currentHash = invoiceItems.value
				.map((item) => item.item_code)
				.join(",")

			// Only recalculate expensive operations if items actually changed
			if (currentHash !== previousItemCodesHash) {
				cachedItemCodes = invoiceItems.value.map((item) => item.item_code)
				cachedItemGroups = [
					...new Set(
						invoiceItems.value.map((item) => item.item_group).filter(Boolean),
					),
				]
				cachedBrands = [
					...new Set(
						invoiceItems.value.map((item) => item.brand).filter(Boolean),
					),
				]
				previousItemCodesHash = currentHash
			}

			offersStore.updateCartSnapshot({
				subtotal: subtotal.value,
				itemCount: invoiceItems.value.length,
				itemCodes: cachedItemCodes,
				itemGroups: cachedItemGroups,
				brands: cachedBrands,
			})
		}
	}

	// Watch for cart changes to update offer snapshot (min/max thresholds etc.)
	// Optimized: Only watch length and subtotal, calculate hash inside the watcher
	watch(
		[subtotal, () => invoiceItems.value.length],
		() => {
			// Defer to next tick to prevent blocking UI
			nextTick(() => {
				syncOfferSnapshot()
			})
		},
		{ immediate: true, flush: "post" },
	)

	return {
		// State
		invoiceItems,
		customer,
		subtotal,
		totalTax,
		totalDiscount,
		grandTotal,
		posProfile,
		posOpeningShift,
		payments,
		pendingItem,
		pendingItemQty,
		appliedOffers,
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
		updateItemDetails,
		getItemDetailsResource,
		recalculateItem,
		rebuildIncrementalCache,
		applyOffersResource,
		buildInvoiceDataForOffers,
	}
})
