<template>
	<div class="h-screen flex flex-col bg-gray-50">
		<!-- Loading State -->
		<LoadingSpinner v-if="isLoading" />

		<!-- Main App -->
		<template v-else>
			<!-- Header -->
			<POSHeader
				:current-time="currentTime"
				:shift-duration="shiftDuration"
				:has-open-shift="hasOpenShift"
				:profile-name="currentProfile?.name"
				:user-name="getCurrentUser()"
				:is-offline="isOffline"
				:is-syncing="isSyncing"
				:pending-invoices-count="pendingInvoicesCount"
				@sync-click="handleSyncClick"
				@printer-click="showHistoryDialog = true"
				@refresh-click="handleRefresh"
				@logout="handleLogout"
			>
				<template #menu-items>
					<button
						v-if="hasOpenShift"
						@click="showOpenShiftDialog = true"
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center space-x-3 transition-colors"
					>
						<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						<span>View Shift</span>
					</button>
					<button
						@click="showDraftDialog = true"
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 flex items-center space-x-3 transition-colors relative"
					>
						<svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
						</svg>
						<span>Draft Invoices</span>
						<span v-if="draftsCount > 0" class="ml-auto text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full">
							{{ draftsCount }}
						</span>
					</button>
					<button
						@click="showHistoryDialog = true"
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 flex items-center space-x-3 transition-colors"
					>
						<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
						</svg>
						<span>Invoice History</span>
					</button>
					<button
						@click="showReturnDialog = true"
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 flex items-center space-x-3 transition-colors"
					>
						<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
						</svg>
						<span>Return Invoice</span>
					</button>
				</template>
				<template #additional-actions>
					<button
						@click="handleCloseShift()"
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 flex items-center space-x-3 transition-colors"
					>
						<svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						<span>Close Shift</span>
					</button>
				</template>
			</POSHeader>

		<!-- Main Content: Two Column Layout -->
		<div
			v-if="hasOpenShift"
			ref="containerRef"
			class="flex-1 flex overflow-hidden relative"
		>
			<!-- Left: Items Selector -->
			<div
				:style="{ width: leftPanelWidth + 'px' }"
				class="flex flex-col bg-white overflow-hidden flex-shrink-0"
				style="will-change: width; contain: layout;"
			>
				<ItemsSelector
					ref="itemsSelectorRef"
					:pos-profile="currentProfile?.name"
					:cart-items="invoiceItems"
					:currency="currentProfile?.currency || 'USD'"
					@item-selected="handleItemSelected"
				/>
			</div>

			<!-- Draggable Divider -->
			<div
				ref="dividerRef"
				role="separator"
				aria-orientation="vertical"
				@pointerdown="startResize"
				@pointermove="handleResize"
				@pointerup="stopResize"
				@pointercancel="stopResize"
				class="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize relative flex-shrink-0 transition-all duration-100"
				:class="{
					'bg-blue-500': isResizing,
					'pointer-events-none opacity-0': isAnyDialogOpen,
					'z-[1]': !isAnyDialogOpen
				}"
			>
				<!-- Expanded hit area for easier grabbing -->
				<div
					class="absolute inset-y-0 -left-2 -right-2"
					style="cursor: col-resize;"
				></div>
				<!-- Visual handle -->
				<div
					class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-gray-400 rounded-full"
					:class="{ 'bg-blue-600': isResizing, 'bg-blue-500': !isResizing }"
					style="transition: background-color 0.1s ease; opacity: 0.8;"
				></div>
			</div>

			<!-- Right: Invoice Cart -->
			<div
				class="flex-1 flex flex-col bg-gray-50 overflow-hidden"
				style="min-width: 300px; contain: layout;"
			>
				<InvoiceCart
					:items="invoiceItems"
					:customer="customer"
					:subtotal="subtotal"
					:tax-amount="totalTax"
					:discount-amount="totalDiscount"
					:grand-total="grandTotal"
					:pos-profile="currentProfile?.name"
					:currency="currentProfile?.currency || 'USD'"
					:applied-offer="autoAppliedOffer"
					@update-quantity="updateItemQuantity"
					@remove-item="removeItem"
					@select-customer="handleCustomerSelected"
					@create-customer="handleCreateCustomer"
					@proceed-to-payment="handleProceedToPayment"
					@clear-cart="handleClearCart"
					@save-draft="handleSaveDraft"
					@apply-coupon="showCouponDialog = true"
					@show-offers="showOffersDialog = true"
					@remove-offer="handleOfferRemoved"
					@update-uom="handleUomChange"
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
			:currency="currentProfile?.currency || 'USD'"
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

		<!-- Draft Invoices Dialog -->
		<DraftInvoicesDialog
			v-model="showDraftDialog"
			:currency="currentProfile?.currency || 'USD'"
			@load-draft="handleLoadDraft"
			@drafts-updated="updateDraftsCount"
		/>

		<!-- Return Invoice Dialog -->
		<ReturnInvoiceDialog
			v-model="showReturnDialog"
			:pos-profile="currentProfile?.name"
			@return-created="handleReturnCreated"
		/>

		<!-- Coupon Dialog -->
		<CouponDialog
			v-model="showCouponDialog"
			:subtotal="subtotal"
			:items="invoiceItems"
			:pos-profile="currentProfile?.name"
			:customer="customer?.name || customer"
			:company="currentProfile?.company"
			:currency="currentProfile?.currency || 'USD'"
			:applied-coupon="appliedCoupon"
			@discount-applied="handleDiscountApplied"
			@discount-removed="handleDiscountRemoved"
		/>

		<!-- Offers Dialog -->
		<OffersDialog
			v-model="showOffersDialog"
			:subtotal="subtotal"
			:items="invoiceItems"
			:pos-profile="currentProfile?.name"
			:customer="customer?.name || customer"
			:company="currentProfile?.company"
			:currency="currentProfile?.currency || 'USD'"
			:applied-offer="autoAppliedOffer"
			@offer-applied="handleOfferApplied"
			@offer-removed="handleOfferRemoved"
		/>

		<!-- Batch/Serial Dialog -->
		<BatchSerialDialog
			v-model="showBatchSerialDialog"
			:item="pendingItem"
			:quantity="pendingItemQty"
			:warehouse="currentProfile?.warehouse"
			@batch-serial-selected="handleBatchSerialSelected"
		/>

		<!-- Generic Item Selection Dialog (for UOMs and Variants) -->
		<ItemSelectionDialog
			v-model="showItemSelectionDialog"
			:item="pendingItem"
			:mode="selectionMode"
			:pos-profile="currentProfile?.name"
			:currency="currentProfile?.currency"
			@option-selected="handleOptionSelected"
		/>

		<!-- Invoice History Dialog -->
		<InvoiceHistoryDialog
			v-model="showHistoryDialog"
			:pos-profile="currentProfile?.name"
			@create-return="handleCreateReturnFromHistory"
		/>

		<!-- Create Customer Dialog -->
		<CreateCustomerDialog
			v-model="showCreateCustomerDialog"
			:pos-profile="currentProfile?.name"
			:initial-name="initialCustomerName"
			@customer-created="handleCustomerCreated"
		/>

		<!-- Clear Cart Confirmation Dialog -->
		<Dialog
			v-model="showClearCartDialog"
			:options="{ title: 'Clear Cart?', size: 'xs' }"
		>
			<template #body-content>
				<div class="py-3">
					<p class="text-sm text-gray-600">
						Remove all {{ invoiceItems.length }} items from cart?
					</p>
				</div>
			</template>
			<template #actions>
				<div class="flex space-x-2 w-full">
					<Button class="flex-1" variant="subtle" @click="showClearCartDialog = false">
						Cancel
					</Button>
					<Button class="flex-1" variant="solid" theme="red" @click="confirmClearCart">
						Clear All
					</Button>
				</div>
			</template>
		</Dialog>

		<!-- Logout Confirmation Dialog -->
		<Dialog
			v-model="showLogoutDialog"
			:options="{ title: 'Logout', size: 'xs' }"
		>
			<template #body-content>
				<div class="py-3">
					<p class="text-sm text-gray-600">
						Are you sure you want to logout?
					</p>
				</div>
			</template>
			<template #actions>
				<div class="flex space-x-2 w-full">
					<Button class="flex-1" variant="subtle" @click="showLogoutDialog = false">
						Cancel
					</Button>
					<Button class="flex-1" variant="solid" theme="red" @click="confirmLogout">
						Logout
					</Button>
				</div>
			</template>
		</Dialog>

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

		<!-- Error Dialog -->
		<Dialog
			v-model="showErrorDialog"
			:options="{ title: errorDialogTitle || 'Error', size: 'md' }"
		>
			<template #body-content>
				<div class="py-3">
					<p class="text-sm text-gray-700 whitespace-pre-line">
						{{ errorDialogMessage || 'An unexpected error occurred.' }}
					</p>
					<div v-if="errorDetails" class="mt-3 pt-3 border-t border-gray-200">
						<p class="text-xs text-gray-500">{{ errorDetails }}</p>
					</div>
				</div>
			</template>
			<template #actions>
				<div class="flex justify-end space-x-2">
					<Button variant="subtle" @click="showErrorDialog = false">
						Close
					</Button>
					<Button
						v-if="errorRetryAction"
						variant="solid"
						@click="handleErrorRetry"
					>
						Try Again
					</Button>
				</div>
			</template>
		</Dialog>
		</template>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue"
