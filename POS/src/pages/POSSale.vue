<template>
	<div class="h-screen flex flex-col bg-gray-50">
		<!-- Loading State -->
		<LoadingSpinner v-if="uiStore.isLoading" />

		<!-- Main App -->
		<template v-else>
			<!-- Header -->
			<POSHeader
				:current-time="shiftStore.currentTime"
				:shift-duration="shiftStore.shiftDuration"
				:has-open-shift="shiftStore.hasOpenShift"
				:profile-name="shiftStore.profileName"
				:user-name="getCurrentUser()"
				:is-offline="offlineStore.isOffline"
				:is-syncing="offlineStore.isSyncing"
				:pending-invoices-count="offlineStore.pendingInvoicesCount"
				:is-any-dialog-open="uiStore.isAnyDialogOpen"
				:cache-syncing="itemStore.cacheSyncing"
				:cache-stats="itemStore.cacheStats"
				@sync-click="handleSyncClick"
				@printer-click="uiStore.showHistoryDialog = true"
				@refresh-click="handleRefresh"
				@logout="uiStore.showLogoutDialog = true"
			>
				<template #menu-items>
					<button
						v-if="shiftStore.hasOpenShift"
						@click="uiStore.showOpenShiftDialog = true"
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center space-x-3 transition-colors"
					>
						<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						<span>View Shift</span>
					</button>
					<button
						@click="uiStore.showDraftDialog = true"
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 flex items-center space-x-3 transition-colors relative"
					>
						<svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
						</svg>
						<span>Draft Invoices</span>
						<span v-if="draftsStore.draftsCount > 0" class="ml-auto text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full">
							{{ draftsStore.draftsCount }}
						</span>
					</button>
					<button
						@click="uiStore.showHistoryDialog = true"
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 flex items-center space-x-3 transition-colors"
					>
						<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
						</svg>
						<span>Invoice History</span>
					</button>
					<button
						v-if="offlineStore.pendingInvoicesCount > 0"
						@click="uiStore.showOfflineInvoicesDialog = true; offlineStore.loadPendingInvoices()"
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 flex items-center space-x-3 transition-colors relative"
					>
						<svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						<span>Offline Invoices</span>
						<span class="ml-auto text-xs bg-orange-600 text-white px-1.5 py-0.5 rounded-full">
							{{ offlineStore.pendingInvoicesCount }}
						</span>
					</button>
					<button
						@click="uiStore.showReturnDialog = true"
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
		v-if="shiftStore.hasOpenShift"
		class="flex-1 flex overflow-hidden relative"
	>
		<!-- Icon-Only Management Slider - Always Visible -->
		<ManagementSlider @menu-clicked="handleManagementMenuClick" />

		<!-- Main Content Container -->
		<div ref="containerRef" class="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
		<!-- Mobile Tab Navigation -->
		<div
				class="lg:hidden bg-white border-b border-gray-200 flex shadow-sm sticky top-0 transition-all z-[100]"
			>
				<button
					@click="uiStore.setMobileTab('items')"
					:class="[
						'flex-1 px-3 py-3 text-sm font-semibold transition-all relative touch-manipulation active:scale-95',
						uiStore.mobileActiveTab === 'items'
							? 'text-blue-600 border-b-3 border-blue-600 bg-blue-50'
							: 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 active:bg-gray-100'
					]"
					:aria-label="'View items'"
					:aria-selected="uiStore.mobileActiveTab === 'items'"
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
					@click="uiStore.setMobileTab('cart')"
					:class="[
						'flex-1 px-3 py-3 text-sm font-semibold transition-all relative touch-manipulation active:scale-95',
						uiStore.mobileActiveTab === 'cart'
							? 'text-blue-600 border-b-3 border-blue-600 bg-blue-50'
							: 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 active:bg-gray-100'
					]"
					:aria-label="'View cart'"
					:aria-selected="uiStore.mobileActiveTab === 'cart'"
					role="tab"
				>
					<div class="flex items-center justify-center space-x-1.5">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
						</svg>
						<span>Cart</span>
						<span v-if="cartStore.itemCount > 0" class="bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shadow-sm">
							{{ cartStore.itemCount }}
						</span>
					</div>
				</button>
			</div>

			<!-- Left: Items Selector (Desktop) / Tab Content (Mobile) -->
			<div
				:style="{ width: uiStore.isDesktop ? uiStore.leftPanelWidth + 'px' : '100%' }"
				:class="[
					'flex flex-col bg-white overflow-hidden',
					uiStore.isDesktop ? 'flex-shrink-0' : '',
					!uiStore.isDesktop && (uiStore.mobileActiveTab === 'items' ? 'flex-1' : 'hidden')
				]"
				style="will-change: width; contain: layout;"
			>
				<ItemsSelector
					ref="itemsSelectorRef"
					:pos-profile="shiftStore.profileName"
					:cart-items="cartStore.invoiceItems"
					:currency="shiftStore.profileCurrency"
					@item-selected="handleItemSelected"
				/>
			</div>

			<!-- Draggable Divider (Desktop Only) -->
			<div
				v-if="uiStore.isDesktop"
				ref="dividerRef"
				role="separator"
				aria-orientation="vertical"
				@pointerdown="startResize"
				class="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize relative flex-shrink-0 transition-all duration-100 hidden lg:block"
				:class="{
					'bg-blue-500': uiStore.isResizing,
					'pointer-events-none opacity-0': uiStore.isAnyDialogOpen,
					'z-[1]': !uiStore.isAnyDialogOpen
				}"
			>
				<div class="absolute inset-y-0 -left-2 -right-2" style="cursor: col-resize;"></div>
				<div
					class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-gray-400 rounded-full"
					:class="{ 'bg-blue-600': uiStore.isResizing, 'bg-blue-500': !uiStore.isResizing }"
					style="transition: background-color 0.1s ease; opacity: 0.8;"
				></div>
			</div>

			<!-- Right: Invoice Cart (Desktop) / Tab Content (Mobile) -->
			<div
				:class="[
					'flex flex-col bg-gray-50 overflow-hidden',
					uiStore.isDesktop ? 'flex-1' : '',
					!uiStore.isDesktop && (uiStore.mobileActiveTab === 'cart' ? 'flex-1' : 'hidden')
				]"
				style="min-width: 300px; contain: layout;"
			>
				<InvoiceCart
					:items="cartStore.invoiceItems"
					:customer="cartStore.customer"
					:subtotal="cartStore.subtotal"
					:tax-amount="cartStore.totalTax"
					:discount-amount="cartStore.totalDiscount"
					:grand-total="cartStore.grandTotal"
					:pos-profile="shiftStore.profileName"
					:currency="shiftStore.profileCurrency"
					:applied-offers="cartStore.appliedOffers"
					:warehouses="profileWarehouses"
					@update-quantity="cartStore.updateItemQuantity"
					@remove-item="cartStore.removeItem"
					@select-customer="handleCustomerSelected"
					@create-customer="handleCreateCustomer"
					@proceed-to-payment="handleProceedToPayment"
					@clear-cart="handleClearCart"
					@save-draft="handleSaveDraft"
					@apply-coupon="uiStore.showCouponDialog = true"
					@show-offers="uiStore.showOffersDialog = true"
					@remove-offer="offer => cartStore.removeOffer(offer, shiftStore.currentProfile, offersDialogRef.value)"
					@update-uom="cartStore.changeItemUOM"
					@edit-item="handleEditItem"
				/>
			</div>

			<!-- Mobile Floating Cart Button -->
			<button
				v-if="!uiStore.isDesktop && uiStore.mobileActiveTab === 'items' && cartStore.itemCount > 0"
				@click="uiStore.setMobileTab('cart')"
				class="lg:hidden fixed bottom-6 right-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full p-4 shadow-2xl hover:shadow-3xl hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 transition-all z-50 touch-manipulation active:scale-95 ring-4 ring-blue-100"
				:aria-label="'View cart with ' + cartStore.itemCount + ' items'"
			>
				<div class="relative">
					<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
					</svg>
					<span class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] px-1 flex items-center justify-center shadow-lg animate-pulse">
						{{ cartStore.itemCount }}
					</span>
				</div>
			</button>
		</div>
		</div>

		<!-- No Shift Placeholder -->
		<div v-else class="flex-1 flex items-center justify-center bg-gray-50">
			<div class="text-center">
				<div class="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-blue-100">
					<svg class="h-12 w-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-medium text-gray-900">Welcome to POS Next</h3>
				<p class="mt-2 text-sm text-gray-500">Please open a shift to start making sales</p>
				<Button
					variant="solid"
					theme="blue"
					@click="uiStore.showOpenShiftDialog = true"
					class="mt-6"
				>
					Open Shift
				</Button>
			</div>
		</div>

		<!-- Payment Dialog -->
		<PaymentDialog
			v-model="uiStore.showPaymentDialog"
			:grand-total="cartStore.grandTotal"
			:pos-profile="shiftStore.profileName"
			:currency="shiftStore.profileCurrency"
			:is-offline="offlineStore.isOffline"
			@payment-completed="handlePaymentCompleted"
		/>

		<!-- Customer Selection Dialog -->
		<CustomerDialog
			v-model="uiStore.showCustomerDialog"
			:pos-profile="shiftStore.profileName"
			@customer-selected="handleCustomerSelected"
		/>

		<!-- Shift Opening Dialog -->
		<ShiftOpeningDialog
			v-model="uiStore.showOpenShiftDialog"
			@shift-opened="handleShiftOpened"
		/>

		<!-- Shift Closing Dialog -->
		<ShiftClosingDialog
			v-model="uiStore.showCloseShiftDialog"
			:opening-shift="shiftStore.currentShift?.name"
			@shift-closed="handleShiftClosed"
		/>

		<!-- Draft Invoices Dialog -->
		<DraftInvoicesDialog
			v-model="uiStore.showDraftDialog"
			:currency="shiftStore.profileCurrency"
			@load-draft="handleLoadDraft"
			@drafts-updated="draftsStore.updateDraftsCount"
		/>

		<!-- Return Invoice Dialog -->
		<ReturnInvoiceDialog
			v-model="uiStore.showReturnDialog"
			:pos-profile="shiftStore.profileName"
			@return-created="handleReturnCreated"
		/>

		<!-- Coupon Dialog -->
		<CouponDialog
			v-model="uiStore.showCouponDialog"
			:subtotal="cartStore.subtotal"
			:items="cartStore.invoiceItems"
			:pos-profile="shiftStore.profileName"
			:customer="cartStore.customer?.name || cartStore.customer"
			:company="shiftStore.profileCompany"
			:currency="shiftStore.profileCurrency"
			:applied-coupon="cartStore.appliedCoupon"
			@discount-applied="handleDiscountApplied"
			@discount-removed="handleDiscountRemoved"
		/>

		<!-- Offers Dialog -->
		<OffersDialog
			ref="offersDialogRef"
			v-model="uiStore.showOffersDialog"
			:subtotal="cartStore.subtotal"
			:items="cartStore.invoiceItems"
			:pos-profile="shiftStore.profileName"
			:customer="cartStore.customer?.name || cartStore.customer"
			:company="shiftStore.profileCompany"
			:currency="shiftStore.profileCurrency"
			:applied-offers="cartStore.appliedOffers"
			@apply-offer="handleApplyOffer"
			@remove-offer="offer => cartStore.removeOffer(offer, shiftStore.currentProfile, offersDialogRef.value)"
		/>

		<!-- Batch/Serial Dialog -->
		<BatchSerialDialog
			v-model="uiStore.showBatchSerialDialog"
			:item="cartStore.pendingItem"
			:quantity="cartStore.pendingItemQty"
			:warehouse="shiftStore.profileWarehouse"
			@batch-serial-selected="handleBatchSerialSelected"
		/>

		<!-- Generic Item Selection Dialog -->
		<ItemSelectionDialog
			v-model="uiStore.showItemSelectionDialog"
			:item="cartStore.pendingItem"
			:mode="cartStore.selectionMode"
			:pos-profile="shiftStore.profileName"
			:currency="shiftStore.profileCurrency"
			@option-selected="handleOptionSelected"
		/>

		<!-- Invoice History Dialog -->
		<InvoiceHistoryDialog
			v-model="uiStore.showHistoryDialog"
			:pos-profile="shiftStore.profileName"
			@create-return="handleCreateReturnFromHistory"
		/>

		<!-- Offline Invoices Dialog -->
		<OfflineInvoicesDialog
			v-model="uiStore.showOfflineInvoicesDialog"
			:is-offline="offlineStore.isOffline"
			:pending-invoices="offlineStore.pendingInvoicesList"
			:is-syncing="offlineStore.isSyncing"
			:currency="shiftStore.profileCurrency"
			@sync-all="handleSyncAll"
			@delete-invoice="handleDeleteOfflineInvoice"
			@edit-invoice="handleEditOfflineInvoice"
			@refresh="offlineStore.loadPendingInvoices"
		/>

		<!-- Create Customer Dialog -->
		<CreateCustomerDialog
			v-model="uiStore.showCreateCustomerDialog"
			:pos-profile="shiftStore.profileName"
			:initial-name="uiStore.initialCustomerName"
			@customer-created="handleCustomerCreated"
		/>

		<!-- Promotion Management -->
		<PromotionManagement
			v-model="showPromotionManagement"
			:pos-profile="shiftStore.profileName"
			:company="shiftStore.profileCompany"
			:currency="shiftStore.profileCurrency"
			@promotion-saved="handlePromotionSaved"
		/>

		<!-- Clear Cart Confirmation Dialog -->
		<Dialog
			v-model="uiStore.showClearCartDialog"
			:options="{ title: 'Clear Cart?', size: 'xs' }"
		>
			<template #body-content>
				<div class="py-3">
					<p class="text-sm text-gray-600">
						Remove all {{ cartStore.itemCount }} items from cart?
					</p>
				</div>
			</template>
			<template #actions>
				<div class="flex space-x-2 w-full">
					<Button class="flex-1" variant="subtle" @click="uiStore.showClearCartDialog = false">
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
			v-model="uiStore.showLogoutDialog"
			:options="{ title: 'Sign Out Confirmation', size: 'md' }"
			:dismissable="!session.logout.loading"
		>
			<template #body-content>
				<!-- WITH SHIFT OPEN -->
				<div v-if="shiftStore.hasOpenShift" class="px-4 py-5">
					<div class="text-center mb-6">
						<div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-red-100 to-red-200 shadow-md mb-4">
							<svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
							</svg>
						</div>
						<h3 class="text-lg font-bold text-red-600 mb-2">
							Your Shift is Still Open!
						</h3>
						<p class="text-sm text-gray-600 max-w-sm mx-auto">
							Close your shift first to save all transactions properly
						</p>
					</div>

					<!-- Action Buttons -->
					<div class="space-y-3 max-w-md mx-auto">
						<!-- Recommended Action - BLUE -->
						<button
							@click="logoutWithCloseShift"
							:disabled="session.logout.loading"
							class="w-full flex items-center justify-center px-5 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
						>
							<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
							</svg>
							Close Shift & Sign Out
						</button>

						<!-- Alternative Actions -->
						<div class="grid grid-cols-2 gap-2">
							<button
								@click="confirmLogout"
								:disabled="session.logout.loading"
								class="px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Skip & Sign Out
							</button>
							<button
								@click="uiStore.showLogoutDialog = false"
								:disabled="session.logout.loading"
								class="px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 hover:border-gray-400"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>

				<!-- WITHOUT SHIFT (Simple confirmation) -->
				<div v-else class="px-4 py-5">
					<div class="text-center mb-6">
						<div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-red-100 to-red-200 shadow-md mb-4">
							<svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
							</svg>
						</div>
						<h3 class="text-lg font-bold text-red-600 mb-2">
							Sign Out?
						</h3>
						<p class="text-sm text-gray-600">
							You will be logged out of POS Next
						</p>
					</div>

					<div class="grid grid-cols-2 gap-3 max-w-sm mx-auto">
						<button
							@click="uiStore.showLogoutDialog = false"
							:disabled="session.logout.loading"
							class="px-5 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-blue-500/30 transition-all disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
						>
							Cancel
						</button>
						<button
							@click="confirmLogout"
							:disabled="session.logout.loading"
							class="px-5 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
						>
							<span v-if="!session.logout.loading">Sign Out</span>
							<span v-else class="flex items-center justify-center">
								<svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Signing Out...
							</span>
						</button>
					</div>
				</div>
			</template>
		</Dialog>

		<!-- Success Dialog -->
		<Dialog
			v-model="uiStore.showSuccessDialog"
			:options="{ title: 'Invoice Created Successfully', size: 'md' }"
		>
			<template #body-content>
				<div class="text-center py-6">
					<div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
						<svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
						</svg>
					</div>
					<h3 class="mt-4 text-lg font-medium text-gray-900">
						Invoice {{ uiStore.lastInvoiceName }} created successfully!
					</h3>
					<p class="mt-2 text-sm text-gray-500">
						Total: {{ formatCurrency(uiStore.lastInvoiceTotal) }}
					</p>
				</div>
			</template>
			<template #actions>
				<div class="flex space-x-2">
					<Button variant="subtle" @click="uiStore.showSuccessDialog = false">
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
			v-model="uiStore.showErrorDialog"
			:options="{ title: uiStore.errorDialogTitle || 'Error', size: 'md' }"
		>
			<template #body-content>
				<div class="py-3">
					<p class="text-sm text-gray-700 whitespace-pre-line">
						{{ uiStore.errorDialogMessage || 'An unexpected error occurred.' }}
					</p>
					<div v-if="uiStore.errorDetails" class="mt-3 pt-3 border-t border-gray-200">
						<p class="text-xs text-gray-500">{{ uiStore.errorDetails }}</p>
					</div>
				</div>
			</template>
			<template #actions>
				<div class="flex justify-between items-center w-full">
					<Button
						v-if="uiStore.errorRetryAction === 'sync' && uiStore.errorRetryActionData?.failedInvoiceId"
						variant="outline"
						theme="red"
						@click="handleDeleteFailedInvoice"
					>
						Delete Invoice
					</Button>
					<div v-else></div>
					<div class="flex space-x-2">
						<Button variant="subtle" @click="uiStore.clearError()">
							Close
						</Button>
						<Button
							v-if="uiStore.errorRetryAction"
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
import { ref, onMounted, onUnmounted, watch, computed } from "vue"
import { Button, Dialog, toast, createResource } from "frappe-ui"
import { session } from "@/data/session"
import { parseError } from "@/utils/errorHandler"
import LoadingSpinner from "@/components/common/LoadingSpinner.vue"
import POSHeader from "@/components/pos/POSHeader.vue"
import ManagementSlider from "@/components/pos/ManagementSlider.vue"
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
import PromotionManagement from "@/components/sale/PromotionManagement.vue"
import { printInvoiceByName } from "@/utils/printInvoice"

