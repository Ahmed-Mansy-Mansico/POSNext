import { ref, computed } from "vue"
import { createResource } from "frappe-ui"

export function useInvoice() {
	// State
	const invoiceItems = ref([])
	const customer = ref(null)
	const payments = ref([])
	const posProfile = ref(null)
	const additionalDiscount = ref(0)
	const couponCode = ref(null)

	// Resources
	const submitInvoiceResource = createResource({
		url: "pos_next.api.invoices.submit_invoice",
		makeParams({ invoice_data }) {
			return { invoice_data: JSON.stringify(invoice_data) }
		},
		auto: false,
	})

	const applyOffersResource = createResource({
		url: "pos_next.api.invoices.apply_offers",
		makeParams({ invoice_data }) {
			return { invoice_data: JSON.stringify(invoice_data) }
		},
		auto: false,
	})

	const getItemDetailsResource = createResource({
		url: "pos_next.api.invoices.get_item_details",
		auto: false,
	})

	// Computed
	const subtotal = computed(() => {
		return invoiceItems.value.reduce((sum, item) => {
			return sum + item.quantity * item.rate
		}, 0)
	})

	const totalTax = computed(() => {
		return invoiceItems.value.reduce((sum, item) => {
			return sum + (item.tax_amount || 0)
		}, 0)
	})

	const totalDiscount = computed(() => {
		const itemDiscount = invoiceItems.value.reduce((sum, item) => {
			return sum + (item.discount_amount || 0)
		}, 0)
		return itemDiscount + (additionalDiscount.value || 0)
	})

	const grandTotal = computed(() => {
		return subtotal.value + totalTax.value - totalDiscount.value
	})

	const totalPaid = computed(() => {
		return payments.value.reduce((sum, p) => sum + (p.amount || 0), 0)
	})

	const remainingAmount = computed(() => {
		return grandTotal.value - totalPaid.value
	})

	const canSubmit = computed(() => {
		return (
			invoiceItems.value.length > 0 &&
			remainingAmount.value <= 0.01 // Allow small rounding differences
		)
	})

	// Actions
	function addItem(item, quantity = 1) {
		const existingItem = invoiceItems.value.find(
			(i) => i.item_code === item.item_code
		)

		if (existingItem) {
			existingItem.quantity += quantity
			recalculateItem(existingItem)
		} else {
			invoiceItems.value.push({
				item_code: item.item_code,
				item_name: item.item_name,
				rate: item.rate || item.price_list_rate || 0,
				price_list_rate: item.price_list_rate || 0,
				quantity: quantity,
				discount_amount: 0,
				discount_percentage: 0,
				tax_amount: 0,
				amount: quantity * (item.rate || item.price_list_rate || 0),
				stock_qty: item.stock_qty || 0,
				image: item.image,
				uom: item.uom || item.stock_uom,
				stock_uom: item.stock_uom,
				conversion_factor: item.conversion_factor || 1,
				warehouse: item.warehouse,
				actual_batch_qty: item.actual_batch_qty || 0,
				has_batch_no: item.has_batch_no || 0,
				has_serial_no: item.has_serial_no || 0,
				batch_no: item.batch_no,
				serial_no: item.serial_no,
			})
		}
	}

	function removeItem(itemCode) {
		invoiceItems.value = invoiceItems.value.filter(
			(i) => i.item_code !== itemCode
		)
	}

	function updateItemQuantity(itemCode, quantity) {
		const item = invoiceItems.value.find((i) => i.item_code === itemCode)
		if (item) {
			item.quantity = parseFloat(quantity) || 1
			recalculateItem(item)
		}
	}

	function updateItemRate(itemCode, rate) {
		const item = invoiceItems.value.find((i) => i.item_code === itemCode)
		if (item) {
			item.rate = parseFloat(rate) || 0
			recalculateItem(item)
		}
	}

	function updateItemDiscount(itemCode, discountPercentage) {
		const item = invoiceItems.value.find((i) => i.item_code === itemCode)
		if (item) {
			item.discount_percentage = parseFloat(discountPercentage) || 0
			const discountAmount =
				(item.rate * item.quantity * item.discount_percentage) / 100
			item.discount_amount = discountAmount
			recalculateItem(item)
		}
	}

	function recalculateItem(item) {
		// Recalculate amount
		item.amount = item.quantity * item.rate

		// Recalculate discount if percentage is set
		if (item.discount_percentage > 0) {
			item.discount_amount = (item.amount * item.discount_percentage) / 100
		}

		// Calculate tax (simplified - in production, use tax template logic)
		const netAmount = item.amount - (item.discount_amount || 0)
		// This is a simplified tax calculation - should be enhanced with proper tax template logic
		item.tax_amount = 0 // Will be calculated by backend
	}

	function addPayment(payment) {
		payments.value.push({
			mode_of_payment: payment.mode_of_payment,
			amount: parseFloat(payment.amount) || 0,
			type: payment.type,
		})
	}

	function removePayment(index) {
		payments.value.splice(index, 1)
	}

	function updatePayment(index, amount) {
		if (payments.value[index]) {
			payments.value[index].amount = parseFloat(amount) || 0
		}
	}

	async function submitInvoice() {
		const invoiceData = {
			pos_profile: posProfile.value,
			customer: customer.value?.name || customer.value,
			items: invoiceItems.value,
			payments: payments.value,
			additional_discount_percentage: 0,
			discount_amount: additionalDiscount.value || 0,
			coupon_code: couponCode.value,
			change_amount: remainingAmount.value < 0 ? Math.abs(remainingAmount.value) : 0,
		}

		const result = await submitInvoiceResource.submit({ invoice_data: invoiceData })
		resetInvoice()
		return result
	}

	function resetInvoice() {
		invoiceItems.value = []
		customer.value = null
		payments.value = []
		additionalDiscount.value = 0
		couponCode.value = null
	}

	function clearCart() {
		invoiceItems.value = []
		payments.value = []
		additionalDiscount.value = 0
		couponCode.value = null
	}

	return {
		// State
		invoiceItems,
		customer,
		payments,
		posProfile,
		additionalDiscount,
		couponCode,

		// Computed
		subtotal,
		totalTax,
		totalDiscount,
		grandTotal,
		totalPaid,
		remainingAmount,
		canSubmit,

		// Actions
		addItem,
		removeItem,
		updateItemQuantity,
		updateItemRate,
		updateItemDiscount,
		addPayment,
		removePayment,
		updatePayment,
		submitInvoice,
		resetInvoice,
		clearCart,

		// Resources
		submitInvoiceResource,
		applyOffersResource,
		getItemDetailsResource,
	}
}