import { useRouter } from "vue-router"
import { useInvoice } from "@/composables/useInvoice"
import { useShift } from "@/composables/useShift"
import { useOffline } from "@/composables/useOffline"
import { useDialog, useDialogState } from "@/composables/useDialogState"
import { Button, Dialog, toast } from "frappe-ui"
import { session } from "@/data/session"
import { parseError } from "@/utils/errorHandler"
import { checkStockAvailability, formatStockError } from "@/utils/stockValidator"
import LoadingSpinner from "@/components/common/LoadingSpinner.vue"
import POSHeader from "@/components/pos/POSHeader.vue"
import ItemsSelector from "@/components/sale/ItemsSelector.vue"
import InvoiceCart from "@/components/sale/InvoiceCart.vue"
import PaymentDialog from "@/components/sale/PaymentDialog.vue"
import CustomerDialog from "@/components/sale/CustomerDialog.vue"
import ShiftOpeningDialog from "@/components/ShiftOpeningDialog.vue"
import ShiftClosingDialog from "@/components/ShiftClosingDialog.vue"
import DraftInvoicesDialog from "@/components/sale/DraftInvoicesDialog.vue"
import ReturnInvoiceDialog from "@/components/sale/ReturnInvoiceDialog.vue"
import CouponDialog from "@/components/sale/CouponDialog.vue"
import OffersDialog from "@/components/sale/OffersDialog.vue"
import BatchSerialDialog from "@/components/sale/BatchSerialDialog.vue"
import InvoiceHistoryDialog from "@/components/sale/InvoiceHistoryDialog.vue"
import CreateCustomerDialog from "@/components/sale/CreateCustomerDialog.vue"
import ItemSelectionDialog from "@/components/sale/ItemSelectionDialog.vue"
import { printInvoiceByName } from "@/utils/printInvoice"
import { saveDraft, getDraftsCount, deleteDraft } from "@/utils/draftManager"
import { offlineWorker } from "@/utils/offline/workerClient"
import { cacheItemsFromServer, cacheCustomersFromServer } from "@/utils/offline"

