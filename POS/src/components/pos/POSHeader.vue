<template>
	<div
		class="bg-white shadow-sm sticky top-0 transition-all"
		:class="isAnyDialogOpen ? 'z-[100]' : 'z-[200]'"
	>
		<div class="flex py-2 sm:py-3">
			<!-- POS Icon - Aligned with Management Sidebar (64px) -->
			<div class="w-16 flex-shrink-0 flex items-center justify-center">
				<button
					class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0 hover:from-blue-600 hover:to-blue-700 active:scale-95 transition-all"
					:aria-label="'POS Next'"
					title="POS Next"
				>
					<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
						<path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/>
					</svg>
				</button>
			</div>

			<!-- Main Header Content -->
			<div class="flex-1 flex justify-between items-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-6">
				<!-- Left Side: Brand Info -->
				<div class="flex items-center space-x-1 sm:space-x-4 min-w-0 flex-1">
					<div class="min-w-0">
						<h1 class="text-xs sm:text-base font-bold text-gray-900 truncate">POS Next</h1>
						<p v-if="profileName" class="text-[9px] sm:text-xs text-gray-500 truncate hidden sm:block">{{ profileName }}</p>
					</div>

					<!-- Time and Shift Duration - Compact on mobile -->
					<div class="hidden lg:flex items-center space-x-4 ml-6">
						<!-- Current Time -->
						<StatusBadge
							variant="blue"
							size="sm"
							:icon="timeIcon"
							:text="currentTime"
						/>

						<!-- Shift Duration -->
						<StatusBadge
							v-if="hasOpenShift && shiftDuration"
							variant="green"
							size="xs"
							:icon="shiftIcon"
							label="Shift Open:"
							:value="shiftDuration"
						/>
					</div>

					<!-- Mobile Time Display - Very compact -->
					<div class="flex lg:hidden items-center text-[10px] text-gray-600 font-medium">
						<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						<span class="hidden xs:inline">{{ currentTime }}</span>
					</div>
				</div>

				<!-- Right Side: Controls -->
				<div class="flex items-center space-x-0.5 sm:space-x-1 flex-shrink-0">
					<!-- WiFi/Offline Status -->
					<button
						@click="$emit('sync-click')"
						:class="[
							'p-1 sm:p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors relative group touch-manipulation',
							isSyncing ? 'animate-pulse' : ''
						]"
						:title="isOffline ? `Offline (${pendingInvoicesCount} pending)` : 'Online - Click to sync'"
						:aria-label="isOffline ? 'Offline mode active' : 'Online mode active'"
					>
						<svg
							v-if="!isOffline"
							class="w-4 h-4 sm:w-5 sm:h-5 text-green-600"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
						</svg>
						<svg
							v-else
							class="w-4 h-4 sm:w-5 sm:h-5 text-orange-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"/>
						</svg>
						<span
							v-if="pendingInvoicesCount > 0"
							class="absolute -top-0.5 -right-0.5 bg-orange-600 text-white text-[8px] sm:text-[10px] font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-md"
						>
							{{ pendingInvoicesCount }}
						</span>
					</button>

					<!-- Printer - Hidden on small screens -->
					<div class="hidden md:block">
						<ActionButton
							:icon="printerIcon"
							title="Print Invoice"
							@click="$emit('printer-click')"
						/>
					</div>

					<!-- Refresh -->
					<ActionButton
						:icon="refreshIcon"
						title="Refresh Items"
						@click="$emit('refresh-click')"
						class="touch-manipulation p-1 sm:p-2"
						:aria-label="'Refresh items list'"
					/>

					<div class="w-px h-4 sm:h-6 bg-gray-200 mx-0.5 sm:mx-2"></div>

					<!-- User Menu -->
					<UserMenu
						:user-name="userName"
						:profile-name="profileName"
						@logout="$emit('logout')"
						@menu-opened="$emit('menu-opened')"
						@menu-closed="$emit('menu-closed')"
					>
						<template #menu-items>
							<slot name="menu-items"></slot>
						</template>
						<template #additional-actions>
							<slot name="additional-actions"></slot>
						</template>
					</UserMenu>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import StatusBadge from '@/components/common/StatusBadge.vue'
import ActionButton from '@/components/common/ActionButton.vue'
import UserMenu from '@/components/common/UserMenu.vue'

defineProps({
	currentTime: {
		type: String,
		required: true
	},
	shiftDuration: {
		type: String,
		default: null
	},
	hasOpenShift: {
		type: Boolean,
		default: false
	},
	profileName: {
		type: String,
		default: null
	},
	userName: {
		type: String,
		required: true
	},
	isOffline: {
		type: Boolean,
		default: false
	},
	isSyncing: {
		type: Boolean,
		default: false
	},
	pendingInvoicesCount: {
		type: Number,
		default: 0
	},
	isAnyDialogOpen: {
		type: Boolean,
		default: false
	}
})

defineEmits(['sync-click', 'printer-click', 'refresh-click', 'menu-click', 'logout', 'menu-opened', 'menu-closed'])

// SVG Path Icons
const timeIcon = "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
const shiftIcon = "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
const printerIcon = "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
const refreshIcon = "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
</script>