// Pinia Stores
import { usePOSCartStore } from "@/stores/posCart"
import { usePOSShiftStore } from "@/stores/posShift"
import { usePOSUIStore } from "@/stores/posUI"
import { usePOSSyncStore } from "@/stores/posSync"
import { usePOSDraftsStore } from "@/stores/posDrafts"
import { useItemSearchStore } from "@/stores/itemSearch"

// Initialize stores
const cartStore = usePOSCartStore()
const shiftStore = usePOSShiftStore()
const uiStore = usePOSUIStore()
const offlineStore = usePOSSyncStore()
const draftsStore = usePOSDraftsStore()
const itemStore = useItemSearchStore()

// Component refs
const itemsSelectorRef = ref(null)
const offersDialogRef = ref(null)
const containerRef = ref(null)
const dividerRef = ref(null)
const pendingPaymentAfterCustomer = ref(false)
const logoutAfterClose = ref(false)

// Debounce timer for offer reapplication
const offerReapplyTimer = ref(null)

// Performance: Cache previous cart state to avoid unnecessary reapplications
let previousCartHash = ''

// Promotion dialog
const showPromotionManagement = ref(false)

// Warehouses state and resource
const warehousesList = ref([])

const warehousesResource = createResource({
	url: "pos_next.api.pos_profile.get_warehouses",
	makeParams() {
		return {
			pos_profile: shiftStore.profileName
		}
	},
	auto: false,
	onSuccess(data) {
		const warehouses = data?.message || data || []
		warehousesList.value = warehouses
	},
	onError(error) {
		console.error("Error loading warehouses:", error)
		warehousesList.value = []
	}
})