const LEFT_PANEL_MIN = 320
const RIGHT_PANEL_MIN = 360

const router = useRouter()
const { currentProfile, currentShift, hasOpenShift, checkOpeningShift } = useShift()

const {
	isOffline,
	pendingInvoicesCount,
	isSyncing,
	saveInvoiceOffline,
	syncPending,
	cacheData,
	searchItems: searchCachedItems,
	getCacheStats,
} = useOffline()

const {
	invoiceItems,
	customer,
	subtotal,
	totalTax,
	totalDiscount,
	grandTotal,
	posProfile,
	payments,
	addItem,
	removeItem,
	updateItemQuantity,
	submitInvoice,
	clearCart,
	loadTaxRules,
	calculateDiscountAmount,
	applyDiscount,
	removeDiscount,
	applyOffersResource,
	getItemDetailsResource,
	recalculateItem,
} = useInvoice()

// Use dialog composable for automatic global tracking
const { isOpen: showPaymentDialog } = useDialog('payment')
const { isOpen: showCustomerDialog } = useDialog('customer')
const { isOpen: showSuccessDialog } = useDialog('success')
const { isOpen: showOpenShiftDialog } = useDialog('openShift')
const { isOpen: showCloseShiftDialog } = useDialog('closeShift')
const { isOpen: showDraftDialog } = useDialog('draft')
const { isOpen: showReturnDialog } = useDialog('return')
const { isOpen: showCouponDialog } = useDialog('coupon')
const { isOpen: showOffersDialog } = useDialog('offers')
const { isOpen: showBatchSerialDialog } = useDialog('batchSerial')
const { isOpen: showHistoryDialog } = useDialog('history')
const { isOpen: showCreateCustomerDialog } = useDialog('createCustomer')
const { isOpen: showClearCartDialog } = useDialog('clearCart')
const { isOpen: showLogoutDialog } = useDialog('logout')
const { isOpen: showItemSelectionDialog } = useDialog('itemSelection')
const { isOpen: showErrorDialog } = useDialog('invoiceError')

// Other refs
const itemsSelectorRef = ref(null)
const initialCustomerName = ref("")
const pendingItem = ref(null)
const pendingItemQty = ref(1)
const lastInvoiceName = ref("")
const lastInvoiceTotal = ref(0)
const errorDialogTitle = ref("")
const errorDialogMessage = ref("")
const errorDetails = ref("")
const errorType = ref("error") // 'error', 'warning', 'validation'
const errorRetryAction = ref(null)
const isLoading = ref(true)
const currentTime = ref("")
const shiftDuration = ref("")
const draftsCount = ref(0)
const containerRef = ref(null)
const dividerRef = ref(null)
const leftPanelWidth = ref(800) // Start with 800px width
const isResizing = ref(false)
const autoAppliedOffer = ref(null)
const appliedCoupon = ref(null)
const pendingPaymentAfterCustomer = ref(false)
const selectionMode = ref('uom') // 'uom' or 'variant'

// Get global dialog state for divider behavior
const { isAnyDialogOpen } = useDialogState()

// Update shift duration every second
function updateShiftDuration() {
	if (!hasOpenShift.value || !currentShift.value?.period_start_date) {
		shiftDuration.value = ""
		return
	}

	const startTime = new Date(currentShift.value.period_start_date)
	const now = new Date()
	const diff = now - startTime

	const hours = Math.floor(diff / (1000 * 60 * 60))
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
	const seconds = Math.floor((diff % (1000 * 60)) / 1000)

	shiftDuration.value = `${hours}h ${minutes}m ${seconds}s`
}

