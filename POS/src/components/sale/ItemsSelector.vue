<template>
	<div class="flex flex-col h-full bg-gray-50">
		<!-- Item Groups Filter Tabs -->
		<div class="px-3 pt-3 pb-2 bg-white border-b border-gray-200">
			<div class="flex items-center space-x-2 overflow-x-auto pb-1">
				<button
					@click="selectedItemGroup = null"
					:class="[
						'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
						!selectedItemGroup
							? 'bg-blue-50 text-blue-600 border border-blue-200'
							: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
					]"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
					</svg>
					<span>All Items</span>
				</button>
				<button
					v-for="group in itemGroups"
					:key="group.item_group"
					@click="selectedItemGroup = group.item_group"
					:class="[
						'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
						selectedItemGroup === group.item_group
							? 'bg-blue-50 text-blue-600 border border-blue-200'
							: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
					]"
				>
					<span>{{ group.item_group }}</span>
				</button>
			</div>
		</div>

		<!-- Search Bar with View Controls -->
		<div class="px-3 py-2 bg-white border-b border-gray-200">
			<div class="flex items-center space-x-2">
				<div class="flex-1 relative">
					<Input
						v-model="searchTerm"
						type="text"
						placeholder="Search by item code, serial number or barcode"
						class="w-full text-sm"
					>
						<template #prefix>
							<svg
								class="h-4 w-4 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
						</template>
					</Input>
				</div>
				<div class="flex items-center space-x-0.5 bg-gray-100 rounded-md p-0.5">
					<button
						@click="viewMode = 'grid'"
						:class="[
							'p-1.5 rounded transition-all',
							viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
						]"
						title="Grid View"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
						</svg>
					</button>
					<button
						@click="viewMode = 'list'"
						:class="[
							'p-1.5 rounded transition-all',
							viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
						]"
						title="List View"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Items Grid/List -->
		<div class="flex-1 overflow-y-auto p-3">
			<div v-if="itemsResource.loading" class="text-center py-8">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
				<p class="mt-3 text-xs text-gray-500">Loading items...</p>
			</div>

			<div
				v-else-if="!filteredItems || filteredItems.length === 0"
				class="text-center py-8"
			>
				<svg
					class="mx-auto h-8 w-8 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
					/>
				</svg>
				<p class="mt-2 text-xs text-gray-500">No items found</p>
			</div>

			<!-- Grid View -->
			<div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
				<div
					v-for="item in filteredItems"
					:key="item.item_code"
					@click="handleItemClick(item)"
					class="relative bg-white border border-gray-200 rounded-lg p-2.5 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
				>
					<!-- Item Image with Stock Badge -->
					<div class="relative aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center overflow-hidden">
						<!-- Stock Badge -->
						<div
							:class="[
								'absolute top-1 right-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full',
								(item.actual_qty || item.stock_qty || 0) > 0 ? 'bg-green-500' : 'bg-red-500'
							]"
						>
							{{ Math.floor(item.actual_qty || item.stock_qty || 0) }}
						</div>

						<img
							v-if="item.image"
							:src="item.image"
							:alt="item.item_name"
							class="w-full h-full object-cover"
							@error="handleImageError"
						/>
						<svg
							v-else
							class="h-10 w-10 text-gray-300"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
					</div>

					<!-- Item Details -->
					<div>
						<h3 class="text-xs font-semibold text-gray-900 truncate mb-0.5 leading-tight">
							{{ item.item_name }}
						</h3>
						<p class="text-[10px] text-gray-500">
							{{ formatCurrency(item.rate || item.price_list_rate || 0) }}
							<span class="text-gray-400">/ {{ item.stock_uom || 'Nos' }}</span>
						</p>
					</div>
				</div>
			</div>

			<!-- List View -->
			<div v-else class="space-y-1.5">
				<div
					v-for="item in filteredItems"
					:key="item.item_code"
					@click="handleItemClick(item)"
					class="bg-white border border-gray-200 rounded-lg p-2 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all flex items-center space-x-3"
				>
					<!-- Item Image -->
					<div class="w-12 h-12 bg-gray-100 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden">
						<img
							v-if="item.image"
							:src="item.image"
							:alt="item.item_name"
							class="w-full h-full object-cover"
							@error="handleImageError"
						/>
						<svg
							v-else
							class="h-6 w-6 text-gray-300"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
					</div>

					<!-- Item Info -->
					<div class="flex-1 min-w-0">
						<h3 class="text-xs font-semibold text-gray-900 truncate">
							{{ item.item_name }}
						</h3>
						<p class="text-[10px] text-gray-500">{{ item.item_code }}</p>
					</div>

					<!-- Price and Stock -->
					<div class="text-right">
						<p class="text-xs font-bold text-gray-900">
							{{ formatCurrency(item.rate || item.price_list_rate || 0) }}
						</p>
						<p
							:class="[
								'text-[10px] font-medium',
								(item.actual_qty || item.stock_qty || 0) > 0 ? 'text-green-600' : 'text-red-600'
							]"
						>
							{{ (item.actual_qty || item.stock_qty || 0) > 0 ? Math.floor(item.actual_qty || item.stock_qty || 0) + ' in stock' : 'Out of stock' }}
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { Input } from "frappe-ui"
import { useItems } from "@/composables/useItems"

const props = defineProps({
	posProfile: String,
})

const emit = defineEmits(["item-selected"])

const viewMode = ref('grid')

const {
	filteredItems,
	searchTerm,
	selectedItemGroup,
	itemGroups,
	itemsResource,
	loadItems,
	loadItemGroups,
} = useItems(props.posProfile)

onMounted(() => {
	loadItems()
	loadItemGroups()
})

function handleItemClick(item) {
	emit("item-selected", item)
}

function formatCurrency(amount) {
	return parseFloat(amount || 0).toFixed(2)
}

function handleImageError(event) {
	event.target.style.display = "none"
}
</script>
