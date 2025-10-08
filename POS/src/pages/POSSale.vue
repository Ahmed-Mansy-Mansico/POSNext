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
				:is-any-dialog-open="isAnyDialogOpen"
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
						v-if="pendingInvoicesCount > 0"
						@click="showOfflineInvoicesDialog = true; loadPendingInvoices()"
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 flex items-center space-x-3 transition-colors relative"
					>
						<svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						<span>Offline Invoices</span>
						<span class="ml-auto text-xs bg-orange-600 text-white px-1.5 py-0.5 rounded-full">
							{{ pendingInvoicesCount }}
						</span>
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

		<!-- Main Content: Responsive Layout -->
		<div
			v-if="hasOpenShift"
			ref="containerRef"
			class="flex-1 flex flex-col lg:flex-row overflow-hidden relative"
		>
			<!-- Mobile Tab Navigation -->
			<div
				class="lg:hidden bg-white border-b border-gray-200 flex shadow-sm sticky top-0 transition-all z-[100]"
			>
				<button
					@click="mobileActiveTab = 'items'"
					:class="[
						'flex-1 px-3 py-3 text-sm font-semibold transition-all relative touch-manipulation active:scale-95',
						mobileActiveTab === 'items'
							? 'text-blue-600 border-b-3 border-blue-600 bg-blue-50'
							: 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 active:bg-gray-100'
					]"
					:aria-label="'View items'"
					:aria-selected="mobileActiveTab === 'items'"
					role="tab"
				>
					<div class="flex items-center justify-center space-x-1.5">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
						</svg>
						<span>Items</span>
					</div>
				</button>
				<button
					@click="mobileActiveTab = 'cart'"
					:class="[
						'flex-1 px-3 py-3 text-sm font-semibold transition-all relative touch-manipulation active:scale-95',
						mobileActiveTab === 'cart'
							? 'text-blue-600 border-b-3 border-blue-600 bg-blue-50'
							: 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 active:bg-gray-100'
					]"
					:aria-label="'View cart'"
					:aria-selected="mobileActiveTab === 'cart'"
					role="tab"
				>
					<div class="flex items-center justify-center space-x-1.5">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
						</svg>
						<span>Cart</span>
						<span v-if="invoiceItems.length > 0" class="bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shadow-sm">
							{{ invoiceItems.length }}
						</span>
					</div>
				</button>
			</div>

			<!-- Left: Items Selector (Desktop) / Tab Content (Mobile) -->
			<div
				:style="{ width: isDesktop ? leftPanelWidth + 'px' : '100%' }"
				:class="[
					'flex flex-col bg-white overflow-hidden',
					isDesktop ? 'flex-shrink-0' : '',
					mobileActiveTab === 'items' ? 'flex-1' : 'hidden lg:flex'
				]"
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

			<!-- Draggable Divider (Desktop Only) -->
			<div
				v-if="isDesktop"
				ref="dividerRef"
				role="separator"
				aria-orientation="vertical"
				@pointerdown="startResize"
				@pointermove="handleResize"
				@pointerup="stopResize"
				@pointercancel="stopResize"
				class="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize relative flex-shrink-0 transition-all duration-100 hidden lg:block"
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

			<!-- Right: Invoice Cart (Desktop) / Tab Content (Mobile) -->
			<div
				:class="[
					'flex flex-col bg-gray-50 overflow-hidden',
					isDesktop ? 'flex-1' : '',
					mobileActiveTab === 'cart' ? 'flex-1' : 'hidden lg:flex lg:flex-1'
				]"
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
					@remove-offer="handleRemoveOffer"
					@update-uom="handleUomChange"
				/>
			</div>

			<!-- Mobile Floating Cart Button (when on items tab) -->
			<button
				v-if="!isDesktop && mobileActiveTab === 'items' && invoiceItems.length > 0"
				@click="mobileActiveTab = 'cart'"
				class="lg:hidden fixed bottom-6 right-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full p-4 shadow-2xl hover:shadow-3xl hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 transition-all z-50 touch-manipulation active:scale-95 ring-4 ring-blue-100"
				:aria-label="'View cart with ' + invoiceItems.length + ' items'"
			>
				<div class="relative">
					<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
					</svg>
					<span class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] px-1 flex items-center justify-center shadow-lg animate-pulse">
						{{ invoiceItems.length }}
					</span>
				</div>
			</button>
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
			:is-offline="isOffline"
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
                        ref="offersDialogRef"
                        v-model="showOffersDialog"
                        :subtotal="subtotal"
                        :items="invoiceItems"
                        :pos-profile="currentProfile?.name"
                        :customer="customer?.name || customer"
                        :company="currentProfile?.company"
                        :currency="currentProfile?.currency || 'USD'"
                        :applied-offer="autoAppliedOffer"
                        @apply-offer="handleApplyOffer"
                        @remove-offer="handleRemoveOffer"
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

		<!-- Offline Invoices Dialog -->
		<OfflineInvoicesDialog
			v-model="showOfflineInvoicesDialog"
			:is-offline="isOffline"
			:pending-invoices="pendingInvoicesList"
			:is-syncing="isSyncing"
			:currency="currentProfile?.currency || 'USD'"
			@sync-all="handleSyncAll"
			@delete-invoice="handleDeleteOfflineInvoice"
			@edit-invoice="handleEditOfflineInvoice"
			@refresh="loadPendingInvoices"
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
				<div class="flex justify-between items-center w-full">
					<Button
						v-if="errorRetryAction === 'sync' && errorRetryActionData?.failedInvoiceId"
						variant="outline"
						theme="red"
						@click="handleDeleteFailedInvoice"
					>
						Delete Invoice
					</Button>
					<div v-else></div>
					<div class="flex space-x-2">
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
import OfflineInvoicesDialog from "@/components/sale/OfflineInvoicesDialog.vue"
import CreateCustomerDialog from "@/components/sale/CreateCustomerDialog.vue"
import ItemSelectionDialog from "@/components/sale/ItemSelectionDialog.vue"
import { printInvoiceByName } from "@/utils/printInvoice"
import { saveDraft, getDraftsCount, deleteDraft } from "@/utils/draftManager"
import { cacheItemsFromServer, cacheCustomersFromServer, cachePaymentMethodsFromServer } from "@/utils/offline"

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
	getPending,
	deletePending,
	cacheData,
	searchItems: searchCachedItems,
	checkCacheReady,
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
const { isOpen: showOfflineInvoicesDialog } = useDialog('offlineInvoices')
const { isOpen: showCreateCustomerDialog } = useDialog('createCustomer')
const { isOpen: showClearCartDialog } = useDialog('clearCart')
const { isOpen: showLogoutDialog } = useDialog('logout')
const { isOpen: showItemSelectionDialog } = useDialog('itemSelection')
const { isOpen: showErrorDialog } = useDialog('invoiceError')