// Watch for profile changes to load warehouses
watch(() => shiftStore.profileName, (newProfile) => {
	if (newProfile) {
		warehousesResource.reload()
	}
}, { immediate: true })

// Computed for warehouses - returns all warehouses for the company
const profileWarehouses = computed(() => {
	if (warehousesList.value.length > 0) {
		return warehousesList.value.map(w => ({
			name: w.name,
			warehouse: w.warehouse_name || w.name
		}))
	}
	// Fallback to profile warehouse if API hasn't loaded yet
	if (shiftStore.profileWarehouse) {
		return [{ name: shiftStore.profileWarehouse, warehouse: shiftStore.profileWarehouse }]
	}
	return []
})

// Resize state
let resizeState = null
let bodyStyleSnapshot = null

onMounted(async () => {
	// Window resize listeners (passive for better performance)
	const handleResize = () => {
		uiStore.setWindowWidth(window.innerWidth)
		updateLayoutBounds()
	}
	window.addEventListener('resize', handleResize, { passive: true })

	try {
		// Start timers for current time and shift duration
		shiftStore.startTimers()

		// Check for existing open shift
		const hasShift = await shiftStore.checkShift()

		if (!hasShift) {
			uiStore.showOpenShiftDialog = true
		} else {
			// Set POS profile and load tax rules
			if (shiftStore.currentProfile) {
				cartStore.posProfile = shiftStore.profileName
				cartStore.posOpeningShift = shiftStore.currentShift?.name
				await cartStore.loadTaxRules(shiftStore.profileName)

				// Pre-load data for offline use
				if (!offlineStore.isOffline) {
					await offlineStore.preloadDataForOffline(shiftStore.currentProfile)
				} else {
					await offlineStore.checkOfflineCacheAvailability()
				}
			}
		}

		updateLayoutBounds()
		await draftsStore.updateDraftsCount()
	} catch (error) {
		console.error("Error checking shift:", error)
	} finally {
		uiStore.setLoading(false)
	}
})