onMounted(async () => {
	window.addEventListener('resize', updateLayoutBounds)
	try {
		// Update time and shift duration every second
		setInterval(() => {
			const now = new Date()
			currentTime.value = now.toLocaleTimeString('en-US', { hour12: false })
			updateShiftDuration()
		}, 1000)

		// Initial update
		const now = new Date()
		currentTime.value = now.toLocaleTimeString('en-US', { hour12: false })
		updateShiftDuration()

		// Check for existing open shift
		await checkOpeningShift.fetch()

		// If no shift is open, show the shift opening dialog
		if (!hasOpenShift.value) {
			showOpenShiftDialog.value = true
		} else {
			// Set POS profile from current shift
			if (currentProfile.value) {
				posProfile.value = currentProfile.value.name

				// Load tax rules for this POS Profile
				await loadTaxRules(currentProfile.value.name)

				// Pre-load data for offline use if online and needed
				if (!isOffline.value) {
					// Check cache status via worker
					const cacheReady = await offlineWorker.isCacheReady()
					const stats = await offlineWorker.getCacheStats()
					const needsRefresh = !stats.lastSync || (Date.now() - stats.lastSync) > (24 * 60 * 60 * 1000)

					if (!cacheReady || needsRefresh) {
						toast.create({
							title: "Syncing Data",
							text: "Loading items and customers for offline use...",
							icon: "download",
							iconClasses: "text-blue-600",
						})

						try {
							// Fetch from server (main thread - uses window.frappe.call)
							const [itemsData, customersData] = await Promise.all([
								cacheItemsFromServer(currentProfile.value.name),
								cacheCustomersFromServer(currentProfile.value.name)
							])

							// Cache via worker (background thread)
							await Promise.all([
								offlineWorker.cacheItems(itemsData.items || []),
								offlineWorker.cacheCustomers(customersData.customers || [])
							])

							toast.create({
								title: "Sync Complete",
								text: "Data is ready for offline use",
								icon: "check",
								iconClasses: "text-green-600",
							})
						} catch (error) {
							console.error('Error pre-loading data:', error)
							toast.create({
								title: "Sync Warning",
								text: "Some data may not be available offline",
								icon: "alert-circle",
								iconClasses: "text-orange-600",
							})
						}
					}
				} else {
					// Check if cache is available when offline
					const cacheReady = await offlineWorker.isCacheReady()
					if (!cacheReady) {
						// Show warning if offline and no cache
						toast.create({
							title: "Limited Functionality",
							text: "POS is offline without cached data. Please connect to sync.",
							icon: "alert-circle",
							iconClasses: "text-orange-600",
						})
					}
				}
			}
		}

		requestAnimationFrame(updateLayoutBounds)

		// Update drafts count
		await updateDraftsCount()
	} catch (error) {
		console.error("Error checking shift:", error)
	} finally {
		isLoading.value = false
	}
})

watch(hasOpenShift, value => {
	if (value && typeof window !== 'undefined') {
		requestAnimationFrame(updateLayoutBounds)
	}
})

// Watch cart changes to auto-apply eligible offers with debouncing
let autoApplyTimeout = null
watch([invoiceItems, subtotal], async (newVal, oldVal) => {
	// Clear any pending auto-apply
	if (autoApplyTimeout) {
		clearTimeout(autoApplyTimeout)
	}

	// Only auto-apply if:
	// 1. Cart is not empty
	// 2. POS profile is set
	// 3. No offer is currently applied (to avoid overwriting manual selections)
	if (invoiceItems.value.length > 0 && posProfile.value && !autoAppliedOffer.value) {
		// Debounce for 500ms to avoid excessive API calls
		autoApplyTimeout = setTimeout(async () => {
			await autoApplyOffers()
		}, 500)
	} else if (invoiceItems.value.length === 0) {
		// Clear auto-applied offers when cart is emptied
		autoAppliedOffer.value = null
	}
}, { deep: true })

// Watch for items changes and re-apply offer if one is already applied
watch(invoiceItems, () => {
	if (autoAppliedOffer.value && invoiceItems.value.length > 0) {
		// Re-apply the current offer to new items
		applyDiscount(autoAppliedOffer.value)
	}
}, { deep: true })

onUnmounted(() => {
	// Clean up timeout
	if (autoApplyTimeout) {
		clearTimeout(autoApplyTimeout)
	}

	// Clean up event listeners
	window.removeEventListener('resize', updateLayoutBounds)
	stopResize()
})

