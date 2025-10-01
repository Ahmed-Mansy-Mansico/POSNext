<template>
	<div class="h-screen flex flex-col bg-gray-50">
		<!-- Loading State -->
		<div
			v-if="isLoading"
			class="flex-1 flex items-center justify-center bg-gray-50"
		>
			<div class="text-center">
				<div
					class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"
				></div>
				<p class="mt-4 text-sm text-gray-500">Loading...</p>
			</div>
		</div>

		<!-- Main App -->
		<template v-else>
			<!-- Header -->
		<div class="bg-white border-b border-gray-200 shadow-sm">
			<div class="px-6 py-3">
				<div class="flex justify-between items-center">
					<!-- Left Side: Logo/Brand -->
					<div class="flex items-center space-x-4">
						<div class="flex items-center space-x-3">
							<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
								<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
									<path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/>
								</svg>
							</div>
							<div>
								<h1 class="text-base font-bold text-gray-900">POS Next</h1>
								<p v-if="currentProfile" class="text-xs text-gray-500">{{ currentProfile.name }}</p>
							</div>
						</div>
					</div>

					<!-- Right Side: Controls -->
					<div class="flex items-center space-x-1">
						<!-- WiFi Status -->
						<button class="p-2 hover:bg-gray-50 rounded-lg transition-colors relative group" title="Online">
							<svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
								<path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
							</svg>
						</button>

						<!-- Printer -->
						<button class="p-2 hover:bg-gray-50 rounded-lg transition-colors group" title="Print">
							<svg class="w-5 h-5 text-gray-600 group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
							</svg>
						</button>

						<!-- Refresh -->
						<button class="p-2 hover:bg-gray-50 rounded-lg transition-colors group" title="Refresh">
							<svg class="w-5 h-5 text-gray-600 group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
							</svg>
						</button>

						<!-- Scanner -->
						<button class="p-2 hover:bg-gray-50 rounded-lg transition-colors group" title="Scan Barcode">
							<svg class="w-5 h-5 text-gray-600 group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
							</svg>
						</button>

						<div class="w-px h-6 bg-gray-200 mx-2"></div>

						<!-- Actions Dropdown -->
						<div class="relative">
							<button
								@click="showActionsMenu = !showActionsMenu"
								class="flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
							>
								<svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
									<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
								</svg>
								<span class="text-sm font-medium text-gray-700">Actions</span>
								<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
								</svg>
							</button>

							<!-- Dropdown Menu -->
							<div
								v-if="showActionsMenu"
								@click.stop
								class="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50"
							>
								<button
									v-if="hasOpenShift"
									@click="showOpenShiftDialog = true; showActionsMenu = false"
									class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center space-x-3 transition-colors"
								>
									<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									<span>View Shift</span>
								</button>
								<button
									@click="handleCloseShift; showActionsMenu = false"
									class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 flex items-center space-x-3 transition-colors"
								>
									<svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									<span>Close Shift</span>
								</button>
								<hr class="my-2 border-gray-100">
								<button
									@click="handleLogout"
									class="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 transition-colors"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
									</svg>
									<span>Logout</span>
								</button>
							</div>
						</div>

						<div class="w-px h-6 bg-gray-200 mx-2"></div>

						<!-- User Profile -->
						<div class="flex items-center space-x-3 px-2">
							<div class="text-right">
								<p class="text-sm font-semibold text-gray-900">{{ getCurrentUser() }}</p>
								<p class="text-xs text-gray-500">{{ currentTime }}</p>
							</div>
							<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
								<span class="text-sm font-bold text-white">{{ getUserInitials() }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Main Content: Two Column Layout -->
		<div v-if="hasOpenShift" class="flex-1 flex overflow-hidden">
			<!-- Left: Items Selector (2/3 width) -->
			<div class="w-2/3 border-r border-gray-200 flex flex-col bg-white">
				<ItemsSelector
					:pos-profile="currentProfile?.name"
					@item-selected="handleItemSelected"
				/>
			</div>

			<!-- Right: Invoice Cart (1/3 width) -->
			<div class="w-1/3 flex flex-col bg-gray-50">
				<InvoiceCart
					:items="invoiceItems"
					:customer="customer"
					:subtotal="subtotal"
					:tax-amount="totalTax"
					:discount-amount="totalDiscount"
					:grand-total="grandTotal"
					@update-quantity="updateItemQuantity"
					@remove-item="removeItem"
					@select-customer="showCustomerDialog = true"
					@proceed-to-payment="handleProceedToPayment"
					@clear-cart="handleClearCart"
				/>
			</div>
		</div>

		<!-- No Shift Placeholder -->
		<div v-else class="flex-1 flex items-center justify-center bg-gray-50">
			<div class="text-center">
				<div
					class="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-blue-100"
				>
					<svg
						class="h-12 w-12 text-blue-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-medium text-gray-900">
					Welcome to POS Next
				</h3>
				<p class="mt-2 text-sm text-gray-500">
					Please open a shift to start making sales
				</p>
				<Button
					variant="solid"
					theme="blue"
					@click="showOpenShiftDialog = true"
					class="mt-6"
				>
					Open Shift
				</Button>
			</div>
		</div>

		<!-- Payment Dialog -->
		<PaymentDialog
			v-model="showPaymentDialog"
			:grand-total="grandTotal"
			:pos-profile="currentProfile?.name"
			@payment-completed="handlePaymentCompleted"
		/>

		<!-- Customer Selection Dialog -->
		<CustomerDialog
			v-model="showCustomerDialog"
			:pos-profile="currentProfile?.name"
			@customer-selected="handleCustomerSelected"
		/>

		<!-- Shift Opening Dialog -->
		<ShiftOpeningDialog
			v-model="showOpenShiftDialog"
			@shift-opened="handleShiftOpened"
		/>

		<!-- Shift Closing Dialog -->
		<ShiftClosingDialog
			v-model="showCloseShiftDialog"
			:opening-shift="currentShift?.name"
			@shift-closed="handleShiftClosed"
		/>

		<!-- Success Dialog -->
		<Dialog
			v-model="showSuccessDialog"
			:options="{ title: 'Invoice Created Successfully', size: 'md' }"
		>
			<template #body-content>
				<div class="text-center py-6">
					<div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
						<svg
							class="h-6 w-6 text-green-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
					<h3 class="mt-4 text-lg font-medium text-gray-900">
						Invoice {{ lastInvoiceName }} created successfully!
					</h3>
					<p class="mt-2 text-sm text-gray-500">
						Total: {{ formatCurrency(lastInvoiceTotal) }}
					</p>
				</div>
			</template>
			<template #actions>
				<div class="flex space-x-2">
					<Button variant="subtle" @click="showSuccessDialog = false">
						Close
					</Button>
					<Button variant="solid" theme="blue" @click="handlePrintInvoice">
						Print Invoice
					</Button>
				</div>
			</template>
		</Dialog>
		</template>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue"
import { useRouter } from "vue-router"
import { useInvoice } from "@/composables/useInvoice"
import { useShift } from "@/composables/useShift"
import { Button, Dialog, toast } from "frappe-ui"
import ItemsSelector from "@/components/sale/ItemsSelector.vue"
import InvoiceCart from "@/components/sale/InvoiceCart.vue"
import PaymentDialog from "@/components/sale/PaymentDialog.vue"
import CustomerDialog from "@/components/sale/CustomerDialog.vue"
import ShiftOpeningDialog from "@/components/ShiftOpeningDialog.vue"
import ShiftClosingDialog from "@/components/ShiftClosingDialog.vue"

const router = useRouter()
const { currentProfile, currentShift, hasOpenShift, checkOpeningShift } = useShift()

const {
	invoiceItems,
	customer,
	subtotal,
	totalTax,
	totalDiscount,
	grandTotal,
	posProfile,
	addItem,
	removeItem,
	updateItemQuantity,
	submitInvoice,
	clearCart,
	submitInvoiceResource,
} = useInvoice()

const showPaymentDialog = ref(false)
const showCustomerDialog = ref(false)
const showSuccessDialog = ref(false)
const showOpenShiftDialog = ref(false)
const showCloseShiftDialog = ref(false)
const showActionsMenu = ref(false)
const lastInvoiceName = ref("")
const lastInvoiceTotal = ref(0)
const isLoading = ref(true)
const currentTime = ref("")

onMounted(async () => {
	try {
		// Update time every second
		setInterval(() => {
			const now = new Date()
			currentTime.value = now.toLocaleTimeString('en-US', { hour12: false })
		}, 1000)

		// Check for existing open shift
		await checkOpeningShift.fetch()

		// If no shift is open, show the shift opening dialog
		if (!hasOpenShift.value) {
			showOpenShiftDialog.value = true
		} else {
			// Set POS profile from current shift
			if (currentProfile.value) {
				posProfile.value = currentProfile.value.name
			}
		}

		// Add click outside listener
		document.addEventListener('click', handleClickOutside)
	} catch (error) {
		console.error("Error checking shift:", error)
	} finally {
		isLoading.value = false
	}
})

onUnmounted(() => {
	document.removeEventListener('click', handleClickOutside)
})

function handleShiftOpened() {
	showOpenShiftDialog.value = false
	// Set POS profile after shift is opened
	if (currentProfile.value) {
		posProfile.value = currentProfile.value.name
	}
	toast.create({
		title: "Shift Opened",
		text: "You can now start making sales",
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleShiftClosed() {
	showCloseShiftDialog.value = false
	toast.create({
		title: "Shift Closed",
		text: "Shift closed successfully",
		icon: "check",
		iconClasses: "text-green-600",
	})
	// Show shift opening dialog again
	setTimeout(() => {
		showOpenShiftDialog.value = true
	}, 500)
}

function handleItemSelected(item) {
	addItem(item)
	toast.create({
		title: "Item Added",
		text: `${item.item_name} added to cart`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleCustomerSelected(selectedCustomer) {
	customer.value = selectedCustomer
	showCustomerDialog.value = false
	toast.create({
		title: "Customer Selected",
		text: `${selectedCustomer.customer_name} selected`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleProceedToPayment() {
	if (invoiceItems.value.length === 0) {
		toast.create({
			title: "Empty Cart",
			text: "Please add items to cart before proceeding to payment",
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		return
	}

	showPaymentDialog.value = true
}

async function handlePaymentCompleted(paymentData) {
	try {
		// Add payments to invoice
		paymentData.payments.forEach((payment) => {
			// The payments are already added in the PaymentDialog
		})

		// Set payments directly
		const invoiceData = {
			pos_profile: posProfile.value,
			customer: customer.value?.name || customer.value,
			items: invoiceItems.value,
			payments: paymentData.payments,
		}

		const result = await submitInvoiceResource.submit({
			invoice_data: invoiceData,
		})

		if (result) {
			lastInvoiceName.value = result.name || result.message?.name || "Unknown"
			lastInvoiceTotal.value = grandTotal.value

			// Clear the cart
			clearCart()
			customer.value = null

			// Show success dialog
			showSuccessDialog.value = true

			toast.create({
				title: "Success",
				text: `Invoice ${lastInvoiceName.value} created successfully`,
				icon: "check",
				iconClasses: "text-green-600",
			})
		}
	} catch (error) {
		console.error("Error submitting invoice:", error)
		toast.create({
			title: "Error",
			text: error.message || "Failed to create invoice",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

function handleClearCart() {
	if (invoiceItems.value.length === 0) return

	if (confirm("Are you sure you want to clear the cart?")) {
		clearCart()
		customer.value = null
		toast.create({
			title: "Cart Cleared",
			text: "All items removed from cart",
			icon: "check",
			iconClasses: "text-green-600",
		})
	}
}

function handleCloseShift() {
	showCloseShiftDialog.value = true
}

function handlePrintInvoice() {
	// TODO: Implement print functionality
	console.log("Print invoice:", lastInvoiceName.value)
	showSuccessDialog.value = false
}

function formatCurrency(amount) {
	return parseFloat(amount || 0).toFixed(2)
}

function getCurrentUser() {
	if (typeof window !== 'undefined' && window.frappe?.session) {
		return window.frappe.session.user_fullname || window.frappe.session.user || "User"
	}
	return "User"
}

function getUserInitials() {
	const name = getCurrentUser()
	const parts = name.split(" ")
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase()
	}
	return name.substring(0, 2).toUpperCase()
}

function handleLogout() {
	showActionsMenu.value = false
	if (confirm("Are you sure you want to logout?")) {
		window.location.href = "/app/logout"
	}
}

// Close dropdown when clicking outside
function handleClickOutside(event) {
	if (showActionsMenu.value && !event.target.closest('.relative')) {
		showActionsMenu.value = false
	}
}
</script>