watch(() => shiftStore.hasOpenShift, value => {
	if (value && typeof window !== 'undefined') {
		updateLayoutBounds()
	}
})

// Watch for cart changes to re-apply offers (optimized - only watch length and defer expensive calculations)
// Performance: Only recalculate hash if cart length changed, then check if content actually changed
watch(
	() => cartStore.invoiceItems.length,
	() => {
		// Only proceed if there are applied offers
		if (cartStore.appliedOffers.length === 0) {
			return
		}

		// Calculate hash only when length changes
		const currentHash = cartStore.invoiceItems.map(i =>
			`${i.item_code}-${i.quantity}-${i.rate}-${i.discount_percentage || 0}-${i.discount_amount || 0}`
		).join(',')

		// Skip if cart content hasn't actually changed
		if (currentHash === previousCartHash) {
			return
		}

		previousCartHash = currentHash

		// Clear existing timer to prevent multiple API calls
		if (offerReapplyTimer.value) {
			clearTimeout(offerReapplyTimer.value)
		}

		// Set new timer - reapply offers after 800ms of no changes (increased for better performance)
		offerReapplyTimer.value = setTimeout(async () => {
			await cartStore.reapplyOffer(shiftStore.currentProfile)
		}, 800)
	}
)

onUnmounted(() => {
	window.removeEventListener('resize', () => {
		uiStore.setWindowWidth(window.innerWidth)
		updateLayoutBounds()
	})
	stopResize()
})