async function handleShiftOpened() {
	showOpenShiftDialog.value = false
	// Set POS profile after shift is opened
	if (currentProfile.value) {
		posProfile.value = currentProfile.value.name
		// Load tax rules for this POS Profile
		await loadTaxRules(currentProfile.value.name)
	}
	// Update shift duration immediately
	updateShiftDuration()
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
	// Priority 1: Check if item is a template with variants
	if (item.has_variants) {
		pendingItem.value = item
		pendingItemQty.value = 1
		selectionMode.value = 'variant'
		showItemSelectionDialog.value = true
		return
	}

	// Priority 2: Check if item has multiple UOMs
	if (item.item_uoms && item.item_uoms.length > 0) {
		pendingItem.value = item
		pendingItemQty.value = 1
		selectionMode.value = 'uom'
		showItemSelectionDialog.value = true
		return
	}

	// Priority 3: Check if item requires batch/serial selection
	if (item.has_batch_no || item.has_serial_no) {
		pendingItem.value = item
		pendingItemQty.value = 1
		showBatchSerialDialog.value = true
		return
	}

	// Priority 4: Check stock availability before adding to cart
	const warehouse = item.warehouse || currentProfile.value?.warehouse
	const actualQty = item.actual_qty !== undefined ? item.actual_qty : (item.stock_qty || 0)

	// Check if item has stock information and validate
	if (warehouse && actualQty !== undefined && actualQty !== null) {
		const stockCheck = checkStockAvailability({
			itemCode: item.item_code,
			qty: 1,
			warehouse: warehouse,
			actualQty: actualQty
		})

		if (!stockCheck.available) {
			const errorMsg = formatStockError(
				item.item_name,
				1,
				stockCheck.actualQty,
				warehouse
			)

			// Show error dialog
			errorDialogTitle.value = "Insufficient Stock"
			errorDialogMessage.value = errorMsg
			errorDetails.value = `Item: ${item.item_code} | Warehouse: ${warehouse} | Available: ${stockCheck.actualQty}`
			errorRetryAction.value = null
			showErrorDialog.value = true

			return
		}
	}

	// Add to cart
	addItem(item)
	toast.create({
		title: "Item Added",
		text: `${item.item_name} added to cart`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleCustomerSelected(selectedCustomer) {
	if (selectedCustomer) {
		customer.value = selectedCustomer
		showCustomerDialog.value = false
		toast.create({
			title: "Customer Selected",
			text: `${selectedCustomer.customer_name} selected`,
			icon: "check",
			iconClasses: "text-green-600",
		})

		// If there was a pending payment, continue to payment dialog
		if (pendingPaymentAfterCustomer.value) {
			pendingPaymentAfterCustomer.value = false
			showPaymentDialog.value = true
		}
	} else {
		// Clear customer
		customer.value = null
	}
}

function handleCreateCustomer(searchValue) {
	initialCustomerName.value = searchValue || ""
	showCreateCustomerDialog.value = true
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

	// Check if customer is selected
	const customerValue = customer.value?.name || customer.value
	if (!customerValue && !currentProfile.value?.customer) {
		toast.create({
			title: "Customer Required",
			text: "Please select a customer before proceeding",
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		showCustomerDialog.value = true
		// Set flag to continue to payment after customer selection
		pendingPaymentAfterCustomer.value = true
		return
	}

	showPaymentDialog.value = true
}

function handleErrorRetry() {
	showErrorDialog.value = false
	if (errorRetryAction.value === 'payment') {
		// Retry payment
		setTimeout(() => {
			showPaymentDialog.value = true
		}, 300)
	}
}

async function handlePaymentCompleted(paymentData) {
	try {
		// Validate customer
		const customerValue = customer.value?.name || customer.value
		if (!customerValue && !currentProfile.value?.customer) {
			toast.create({
				title: "Customer Required",
				text: "Please select a customer before proceeding",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
			showPaymentDialog.value = false
			showCustomerDialog.value = true
			return
		}

		payments.value = []
		if (paymentData.payments && Array.isArray(paymentData.payments)) {
			paymentData.payments.forEach(p => {
				payments.value.push({
					mode_of_payment: p.mode_of_payment,
					amount: p.amount,
					type: p.type
				})
			})
		}

		if (isOffline.value) {
			await saveInvoiceOffline({
				pos_profile: posProfile.value,
				customer: customerValue || currentProfile.value?.customer,
				items: invoiceItems.value,
				payments: payments.value,
			})

			lastInvoiceName.value = `OFFLINE-${Date.now()}`
			lastInvoiceTotal.value = grandTotal.value
			showPaymentDialog.value = false

			clearCart()
			customer.value = null
			showSuccessDialog.value = true

			toast.create({
				title: "Saved Offline",
				text: "Invoice saved and will sync when online",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
		} else {
			const result = await submitInvoice()

			if (result) {
				lastInvoiceName.value = result.name || result.message?.name || "Unknown"
				lastInvoiceTotal.value = result.grand_total || result.total || 0
				showPaymentDialog.value = false
				clearCart()
				customer.value = null
				autoAppliedOffer.value = null

				if (itemsSelectorRef.value) {
					itemsSelectorRef.value.loadItems()
				}

				// Check if auto-print is enabled
				const autoPrint = currentProfile.value?.print_receipt_on_order_complete
				if (autoPrint) {
					try {
						await printInvoiceByName(lastInvoiceName.value)
						toast.create({
							title: "Success",
							text: `Invoice ${lastInvoiceName.value} created and sent to printer`,
							icon: "check",
							iconClasses: "text-green-600",
						})
					} catch (error) {
						console.error("Auto-print error:", error)
						toast.create({
							title: "Invoice Created",
							text: `Invoice ${lastInvoiceName.value} created but print failed`,
							icon: "alert-circle",
							iconClasses: "text-orange-600",
						})
					}
				} else {
					showSuccessDialog.value = true
					toast.create({
						title: "Success",
						text: `Invoice ${lastInvoiceName.value} created successfully`,
						icon: "check",
						iconClasses: "text-green-600",
					})
				}
			}
		}
	} catch (error) {
		console.error("Error submitting invoice:", error)

		// IMPORTANT: Close payment dialog immediately to prevent UI hang
		showPaymentDialog.value = false

		// Parse error using common error handler
		const errorContext = parseError(error)

		// Set error dialog state
		errorDialogTitle.value = errorContext.title || 'Error'
		errorDialogMessage.value = errorContext.message || 'An unexpected error occurred'
		errorDetails.value = errorContext.technicalDetails || null
		errorType.value = errorContext.type || 'error'
		errorRetryAction.value = errorContext.retryable ? 'payment' : null

		// Show error dialog
		showErrorDialog.value = true

		// Show toast notification
		const toastIconClass =
			errorContext.type === 'error' ? 'text-red-600' :
			errorContext.type === 'warning' ? 'text-orange-600' :
			'text-yellow-600'

		toast.create({
			title: errorContext.title,
			text: errorContext.message,
			icon: "alert-circle",
			iconClasses: toastIconClass,
			timeout: 6000,
		})
	}
}

function handleClearCart() {
	if (invoiceItems.value.length === 0) return
	showClearCartDialog.value = true
}

function confirmClearCart() {
	clearCart()
	customer.value = null
	autoAppliedOffer.value = null
	showClearCartDialog.value = false
	toast.create({
		title: "Cart Cleared",
		text: "All items removed from cart",
		icon: "check",
		iconClasses: "text-green-600",
	})
}

async function handleOptionSelected(option) {
	if (!pendingItem.value) return

	try {
		if (option.type === 'variant') {
			// Handle variant selection
			const variant = option.data

			// Check if variant needs UOM selection
			if (variant.item_uoms && variant.item_uoms.length > 0) {
				// Switch to UOM selection for this variant
				pendingItem.value = variant
				selectionMode.value = 'uom'
				// Dialog stays open, will reload with UOM options
				return
			}

			// Check if variant needs batch/serial
			if (variant.has_batch_no || variant.has_serial_no) {
				pendingItem.value = variant
				showItemSelectionDialog.value = false
				showBatchSerialDialog.value = true
			} else {
				// Add variant directly
				addItem(variant, pendingItemQty.value)
				showItemSelectionDialog.value = false
				pendingItem.value = null
				toast.create({
					title: "Variant Added",
					text: `${variant.item_name} added to cart`,
					icon: "check",
					iconClasses: "text-green-600",
				})
			}
		} else if (option.type === 'uom') {
			// Handle UOM selection
			const itemDetails = await getItemDetailsResource.submit({
				item_code: pendingItem.value.item_code,
				pos_profile: posProfile.value,
				customer: customer.value?.name || customer.value,
				qty: pendingItemQty.value,
				uom: option.uom
			})

			const itemToAdd = {
				...pendingItem.value,
				uom: option.uom,
				conversion_factor: option.conversion_factor,
				rate: itemDetails.price_list_rate || itemDetails.rate,
				price_list_rate: itemDetails.price_list_rate
			}

			// Check if it needs batch/serial after UOM selection
			if (itemToAdd.has_batch_no || itemToAdd.has_serial_no) {
				pendingItem.value = itemToAdd
				showItemSelectionDialog.value = false
				showBatchSerialDialog.value = true
			} else {
				addItem(itemToAdd, pendingItemQty.value)
				showItemSelectionDialog.value = false
				pendingItem.value = null
				toast.create({
					title: "Item Added",
					text: `${itemToAdd.item_name} (${option.uom}) added to cart`,
					icon: "check",
					iconClasses: "text-green-600",
				})
			}
		}
	} catch (error) {
		console.error("Error handling option selection:", error)
		toast.create({
			title: "Error",
			text: "Failed to process selection. Please try again.",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

async function handleUomChange(itemCode, newUom) {
	try {
		// Find the item in cart first to get actual quantity
		const cartItem = invoiceItems.value.find(i => i.item_code === itemCode)
		if (!cartItem) return

		// Fetch item details with new UOM and actual cart quantity
		const itemDetails = await getItemDetailsResource.submit({
			item_code: itemCode,
			pos_profile: posProfile.value,
			customer: customer.value?.name || customer.value,
			qty: cartItem.quantity,
			uom: newUom
		})

		// Find conversion factor from item_uoms
		const uomData = cartItem.item_uoms?.find(u => u.uom === newUom)

		cartItem.uom = newUom
		cartItem.conversion_factor = uomData?.conversion_factor || itemDetails.conversion_factor || 1
		cartItem.rate = itemDetails.price_list_rate || itemDetails.rate
		cartItem.price_list_rate = itemDetails.price_list_rate

		// Recalculate taxes, discounts, and totals for this item
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

function handleCloseShift() {
	showCloseShiftDialog.value = true
}

async function handlePrintInvoice() {
	try {
		await printInvoiceByName(lastInvoiceName.value)
		showSuccessDialog.value = false
	} catch (error) {
		console.error("Error printing invoice:", error)
		toast.create({
			title: "Print Error",
			text: "Failed to print invoice. Please try again.",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
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

function handleLogout() {
	showLogoutDialog.value = true
}

function confirmLogout() {
	showLogoutDialog.value = false
	session.logout.submit()
}
async function handleSaveDraft() {
	if (invoiceItems.value.length === 0) {
		toast.create({
			title: "Empty Cart",
			text: "Cannot save an empty cart as draft",
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		return
	}

	try {
		const draftData = {
			pos_profile: posProfile.value,
			customer: customer.value,
			items: invoiceItems.value,
		}

		await saveDraft(draftData)

		// Clear cart after saving
		clearCart()
		customer.value = null

		// Update drafts count
		await updateDraftsCount()

		toast.create({
			title: "Draft Saved",
			text: "Invoice saved as draft successfully",
			icon: "check",
			iconClasses: "text-green-600",
		})
	} catch (error) {
		console.error("Error saving draft:", error)
		toast.create({
			title: "Error",
			text: "Failed to save draft",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

async function handleLoadDraft(draft) {
	try {
		// Load items into cart
		invoiceItems.value = draft.items || []

		// Load customer
		customer.value = draft.customer

		// Delete the draft after loading (to prevent duplicates)
		await deleteDraft(draft.draft_id)

		// Update drafts count
		await updateDraftsCount()

		// Close dialog
		showDraftDialog.value = false

		toast.create({
			title: "Draft Loaded",
			text: "Draft invoice loaded successfully",
			icon: "check",
			iconClasses: "text-green-600",
		})
	} catch (error) {
		console.error("Error loading draft:", error)
		toast.create({
			title: "Error",
			text: "Failed to load draft",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

async function updateDraftsCount() {
	try {
		draftsCount.value = await getDraftsCount()
	} catch (error) {
		console.error("Error getting drafts count:", error)
	}
}

function handleReturnCreated(returnInvoice) {
	toast.create({
		title: "Return Created",
		text: `Return invoice ${returnInvoice.name} created successfully`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleDiscountApplied(discount) {
	// Use the composable's applyDiscount function
	applyDiscount(discount)
	appliedCoupon.value = discount
	showCouponDialog.value = false

	toast.create({
		title: "Coupon Applied",
		text: `${discount.name} applied successfully`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleDiscountRemoved() {
	// Use the composable's removeDiscount function
	removeDiscount()
	autoAppliedOffer.value = null
	appliedCoupon.value = null

	toast.create({
		title: "Discount Removed",
		text: "Discount has been removed from cart",
		icon: "check",
		iconClasses: "text-blue-600",
	})
}

function handleOfferApplied(offer) {
	// Use the composable's applyDiscount function
	applyDiscount(offer)
	autoAppliedOffer.value = offer
	showOffersDialog.value = false

	toast.create({
		title: "Offer Applied",
		text: `${offer.name} applied successfully`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleOfferRemoved() {
	// Use the composable's removeDiscount function
	removeDiscount()
	autoAppliedOffer.value = null

	toast.create({
		title: "Offer Removed",
		text: "Offer has been removed from cart",
		icon: "check",
		iconClasses: "text-blue-600",
	})
}

async function autoApplyOffers() {
	// Automatically apply eligible offers from the backend
	try {
		// Clear auto-applied flag if cart is empty
		if (invoiceItems.value.length === 0) {
			autoAppliedOffer.value = null
			return
		}

		const invoiceData = {
			doctype: "Sales Invoice",
			pos_profile: posProfile.value,
			customer: customer.value?.name || customer.value || currentProfile.value?.customer,
			items: invoiceItems.value.map(item => ({
				item_code: item.item_code,
				item_name: item.item_name,
				qty: item.quantity,
				rate: item.rate,
				uom: item.uom,
				warehouse: item.warehouse,
				conversion_factor: item.conversion_factor || 1,
			})),
		}

		const result = await applyOffersResource.submit({ invoice_data: invoiceData })

		if (result && result.items) {
			let hasDiscounts = false
			const discountedItems = []

			// Collect items with discounts
			result.items.forEach(serverItem => {
				const cartItem = invoiceItems.value.find(i => i.item_code === serverItem.item_code)
				if (cartItem && serverItem.discount_percentage > 0) {
					discountedItems.push({
						item: cartItem,
						discount_percentage: serverItem.discount_percentage,
						discount_amount: serverItem.discount_amount || 0
					})
					hasDiscounts = true
				}
			})

			// Apply all discounts at once using the composable
			if (hasDiscounts) {
				discountedItems.forEach(({ item, discount_percentage, discount_amount }) => {
					item.discount_percentage = discount_percentage
					item.discount_amount = discount_amount
					updateItemQuantity(item.item_code, item.quantity)
				})

				autoAppliedOffer.value = { name: "Auto Offer", applied: true }

				toast.create({
					title: "Offers Applied",
					text: "Eligible offers have been applied to your cart",
					icon: "check",
					iconClasses: "text-green-600",
				})
			} else {
				autoAppliedOffer.value = null
			}
		}
	} catch (error) {
		// Silently fail - don't interrupt the user experience
		console.error("Error auto-applying offers:", error)
	}
}

function handleBatchSerialSelected(batchSerial) {
	if (pendingItem.value) {
		// Add item with batch/serial info
		const itemToAdd = {
			...pendingItem.value,
			quantity: pendingItemQty.value,
			...batchSerial
		}
		addItem(itemToAdd)

		toast.create({
			title: "Item Added",
			text: `${pendingItem.value.item_name} added to cart`,
			icon: "check",
			iconClasses: "text-green-600",
		})

		pendingItem.value = null
		pendingItemQty.value = 1
	}
}

function handleCreateReturnFromHistory(invoice) {
	// Open return dialog with pre-filled invoice
	showReturnDialog.value = true
	toast.create({
		title: "Create Return",
		text: `Creating return for invoice ${invoice.name}`,
		icon: "alert-circle",
		iconClasses: "text-orange-600",
	})
}

function handleCustomerCreated(newCustomer) {
	customer.value = newCustomer
	showCreateCustomerDialog.value = false
	toast.create({
		title: "Customer Created",
		text: `${newCustomer.customer_name} created and selected`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleRefresh() {
	if (itemsSelectorRef.value) {
		itemsSelectorRef.value.loadItems()
		toast.create({
			title: "Refreshed",
			text: "Items list has been refreshed",
			icon: "check",
			iconClasses: "text-green-600",
		})
	}
}


async function handleSyncClick() {
	if (isOffline.value) {
		toast.create({
			title: "Offline Mode",
			text: `${pendingInvoicesCount.value} invoice(s) pending sync`,
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		return
	}

	if (pendingInvoicesCount.value === 0) {
		toast.create({
			title: "All Synced",
			text: "No pending invoices to sync",
			icon: "check",
			iconClasses: "text-green-600",
		})
		return
	}

	try {
		const result = await syncPending()

		if (result.success > 0) {
			toast.create({
				title: "Sync Complete",
				text: `${result.success} invoice(s) synced successfully`,
				icon: "check",
				iconClasses: "text-green-600",
			})
		}

		if (result.failed > 0) {
			toast.create({
				title: "Partial Sync",
				text: `${result.failed} invoice(s) failed to sync`,
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
		}
	} catch (error) {
		console.error('Sync error:', error)
		toast.create({
			title: "Sync Failed",
			text: error.message || "Failed to sync invoices",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

// Resizable layout helpers
let resizeState = null
let bodyStyleSnapshot = null

function clampLeftPanelWidth(width, containerWidth) {
	const safeContainerWidth = Number.isFinite(containerWidth) && containerWidth > 0
		? containerWidth
		: LEFT_PANEL_MIN + RIGHT_PANEL_MIN
	const maxWidth = Math.max(LEFT_PANEL_MIN, safeContainerWidth - RIGHT_PANEL_MIN)
	const clampedWidth = Math.min(Math.max(width, LEFT_PANEL_MIN), maxWidth)
	return Number.isFinite(clampedWidth) ? clampedWidth : LEFT_PANEL_MIN
}

function updateLayoutBounds() {
	if (!containerRef.value) return
	const containerWidth = containerRef.value.offsetWidth
	leftPanelWidth.value = clampLeftPanelWidth(leftPanelWidth.value, containerWidth)
}

function startResize(event) {
	if (!containerRef.value || !dividerRef.value) return
	if (event.isPrimary === false) return
	if (event.button !== undefined && event.button !== 0 && event.pointerType !== 'touch') return

	updateLayoutBounds()

	resizeState = {
		pointerId: event.pointerId,
		startX: event.clientX,
		startWidth: leftPanelWidth.value,
		containerWidth: containerRef.value?.offsetWidth ?? LEFT_PANEL_MIN + RIGHT_PANEL_MIN
	}

	isResizing.value = true
	bodyStyleSnapshot = {
		cursor: document.body.style.cursor,
		userSelect: document.body.style.userSelect
	}

	dividerRef.value.setPointerCapture?.(event.pointerId)
	document.body.style.cursor = 'col-resize'
	document.body.style.userSelect = 'none'
	event.preventDefault()
}

function handleResize(event) {
	if (!isResizing.value || !resizeState || (event.pointerId ?? resizeState.pointerId) !== resizeState.pointerId) {
		return
	}

	event.preventDefault()

	const containerWidth = containerRef.value?.offsetWidth ?? resizeState.containerWidth
	resizeState.containerWidth = containerWidth

	const deltaX = event.clientX - resizeState.startX
	const rawWidth = resizeState.startWidth + deltaX

	leftPanelWidth.value = clampLeftPanelWidth(rawWidth, containerWidth)
}

function stopResize(event) {
	if (!isResizing.value || !resizeState) {
		return
	}

	if (event?.pointerId !== undefined && event.pointerId !== resizeState.pointerId) {
		return
	}

	if (event?.preventDefault) {
		event.preventDefault()
	}

	if (dividerRef.value?.hasPointerCapture?.(resizeState.pointerId)) {
		dividerRef.value.releasePointerCapture(resizeState.pointerId)
	}

	isResizing.value = false
	resizeState = null
	restoreBodyStyles()
	updateLayoutBounds()
}

function restoreBodyStyles() {
	if (!bodyStyleSnapshot) {
		return
	}

	document.body.style.cursor = bodyStyleSnapshot.cursor || ''
	document.body.style.userSelect = bodyStyleSnapshot.userSelect || ''
	bodyStyleSnapshot = null
}
</script>
