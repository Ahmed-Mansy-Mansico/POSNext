import { ref, computed } from "vue"
import { createResource } from "frappe-ui"

export function useInvoice() {
	// State
	const invoiceItems = ref([])
	const customer = ref(null)
	const payments = ref([])
	const posProfile = ref(null)
	const posOpeningShift = ref(null) // POS Opening Shift name
	const additionalDiscount = ref(0)
	const couponCode = ref(null)
	const taxRules = ref([]) // Tax rules from POS Profile

	// Resources
	const updateInvoiceResource = createResource({
		url: "pos_next.api.invoices.update_invoice",
		makeParams(params) {
			return { data: JSON.stringify(params.data) }
		},
		auto: false,
	})

	const submitInvoiceResource = createResource({
		url: "pos_next.api.invoices.submit_invoice",
		makeParams(params) {
			return {
				invoice: JSON.stringify(params.invoice),
				data: JSON.stringify(params.data || {}),
			}
		},
		auto: false,
		onError(error) {
			// Store the full error details for later access
			console.error("submitInvoiceResource onError:", error)

			// Attach the resource's error data to the error object
			if (submitInvoiceResource.error) {
				error.resourceError = submitInvoiceResource.error
			}
		},
	})

	const validateCartItemsResource = createResource({
		url: "pos_next.api.invoices.validate_cart_items",
		makeParams({ items, pos_profile }) {
			return {
				items: JSON.stringify(items),
				pos_profile: pos_profile,
			}
		},
		auto: false,
	})

        const applyOffersResource = createResource({
                url: "pos_next.api.invoices.apply_offers",
                makeParams({ invoice_data, selected_offers }) {
                        const params = {
                                invoice_data: JSON.stringify(invoice_data),
                        }

                        if (selected_offers && selected_offers.length) {
                                params.selected_offers = JSON.stringify(selected_offers)
                        }

                        return params
                },
                auto: false,
        })

	const getItemDetailsResource = createResource({
		url: "pos_next.api.items.get_item_details",
		auto: false,
	})

	const getTaxesResource = createResource({
		url: "pos_next.api.pos_profile.get_taxes",
		auto: false,
	})

	const cleanupDraftsResource = createResource({
		url: "pos_next.api.invoices.cleanup_old_drafts",
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
			const newItem = {
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
				item_uoms: item.item_uoms || [],  // Available UOMs for this item
			}
			invoiceItems.value.push(newItem)
			// Recalculate the newly added item to apply taxes
			recalculateItem(newItem)
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
			item.discount_amount = 0 // Let recalculateItem compute it
			recalculateItem(item)
		}
	}

	function calculateDiscountAmount(discount, baseAmount = null) {
		/**
		 * ⭐ SINGLE SOURCE OF TRUTH FOR ALL DISCOUNT CALCULATIONS ⭐
		 *
		 * This function centralizes discount calculation logic.
		 * All components should use this for consistency.
		 *
		 * IMPORTANT: Discounts are ALWAYS calculated on SUBTOTAL (before tax)
		 * This ensures tax is applied AFTER discount, which is the correct order.
		 *
		 * Calculation Order:
		 * 1. Subtotal (item total)
		 * 2. - Discount (calculated here)
		 * 3. = Net Amount
		 * 4. + Tax (on net amount)
		 * 5. = Grand Total
		 *
		 * @param {Object} discount - { percentage, amount, offer }
		 * @param {Number} baseAmount - Base amount to calculate on (defaults to subtotal)
		 * @returns {Number} Calculated discount amount
		 */
		if (!discount) return 0

		const base = baseAmount !== null ? baseAmount : subtotal.value

		if (discount.percentage > 0) {
			// Percentage discount on SUBTOTAL (before tax)
			return (base * discount.percentage) / 100
		} else if (discount.amount > 0) {
			// Fixed amount discount
			return discount.amount
		}

		return 0
	}

	function applyDiscount(discount) {
		/**
		 * Apply discount to all items in the cart
		 * @param {Object} discount - { percentage, amount, name }
		 */
		if (!discount) return

		if (discount.percentage > 0) {
			// Apply percentage discount to all items
			invoiceItems.value.forEach(item => {
				item.discount_percentage = discount.percentage
				item.discount_amount = 0
				recalculateItem(item)
			})
		} else if (discount.amount > 0) {
			// Distribute fixed discount amount proportionally across items
			const total = subtotal.value
			if (total > 0) {
				invoiceItems.value.forEach(item => {
					const itemTotal = item.rate * item.quantity
					const itemDiscount = (itemTotal / total) * discount.amount
					item.discount_amount = itemDiscount
					item.discount_percentage = 0
					recalculateItem(item)
				})
			}
		}
	}

	function removeDiscount() {
		/**
		 * Remove all discounts from cart items
		 */
		invoiceItems.value.forEach(item => {
			item.discount_percentage = 0
			item.discount_amount = 0
			recalculateItem(item)
		})
	}

	function recalculateItem(item) {
		// Step 1: Calculate base amount (rate * quantity)
		const baseAmount = item.quantity * item.rate

		// Step 2: Calculate discount amount
		let discountAmount = 0
		if (item.discount_percentage > 0) {
			discountAmount = (baseAmount * item.discount_percentage) / 100
		} else if (item.discount_amount > 0) {
			// If discount_amount is set directly, use it
			discountAmount = item.discount_amount
			// Also calculate the percentage for consistency
			item.discount_percentage = baseAmount > 0 ? (discountAmount / baseAmount) * 100 : 0
		}
		item.discount_amount = discountAmount

		// Step 3: Calculate net amount (after discount, before tax)
		const netAmount = baseAmount - discountAmount

		// Step 4: Calculate tax on net amount
		let taxAmount = 0
		if (taxRules.value && taxRules.value.length > 0) {
			for (const taxRule of taxRules.value) {
				if (taxRule.charge_type === "On Net Total" || taxRule.charge_type === "On Previous Row Total") {
					taxAmount += (netAmount * (taxRule.rate || 0)) / 100
				}
			}
		}
		item.tax_amount = taxAmount

		// Step 5: Calculate final item amount (net amount + tax)
		item.amount = netAmount + taxAmount

		// Force reactivity update
		invoiceItems.value = [...invoiceItems.value]
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

	async function validateStock() {
		/**
		 * Validate stock availability before submission
		 * Returns array of errors if stock is insufficient
		 */
		const items = invoiceItems.value.map((item) => ({
			item_code: item.item_code,
			qty: item.quantity,
			warehouse: item.warehouse,
			conversion_factor: item.conversion_factor || 1,
			stock_qty: item.quantity * (item.conversion_factor || 1),
			is_stock_item: item.is_stock_item !== false, // default to true
		}))

		try {
			const result = await validateCartItemsResource.submit({
				items: items,
				pos_profile: posProfile.value,
			})
			return result || []
		} catch (error) {
			console.error("Stock validation error:", error)
			return []
		}
	}

	async function saveDraft() {
		/**
		 * Save invoice as draft (Step 1 - POSAwesome style)
		 * This creates the invoice with docstatus=0
		 */
		const invoiceData = {
			doctype: "Sales Invoice",
			pos_profile: posProfile.value,
			posa_pos_opening_shift: posOpeningShift.value,
			customer: customer.value?.name || customer.value,
			items: invoiceItems.value.map((item) => ({
				item_code: item.item_code,
				item_name: item.item_name,
				qty: item.quantity,
				rate: item.rate,
				uom: item.uom,
				warehouse: item.warehouse,
				batch_no: item.batch_no,
				serial_no: item.serial_no,
				conversion_factor: item.conversion_factor || 1,
				discount_percentage: item.discount_percentage || 0,
				discount_amount: item.discount_amount || 0,
			})),
			payments: payments.value.map((p) => ({
				mode_of_payment: p.mode_of_payment,
				amount: p.amount,
				type: p.type,
			})),
			discount_amount: additionalDiscount.value || 0,
			coupon_code: couponCode.value,
			is_pos: 1,
			update_stock: 1,
		}

		const result = await updateInvoiceResource.submit({ data: invoiceData })
		return result?.data || result
	}

	async function submitInvoice() {
		/**
		 * Two-step submission process (POSAwesome style):
		 * 1. Create/update draft invoice
		 * 2. Validate stock and submit
		 */
		try {
			// Step 1: Create invoice draft
			const invoiceData = {
			doctype: "Sales Invoice",
			pos_profile: posProfile.value,
			posa_pos_opening_shift: posOpeningShift.value,
			customer: customer.value?.name || customer.value,
			items: invoiceItems.value.map((item) => ({
				item_code: item.item_code,
				item_name: item.item_name,
				qty: item.quantity,
				rate: item.rate,
				uom: item.uom,
				warehouse: item.warehouse,
				batch_no: item.batch_no,
				serial_no: item.serial_no,
				conversion_factor: item.conversion_factor || 1,
				discount_percentage: item.discount_percentage || 0,
				discount_amount: item.discount_amount || 0,
			})),
			payments: payments.value.map((p) => ({
				mode_of_payment: p.mode_of_payment,
				amount: p.amount,
				type: p.type,
			})),
			discount_amount: additionalDiscount.value || 0,
			coupon_code: couponCode.value,
			is_pos: 1,
			update_stock: 1, // Critical: Ensures stock is updated
		}

		const draftInvoice = await updateInvoiceResource.submit({ data: invoiceData })

		let invoiceDoc = draftInvoice
		if (draftInvoice && typeof draftInvoice === 'object' && 'data' in draftInvoice) {
			invoiceDoc = draftInvoice.data
		}

		if (!invoiceDoc || !invoiceDoc.name) {
			throw new Error("Failed to create draft invoice - no invoice name returned")
		}

		const submitData = {
			change_amount: remainingAmount.value < 0 ? Math.abs(remainingAmount.value) : 0,
		}

		try {
			const result = await submitInvoiceResource.submit({
				invoice: invoiceDoc,
				data: submitData,
			})

			// Check if resource has error (frappe-ui pattern)
			if (submitInvoiceResource.error) {
				const resourceError = submitInvoiceResource.error
				console.error("Submit invoice resource error:", resourceError)

				// Create a detailed error object
				const detailedError = new Error(resourceError.message || "Invoice submission failed")
				detailedError.exc_type = resourceError.exc_type
				detailedError._server_messages = resourceError._server_messages
				detailedError.httpStatus = resourceError.httpStatus
				detailedError.messages = resourceError.messages

				throw detailedError
			}

			resetInvoice()
			return result
		} catch (error) {
			// Preserve original error object with all its properties
			console.error("Submit invoice error:", error)
			console.log("submitInvoiceResource.error:", submitInvoiceResource.error)

			// If resource has error data, extract and attach it
			if (submitInvoiceResource.error) {
				const resourceError = submitInvoiceResource.error
				console.log("Resource error details:", {
					exc_type: resourceError.exc_type,
					_server_messages: resourceError._server_messages,
					httpStatus: resourceError.httpStatus,
					messages: resourceError.messages,
					messagesContent: JSON.stringify(resourceError.messages),
					data: resourceError.data,
					exception: resourceError.exception,
					keys: Object.keys(resourceError)
				})

				// The messages array likely contains the detailed error info
				if (resourceError.messages && resourceError.messages.length > 0) {
					console.log("First message:", resourceError.messages[0])
				}

				// Attach all resource error properties to the error
				error.exc_type = resourceError.exc_type || error.exc_type
				error._server_messages = resourceError._server_messages
				error.httpStatus = resourceError.httpStatus
				error.messages = resourceError.messages
				error.exception = resourceError.exception
				error.data = resourceError.data

				console.log("After attaching, error.messages:", error.messages)
			}

			throw error
		}
	} catch (error) {
		// Outer catch to ensure error propagates
		console.error("Submit invoice outer error:", error)
		throw error
		}
	}

	function resetInvoice() {
		invoiceItems.value = []
		customer.value = null
		payments.value = []
		additionalDiscount.value = 0
		couponCode.value = null
	}

	async function clearCart() {
		invoiceItems.value = []
		payments.value = []
		additionalDiscount.value = 0
		couponCode.value = null

		// Cleanup old draft invoices (older than 1 hour) in background
		try {
			await cleanupDraftsResource.submit({
				pos_profile: posProfile.value,
				max_age_hours: 1
			})
		} catch (error) {
			// Silent fail - don't block cart clearing
			console.warn("Failed to cleanup old drafts:", error)
		}
	}

	async function loadTaxRules(profileName) {
		/**
		 * Load tax rules from POS Profile
		 */
		try {
			const result = await getTaxesResource.submit({ pos_profile: profileName })
			taxRules.value = result?.data || result || []

			// Recalculate all items with new tax rules
			invoiceItems.value.forEach(item => recalculateItem(item))

			return taxRules.value
		} catch (error) {
			console.error("Error loading tax rules:", error)
			taxRules.value = []
			return []
		}
	}

	return {
		// State
		invoiceItems,
		customer,
		payments,
		posProfile,
		posOpeningShift,
		additionalDiscount,
		couponCode,
		taxRules,

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
		calculateDiscountAmount,
		applyDiscount,
		removeDiscount,
		addPayment,
		removePayment,
		updatePayment,
		validateStock,
		saveDraft,
		submitInvoice,
		resetInvoice,
		clearCart,
		loadTaxRules,
		recalculateItem,

		// Resources
		updateInvoiceResource,
		submitInvoiceResource,
		validateCartItemsResource,
		applyOffersResource,
		getItemDetailsResource,
		getTaxesResource,
	}
}