// Handlers
async function handleShiftOpened() {
	uiStore.showOpenShiftDialog = false
	if (shiftStore.currentProfile) {
		cartStore.posProfile = shiftStore.profileName
		cartStore.posOpeningShift = shiftStore.currentShift?.name
		await cartStore.loadTaxRules(shiftStore.profileName)
	}
	toast.create({
		title: "Shift Opened",
		text: "You can now start making sales",
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleShiftClosed() {
	uiStore.showCloseShiftDialog = false
	toast.create({
		title: "Shift Closed",
		text: "Shift closed successfully",
		icon: "check",
		iconClasses: "text-green-600",
	})

	// Check if logout should happen after closing shift
	if (logoutAfterClose.value) {
		logoutAfterClose.value = false
		session.logout.submit()
	} else {
		setTimeout(() => {
			uiStore.showOpenShiftDialog = true
		}, 500)
	}
}

function handleItemSelected(item, autoAdd = false) {
	// Auto-add mode
	if (autoAdd) {
		try {
			cartStore.addItem(item, 1, true, shiftStore.currentProfile)
			if (!uiStore.isDesktop) {
				uiStore.setMobileTab('cart')
			}
		} catch (error) {
			uiStore.showError("Insufficient Stock", error.message, `Item: ${item.item_code}`)
		}
		return
	}

	// Check for variants
	if (item.has_variants) {
		cartStore.setPendingItem(item, 1, 'variant')
		uiStore.showItemSelectionDialog = true
		return
	}

	// Check for UOMs
	if (item.item_uoms && item.item_uoms.length > 0) {
		cartStore.setPendingItem(item, 1, 'uom')
		uiStore.showItemSelectionDialog = true
		return
	}

	// Check for batch/serial
	if (item.has_batch_no || item.has_serial_no) {
		cartStore.setPendingItem(item, 1)
		uiStore.showBatchSerialDialog = true
		return
	}

	// Add to cart
	try {
		cartStore.addItem(item, 1, false, shiftStore.currentProfile)
		if (!uiStore.isDesktop) {
			uiStore.setMobileTab('cart')
		}
	} catch (error) {
		uiStore.showError("Insufficient Stock", error.message, `Item: ${item.item_code}`)
	}
}

async function handleEditItem(updatedItem) {
	await cartStore.updateItemDetails(updatedItem.item_code, updatedItem)
}

function handleCustomerSelected(selectedCustomer) {
	if (selectedCustomer) {
		cartStore.setCustomer(selectedCustomer)
		uiStore.showCustomerDialog = false
		toast.create({
			title: "Customer Selected",
			text: `${selectedCustomer.customer_name} selected`,
			icon: "check",
			iconClasses: "text-green-600",
		})

		if (pendingPaymentAfterCustomer.value) {
			pendingPaymentAfterCustomer.value = false
			uiStore.showPaymentDialog = true
		}
	} else {
		cartStore.setCustomer(null)
	}
}

function handleCreateCustomer(searchValue) {
	uiStore.setInitialCustomerName(searchValue || "")
	uiStore.showCreateCustomerDialog = true
}

function handleProceedToPayment() {
	if (cartStore.isEmpty) {
		toast.create({
			title: "Empty Cart",
			text: "Please add items to cart before proceeding to payment",
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		return
	}

	const customerValue = cartStore.customer?.name || cartStore.customer
	if (!customerValue && !shiftStore.profileCustomer) {
		toast.create({
			title: "Customer Required",
			text: "Please select a customer before proceeding",
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		uiStore.showCustomerDialog = true
		pendingPaymentAfterCustomer.value = true
		return
	}

	uiStore.showPaymentDialog = true
}

async function handleDeleteFailedInvoice() {
	if (!uiStore.errorRetryActionData?.failedInvoiceId) return

	const invoiceId = uiStore.errorRetryActionData.failedInvoiceId
	uiStore.clearError()

	try {
		await offlineStore.deleteOfflineInvoice(invoiceId)
	} catch (error) {
		// Error is handled in the store
	}
}

async function handleErrorRetry() {
	uiStore.clearError()
	if (uiStore.errorRetryAction === 'payment') {
		setTimeout(() => {
			uiStore.showPaymentDialog = true
		}, 300)
	} else if (uiStore.errorRetryAction === 'sync') {
		await offlineStore.loadPendingInvoices()
		setTimeout(() => {
			handleSyncClick()
		}, 300)
	}
}

async function handlePaymentCompleted(paymentData) {
	try {
		const customerValue = cartStore.customer?.name || cartStore.customer
		if (!customerValue && !shiftStore.profileCustomer) {
			toast.create({
				title: "Customer Required",
				text: "Please select a customer before proceeding",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
			uiStore.showPaymentDialog = false
			uiStore.showCustomerDialog = true
			return
		}

		cartStore.payments = []
		if (paymentData.payments && Array.isArray(paymentData.payments)) {
			paymentData.payments.forEach(p => {
				cartStore.payments.push({
					mode_of_payment: p.mode_of_payment,
					amount: p.amount,
					type: p.type
				})
			})
		}

		if (offlineStore.isOffline) {
			const invoiceData = {
				pos_profile: cartStore.posProfile,
				posa_pos_opening_shift: cartStore.posOpeningShift,
				customer: customerValue || shiftStore.profileCustomer,
				items: JSON.parse(JSON.stringify(cartStore.invoiceItems)),
				payments: JSON.parse(JSON.stringify(cartStore.payments)),
				grand_total: cartStore.grandTotal,
				total_tax: cartStore.totalTax,
				total_discount: cartStore.totalDiscount,
			}

			await offlineStore.saveInvoiceOffline(invoiceData)
			uiStore.showSuccess(`OFFLINE-${Date.now()}`, cartStore.grandTotal)
			uiStore.showPaymentDialog = false
			cartStore.clearCart()

			toast.create({
				title: "Saved Offline",
				text: "Invoice saved and will sync when online",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
		} else {
			const result = await cartStore.submitInvoice()

			if (result) {
				const invoiceName = result.name || result.message?.name || "Unknown"
				const invoiceTotal = result.grand_total || result.total || 0

				uiStore.showPaymentDialog = false
				cartStore.clearCart()

				if (itemsSelectorRef.value) {
					itemsSelectorRef.value.loadItems()
				}

				if (shiftStore.autoPrintEnabled) {
					try {
						await printInvoiceByName(invoiceName)
						toast.create({
							title: "Success",
							text: `Invoice ${invoiceName} created and sent to printer`,
							icon: "check",
							iconClasses: "text-green-600",
						})
					} catch (error) {
						console.error("Auto-print error:", error)
						toast.create({
							title: "Invoice Created",
							text: `Invoice ${invoiceName} created but print failed`,
							icon: "alert-circle",
							iconClasses: "text-orange-600",
						})
					}
				} else {
					uiStore.showSuccess(invoiceName, invoiceTotal)
					toast.create({
						title: "Success",
						text: `Invoice ${invoiceName} created successfully`,
						icon: "check",
						iconClasses: "text-green-600",
					})
				}
			}
		}
	} catch (error) {
		console.error("Error submitting invoice:", error)
		uiStore.showPaymentDialog = false

		const errorContext = parseError(error)
		uiStore.showError(
			errorContext.title || 'Error',
			errorContext.message || 'An unexpected error occurred',
			errorContext.technicalDetails || null,
			errorContext.retryable ? 'payment' : null
		)

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
	if (cartStore.isEmpty) return
	uiStore.showClearCartDialog = true
}

function confirmClearCart() {
	cartStore.clearCart()
	uiStore.showClearCartDialog = false
	toast.create({
		title: "Cart Cleared",
		text: "All items removed from cart",
		icon: "check",
		iconClasses: "text-green-600",
	})
}

async function handleOptionSelected(option) {
	if (!cartStore.pendingItem) return

	try {
		if (option.type === 'variant') {
			const variant = option.data

			if (variant.item_uoms && variant.item_uoms.length > 0) {
				cartStore.setPendingItem(variant, cartStore.pendingItemQty, 'uom')
				return
			}

			if (variant.has_batch_no || variant.has_serial_no) {
				cartStore.setPendingItem(variant, cartStore.pendingItemQty)
				uiStore.showItemSelectionDialog = false
				uiStore.showBatchSerialDialog = true
			} else {
				cartStore.addItem(variant, cartStore.pendingItemQty)
				uiStore.showItemSelectionDialog = false
				cartStore.clearPendingItem()
				toast.create({
					title: "Variant Added",
					text: `${variant.item_name} added to cart`,
					icon: "check",
					iconClasses: "text-green-600",
				})
			}
		} else if (option.type === 'uom') {
			const itemDetails = await cartStore.getItemDetailsResource.submit({
				item_code: cartStore.pendingItem.item_code,
				pos_profile: cartStore.posProfile,
				customer: cartStore.customer?.name || cartStore.customer,
				qty: cartStore.pendingItemQty,
				uom: option.uom
			})

			const itemToAdd = {
				...cartStore.pendingItem,
				uom: option.uom,
				conversion_factor: option.conversion_factor,
				rate: itemDetails.price_list_rate || itemDetails.rate,
				price_list_rate: itemDetails.price_list_rate
			}

			if (itemToAdd.has_batch_no || itemToAdd.has_serial_no) {
				cartStore.setPendingItem(itemToAdd, cartStore.pendingItemQty)
				uiStore.showItemSelectionDialog = false
				uiStore.showBatchSerialDialog = true
			} else {
				cartStore.addItem(itemToAdd, cartStore.pendingItemQty)
				uiStore.showItemSelectionDialog = false
				cartStore.clearPendingItem()
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

function handleCloseShift() {
	uiStore.showCloseShiftDialog = true
}

async function handlePrintInvoice() {
	try {
		await printInvoiceByName(uiStore.lastInvoiceName)
		uiStore.showSuccessDialog = false
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

function confirmLogout() {
	logoutAfterClose.value = false
	uiStore.showLogoutDialog = false
	session.logout.submit()
}

function logoutWithCloseShift() {
	// Open close shift dialog and remember to logout after closing
	logoutAfterClose.value = true
	uiStore.showLogoutDialog = false
	uiStore.showCloseShiftDialog = true
}

async function handleSaveDraft() {
	const success = await draftsStore.saveDraftInvoice(
		cartStore.invoiceItems,
		cartStore.customer,
		cartStore.posProfile
	)
	if (success) {
		cartStore.clearCart()
	}
}

async function handleLoadDraft(draft) {
	try {
		const draftData = await draftsStore.loadDraft(draft)
		cartStore.invoiceItems = draftData.items
		cartStore.setCustomer(draftData.customer)
		uiStore.showDraftDialog = false
	} catch (error) {
		// Error handled in store
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
	cartStore.applyDiscountToCart(discount)
	uiStore.showCouponDialog = false
}

function handleDiscountRemoved() {
	cartStore.removeDiscountFromCart()
}

async function handleApplyOffer(offer) {
	const success = await cartStore.applyOffer(offer, shiftStore.currentProfile, offersDialogRef.value)
	if (success) {
		uiStore.showOffersDialog = false
	}
}

function handleBatchSerialSelected(batchSerial) {
	if (cartStore.pendingItem) {
		const itemToAdd = {
			...cartStore.pendingItem,
			quantity: cartStore.pendingItemQty,
			...batchSerial
		}
		cartStore.addItem(itemToAdd)
		cartStore.clearPendingItem()
	}
}

function handleCreateReturnFromHistory(invoice) {
	uiStore.showReturnDialog = true
	toast.create({
		title: "Create Return",
		text: `Creating return for invoice ${invoice.name}`,
		icon: "alert-circle",
		iconClasses: "text-orange-600",
	})
}

function handleCustomerCreated(newCustomer) {
	cartStore.setCustomer(newCustomer)
	uiStore.showCreateCustomerDialog = false
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

async function handleEditOfflineInvoice(invoice) {
	try {
		cartStore.clearCart()

		const invoiceData = invoice.data

		if (invoiceData.customer) {
			cartStore.setCustomer(invoiceData.customer)
		}

		if (invoiceData.items && invoiceData.items.length > 0) {
			for (const item of invoiceData.items) {
				cartStore.addItem(item)
			}
		}

		await offlineStore.deleteOfflineInvoice(invoice.id)

		toast.create({
			title: "Invoice Restored",
			text: "Invoice loaded to cart for editing",
			icon: "check",
			iconClasses: "text-blue-600",
		})
	} catch (error) {
		console.error('Error editing offline invoice:', error)
		// Error handled in store
	}
}

async function handleDeleteOfflineInvoice(invoiceId) {
	try {
		await offlineStore.deleteOfflineInvoice(invoiceId)
	} catch (error) {
		// Error handled in store
	}
}

async function handleSyncClick() {
	if (offlineStore.hasPendingInvoices) {
		await offlineStore.loadPendingInvoices()
		uiStore.showOfflineInvoicesDialog = true
		return
	}

	toast.create({
		title: "All Synced",
		text: "No pending invoices to sync",
		icon: "check",
		iconClasses: "text-green-600",
	})
}

async function handleSyncAll() {
	if (offlineStore.isOffline) {
		toast.create({
			title: "Offline Mode",
			text: "Cannot sync while offline",
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		return
	}

	try {
		const result = await offlineStore.syncAllPending()

		if (result.failed > 0 && result.errors && result.errors.length > 0) {
			const firstError = result.errors[0]
			const errorContext = parseError(firstError.error)

			uiStore.showError(
				errorContext.title,
				`Failed to sync invoice for ${firstError.customer}\n\n${errorContext.message}\n\nYou can delete this invoice from the offline queue if you don't need it.`,
				errorContext.technicalDetails || `Invoice ID: ${firstError.invoiceId}`,
				'sync',
				{ failedInvoiceId: firstError.invoiceId }
			)
		} else if (result.failed > 0) {
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
		uiStore.showError(errorContext.title, errorContext.message, errorContext.technicalDetails, 'sync')
	}
}

// Resizable layout helpers
function updateLayoutBounds() {
	if (!containerRef.value) return
	const containerWidth = containerRef.value.offsetWidth
	uiStore.updateLayoutBounds(containerWidth)
}

function startResize(event) {
	if (!containerRef.value || !dividerRef.value) {
		return
	}
	if (event.isPrimary === false) {
		return
	}
	if (event.button !== undefined && event.button !== 0 && event.pointerType !== 'touch') {
		return
	}

	updateLayoutBounds()

	resizeState = {
		pointerId: event.pointerId,
		startX: event.clientX,
		startWidth: uiStore.leftPanelWidth,
		containerWidth: containerRef.value?.offsetWidth ?? 1120
	}

	uiStore.setResizing(true)

	bodyStyleSnapshot = {
		cursor: document.body.style.cursor,
		userSelect: document.body.style.userSelect
	}

	// Add document-level event listeners for dragging
	document.addEventListener('pointermove', handleResize)
	document.addEventListener('pointerup', stopResize)
	document.addEventListener('pointercancel', stopResize)

	dividerRef.value.setPointerCapture?.(event.pointerId)
	document.body.style.cursor = 'col-resize'
	document.body.style.userSelect = 'none'
	event.preventDefault()
}

function handleResize(event) {
	if (!uiStore.isResizing || !resizeState || (event.pointerId ?? resizeState.pointerId) !== resizeState.pointerId) {
		return
	}

	event.preventDefault()

	const containerWidth = containerRef.value?.offsetWidth ?? resizeState.containerWidth
	resizeState.containerWidth = containerWidth

	const deltaX = event.clientX - resizeState.startX
	const rawWidth = resizeState.startWidth + deltaX

	uiStore.setLeftPanelWidth(rawWidth, containerWidth)
}

function stopResize(event) {
	if (!uiStore.isResizing || !resizeState) {
		return
	}

	if (event?.pointerId !== undefined && event.pointerId !== resizeState.pointerId) {
		return
	}

	if (event?.preventDefault) {
		event.preventDefault()
	}

	// Remove document-level event listeners
	document.removeEventListener('pointermove', handleResize)
	document.removeEventListener('pointerup', stopResize)
	document.removeEventListener('pointercancel', stopResize)

	if (dividerRef.value?.hasPointerCapture?.(resizeState.pointerId)) {
		dividerRef.value.releasePointerCapture(resizeState.pointerId)
	}

	uiStore.setResizing(false)
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

// Management and Promotion handlers
function handleManagementMenuClick(menuItem) {
	if (menuItem === 'promotions') {
		showPromotionManagement.value = true
	}
}

function handlePromotionSaved(data) {
	toast.create({
		title: "Success",
		text: data.message || "Promotion saved successfully",
		icon: "check",
		iconClasses: "text-green-600",
	})
}
</script>