// Other refs
const itemsSelectorRef = ref(null)
const offersDialogRef = ref(null)
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
const errorRetryActionData = ref(null)
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
const pendingInvoicesList = ref([])

// Mobile responsiveness
const mobileActiveTab = ref('items') // 'items' or 'cart'
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

// Computed property for desktop detection
const isDesktop = computed(() => windowWidth.value >= 1024)

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
	// Window resize listeners
	const handleResize = () => {
		windowWidth.value = window.innerWidth
		updateLayoutBounds()
	}
	window.addEventListener('resize', handleResize)

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
					// Check cache status
					const cacheReady = await checkCacheReady()
					const stats = await getCacheStats()
					const needsRefresh = !stats.lastSync || (Date.now() - stats.lastSync) > (24 * 60 * 60 * 1000)

					if (!cacheReady || needsRefresh) {
						toast.create({
							title: "Syncing Data",
							text: "Loading items and customers for offline use...",
							icon: "download",
							iconClasses: "text-blue-600",
						})

						try {
							// Fetch from server
							const [itemsData, customersData, paymentMethodsData] = await Promise.all([
								cacheItemsFromServer(currentProfile.value.name),
								cacheCustomersFromServer(currentProfile.value.name),
								cachePaymentMethodsFromServer(currentProfile.value.name)
							])

							// Cache data using composable
							await cacheData(itemsData.items || [], customersData.customers || [])

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
					const cacheReady = await checkCacheReady()
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

	updateLayoutBounds()

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
		updateLayoutBounds()
	}
})

// Watch for cart changes - clear offers if cart is emptied, re-apply if items added
let suppressOfferReapply = false
watch(invoiceItems, async () => {
        if (suppressOfferReapply) {
                suppressOfferReapply = false
                return
        }

        // Clear offers when cart is empty
        if (invoiceItems.value.length === 0 && autoAppliedOffer.value) {
                autoAppliedOffer.value = null
                return
        }

        // Re-apply offer when items are added and an offer is already applied
        if (invoiceItems.value.length > 0 && autoAppliedOffer.value) {
                try {
                        const invoiceData = buildInvoiceDataForOffers()
                        const offerNames = [autoAppliedOffer.value.code]

                        const response = await applyOffersResource.submit({
                                invoice_data: invoiceData,
                                selected_offers: offerNames,
                        })

                        const payload = response?.message || response || {}
                        const responseItems = payload.items || []

                        suppressOfferReapply = true
                        applyServerDiscounts(responseItems)
                } catch (error) {
                        console.error("Error re-applying offer:", error)
                }
        }
}, { deep: true })

onUnmounted(() => {
	// Clean up event listeners
	const handleResize = () => {
		windowWidth.value = window.innerWidth
		updateLayoutBounds()
	}
	window.removeEventListener('resize', handleResize)
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

function handleItemSelected(item, autoAdd = false) {
	// When auto-add mode is active, skip all dialogs and add with defaults
	if (autoAdd) {
		// Check stock availability before adding to cart
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

				// Show error but don't block in auto-add mode
				toast.create({
					title: "Insufficient Stock",
					text: errorMsg,
					icon: "alert-circle",
					iconClasses: "text-red-600",
				})

				return
			}
		}

		// Add to cart directly with default UOM (stock UOM)
		addItem(item)

		// Auto-switch to cart tab on mobile after adding item
		if (!isDesktop.value) {
			mobileActiveTab.value = 'cart'
		}

		// Show toast AFTER successful add
		setTimeout(() => {
			toast.create({
				title: "✓ Auto-Added to Cart",
				text: `${item.item_name} added to cart`,
				icon: "check",
				iconClasses: "text-blue-600",
			})
		}, 100)

		return
	}

	// Normal mode: Show dialogs as needed
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

	// Auto-switch to cart tab on mobile after adding item
	if (!isDesktop.value) {
		mobileActiveTab.value = 'cart'
	}

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

async function handleDeleteFailedInvoice() {
	if (!errorRetryActionData.value?.failedInvoiceId) return

	const invoiceId = errorRetryActionData.value.failedInvoiceId
	showErrorDialog.value = false

	try {
		await deletePending(invoiceId)
		await loadPendingInvoices()

		toast.create({
			title: "Invoice Deleted",
			text: "Failed invoice has been removed from the offline queue",
			icon: "check",
			iconClasses: "text-green-600",
		})
	} catch (error) {
		console.error('Error deleting failed invoice:', error)
		toast.create({
			title: "Delete Failed",
			text: error.message || "Failed to delete the invoice",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

async function handleErrorRetry() {
	showErrorDialog.value = false
	if (errorRetryAction.value === 'payment') {
		// Retry payment
		setTimeout(() => {
			showPaymentDialog.value = true
		}, 300)
	} else if (errorRetryAction.value === 'sync') {
		// Refresh pending invoices before retrying sync
		await loadPendingInvoices()

		// Retry sync
		setTimeout(() => {
			handleSyncClick()
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
			// Serialize data to plain objects (remove Vue reactivity)
			const invoiceData = {
				pos_profile: posProfile.value,
				customer: customerValue || currentProfile.value?.customer,
				items: JSON.parse(JSON.stringify(invoiceItems.value)),
				payments: JSON.parse(JSON.stringify(payments.value)),
				grand_total: grandTotal.value,
				total_tax: totalTax.value,
				total_discount: totalDiscount.value,
			}

			await saveInvoiceOffline(invoiceData)

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
        suppressOfferReapply = true
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

function buildInvoiceDataForOffers() {
        return {
                doctype: "Sales Invoice",
                pos_profile: posProfile.value,
                customer: customer.value?.name || customer.value || currentProfile.value?.customer,
                company: currentProfile.value?.company,
                selling_price_list: currentProfile.value?.selling_price_list,
                currency: currentProfile.value?.currency,
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

/**
 * Apply offer to cart items
 */
async function handleApplyOffer(offer) {
        if (!offer) {
                console.error('No offer provided')
                offersDialogRef.value?.resetApplyingState()
                return
        }

        if (!posProfile.value || invoiceItems.value.length === 0) {
                toast.create({
                        title: "Offer Unavailable",
                        text: "Add items to the cart before applying an offer.",
                        icon: "alert-circle",
                        iconClasses: "text-orange-600",
                })
                offersDialogRef.value?.resetApplyingState()
                return
        }

        try {
                const invoiceData = buildInvoiceDataForOffers()
                const offerNames = [offer.name]

                const response = await applyOffersResource.submit({
                        invoice_data: invoiceData,
                        selected_offers: offerNames,
                })

                const payload = response?.message || response || {}
                const responseItems = payload.items || []
                const appliedRules = payload.applied_pricing_rules || offerNames

                // Temporarily disable watchers while applying discounts
                suppressOfferReapply = true
                const hasDiscounts = applyServerDiscounts(responseItems)

                if (hasDiscounts) {
                        // Store applied offer metadata
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

                        // Close the dialog after successful application
                        showOffersDialog.value = false
                } else {
                        toast.create({
                                title: "Offer Not Eligible",
                                text: "Your cart doesn't meet the requirements for this offer.",
                                icon: "alert-circle",
                                iconClasses: "text-orange-600",
                        })
                        offersDialogRef.value?.resetApplyingState()
                }
        } catch (error) {
                console.error("Error applying offer:", error)
                toast.create({
                        title: "Error",
                        text: "Failed to apply offer. Please try again.",
                        icon: "x",
                        iconClasses: "text-red-600",
                })
                offersDialogRef.value?.resetApplyingState()
        }
}

/**
 * Remove currently applied offer
 */
function handleRemoveOffer() {
        // Temporarily disable watchers
        suppressOfferReapply = true

        // Clear offer metadata
        autoAppliedOffer.value = null

        // Remove discounts from items
        removeDiscount()

        toast.create({
                title: "Offer Removed",
                text: "Offer has been removed from cart",
                icon: "check",
                iconClasses: "text-blue-600",
        })
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


async function loadPendingInvoices() {
	try {
		pendingInvoicesList.value = await getPending()
	} catch (error) {
		console.error('Error loading pending invoices:', error)
		pendingInvoicesList.value = []
	}
}

async function handleEditOfflineInvoice(invoice) {
	try {
		// Clear current cart
		clearCart()

		// Restore invoice data to cart
		const invoiceData = invoice.data

		// Set customer
		if (invoiceData.customer) {
			customer.value = invoiceData.customer
		}

		// Restore items to cart
		if (invoiceData.items && invoiceData.items.length > 0) {
			for (const item of invoiceData.items) {
				addItem(item)
			}
		}

		// Delete the offline invoice since we're editing it
		await deletePending(invoice.id)
		await loadPendingInvoices()

		toast.create({
			title: "Invoice Restored",
			text: "Invoice loaded to cart for editing",
			icon: "check",
			iconClasses: "text-blue-600",
		})
	} catch (error) {
		console.error('Error editing offline invoice:', error)
		toast.create({
			title: "Restore Failed",
			text: error.message || "Failed to restore invoice",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

async function handleDeleteOfflineInvoice(invoiceId) {
	try {
		await deletePending(invoiceId)
		await loadPendingInvoices()
		toast.create({
			title: "Invoice Deleted",
			text: "Offline invoice deleted successfully",
			icon: "check",
			iconClasses: "text-green-600",
		})
	} catch (error) {
		console.error('Error deleting offline invoice:', error)
		toast.create({
			title: "Delete Failed",
			text: error.message || "Failed to delete offline invoice",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

async function handleSyncClick() {
	// Always open the offline invoices dialog if there are pending invoices
	if (pendingInvoicesCount.value > 0) {
		await loadPendingInvoices()
		showOfflineInvoicesDialog.value = true
		return
	}

	// If no pending invoices, show success message
	if (pendingInvoicesCount.value === 0) {
		toast.create({
			title: "All Synced",
			text: "No pending invoices to sync",
			icon: "check",
			iconClasses: "text-green-600",
		})
		return
	}
}

// Sync all pending invoices (called from dialog)
async function handleSyncAll() {
	if (isOffline.value) {
		toast.create({
			title: "Offline Mode",
			text: "Cannot sync while offline",
			icon: "alert-circle",
			iconClasses: "text-orange-600",
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
			// Reload pending invoices list
			await loadPendingInvoices()
		}

		if (result.failed > 0 && result.errors && result.errors.length > 0) {
			// Show error dialog for the first failed invoice with details
			const firstError = result.errors[0]
			const errorContext = parseError(firstError.error)

			errorDialogTitle.value = errorContext.title
			errorDialogMessage.value = `Failed to sync invoice for ${firstError.customer}\n\n${errorContext.message}\n\nYou can delete this invoice from the offline queue if you don't need it.`
			errorDetails.value = errorContext.technicalDetails || `Invoice ID: ${firstError.invoiceId}`
			errorRetryAction.value = 'sync'
			errorRetryActionData.value = { failedInvoiceId: firstError.invoiceId }
			showErrorDialog.value = true
		} else if (result.failed > 0) {
			// Fallback toast if no error details
			toast.create({
				title: "Partial Sync",
				text: `${result.failed} invoice(s) failed to sync`,
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
		}
	} catch (error) {
		console.error('Sync error:', error)
		const errorContext = parseError(error)

		errorDialogTitle.value = errorContext.title
		errorDialogMessage.value = errorContext.message
		errorDetails.value = errorContext.technicalDetails
		errorRetryAction.value = 'sync'
		showErrorDialog.value = true
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
