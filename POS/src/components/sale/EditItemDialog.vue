<template>
	<Dialog v-model="show" :options="{ title: 'Edit Item Details', size: 'md' }">
		<template #body-title>
			<span class="sr-only">Edit item quantity, UOM, warehouse, and discount</span>
		</template>
		<template #body-content>
			<div v-if="localItem" class="space-y-4">
				<!-- Item Header -->
				<div class="flex items-center space-x-3 pb-4 border-b border-gray-200">
					<!-- Item Image -->
					<div class="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
						<img
							v-if="localItem.image"
							:src="localItem.image"
							:alt="localItem.item_name"
							class="w-full h-full object-cover"
						/>
						<svg
							v-else
							class="h-8 w-8 text-gray-400"
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
						<h3 class="text-base font-semibold text-gray-900 truncate">
							{{ localItem.item_name }}
						</h3>
						<!-- show item code under the item name -->
						<p class="text-sm text-gray-500 truncate">
							{{ localItem.item_code }}
						</p>
						<p class="text-sm text-gray-500 truncate">
							{{ currency }} {{ formatNumber(localItem.price_list_rate || localItem.rate) }} / {{ localItem.stock_uom || 'Nos' }}
						</p>
					</div>
				</div>

				<!-- Two Column Layout for Quantity, UOM, Rate, Warehouse -->
				<div class="grid grid-cols-2 gap-4">
					<!-- Left Column: Quantity and Rate -->
					<div class="space-y-4">
						<!-- Quantity Control -->
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
							<div class="w-full h-10 border border-gray-300 rounded-lg bg-white flex items-center overflow-hidden">
								<button
									type="button"
									@click="decrementQuantity"
									class="w-[40px] h-[40px] min-w-[40px] bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-bold text-lg transition-colors flex items-center justify-center border-r border-gray-300"
									style="flex: 0 0 40px;"
								>
									−
								</button>
								<div class="flex-1 h-full flex items-center justify-center px-3">
									<input
										v-model.number="localQuantity"
										type="number"
										min="1"
										step="1"
										class="w-full text-center border-0 text-sm font-semibold focus:outline-none focus:ring-0 bg-transparent"
										@input="validateQuantity"
									/>
								</div>
								<button
									type="button"
									@click="incrementQuantity"
									class="w-[40px] h-[40px] min-w-[40px] bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-bold text-lg transition-colors flex items-center justify-center border-l border-gray-300"
									style="flex: 0 0 40px;"
								>
									+
								</button>
							</div>
						</div>

						<!-- Rate -->
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Rate</label>
							<div class="relative h-10">
								<span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm font-medium">
									{{ currency }}
								</span>
								<input
									v-model.number="localRate"
									type="number"
									min="0"
									step="0.01"
									readonly
									class="w-full h-10 border border-gray-300 rounded-lg pl-16 pr-3 text-sm font-semibold bg-gray-50 cursor-not-allowed"
								/>
							</div>
						</div>
					</div>

					<!-- Right Column: UOM and Warehouse -->
					<div class="space-y-4">
						<!-- UOM Selector -->
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">UOM</label>
							<select
								v-model="localUom"
								@change="handleUomChange"
								class="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
							>
								<option :value="localItem.stock_uom">{{ localItem.stock_uom }}</option>
								<option
									v-if="availableUoms.length > 0"
									v-for="uomData in availableUoms"
									:key="uomData.uom"
									:value="uomData.uom"
								>
									{{ uomData.uom }}
								</option>
							</select>
						</div>

						<!-- Warehouse Selector -->
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Warehouse</label>
							<select
								v-model="localWarehouse"
								@change="handleWarehouseChange"
								class="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
							>
								<option
									v-if="warehouses.length > 0"
									v-for="warehouse in warehouses"
									:key="warehouse.name"
									:value="warehouse.name"
								>
									{{ warehouse.warehouse || warehouse.name }}
								</option>
								<option v-else :value="localWarehouse">
									{{ localWarehouse || 'Default' }}
								</option>
							</select>
						</div>
					</div>
				</div>

				<!-- Stock Information Section -->
				<div class="border-t border-gray-200 pt-4">
					<label class="block text-sm font-medium text-gray-700 mb-3">Stock Information</label>
					<div v-if="loadingStock" class="flex items-center justify-center py-4">
						<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
						<span class="ml-2 text-sm text-gray-500">Loading stock information...</span>
					</div>
					<div v-else-if="stockInfo.length > 0" class="border border-gray-200 rounded-lg overflow-hidden">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th scope="col" class="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Warehouse</th>
									<th scope="col" class="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								<tr v-for="stock in stockInfo" :key="stock.warehouse" class="hover:bg-gray-50">
									<td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
										{{ stock.warehouse_name }}
									</td>
									<td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
										{{ formatNumber(stock.actual_qty) }}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
					<div v-else class="text-center py-4 text-sm text-gray-500">
						No stock information available
					</div>
				</div>

				<!-- Item Discount Section (only if allowed by POS Profile) -->
				<div v-if="settingsStore.allowItemDiscount" class="border-t border-gray-200 pt-4">
					<label class="block text-sm font-medium text-gray-700 mb-3">Item Discount</label>
					<div class="grid grid-cols-2 gap-3">
						<!-- Discount Type -->
						<div>
							<label class="block text-xs text-gray-600 mb-1">Discount Type</label>
							<select
								v-model="discountType"
								@change="handleDiscountTypeChange"
								class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							>
								<option value="percentage">Percentage (%)</option>
								<option value="amount">Amount</option>
							</select>
						</div>
						<!-- Discount Value -->
						<div>
							<label class="block text-xs text-gray-600 mb-1">{{ discountType === 'percentage' ? 'Percentage' : 'Amount' }}</label>
							<div class="relative">
								<input
									v-model.number="discountValue"
									type="number"
									min="0"
									:max="discountType === 'percentage' ? 100 : undefined"
									step="0.01"
									class="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									@input="calculateDiscount"
								/>
								<span class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 text-sm">
									{{ discountType === 'percentage' ? '%' : '' }}
								</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Totals -->
				<div class="bg-gray-50 rounded-lg p-4 space-y-2">
					<div class="flex items-center justify-between text-sm">
						<span class="text-gray-600">Subtotal:</span>
						<span class="font-semibold text-gray-900">{{ currency }} {{ formatNumber(calculatedSubtotal) }}</span>
					</div>
					<div v-if="calculatedDiscount > 0" class="flex items-center justify-between text-sm text-red-600">
						<span>Discount:</span>
						<span class="font-semibold">-{{ currency }} {{ formatNumber(calculatedDiscount) }}</span>
					</div>
					<div class="flex items-center justify-between pt-2 border-t border-gray-200">
						<span class="text-base font-bold text-gray-900">Total:</span>
						<span class="text-lg font-bold text-blue-600">{{ currency }} {{ formatNumber(calculatedTotal) }}</span>
					</div>
				</div>
			</div>
		</template>

		<template #actions>
			<div class="flex items-center justify-end space-x-2">
				<Button variant="subtle" @click="cancel">Cancel</Button>
				<Button
					variant="solid"
					@click="updateItem"
					:disabled="!hasStock || isCheckingStock"
				>
					<span v-if="isCheckingStock">Checking Stock...</span>
					<span v-else-if="!hasStock">No Stock Available</span>
					<span v-else>Update Item</span>
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { useToast } from "@/composables/useToast"
import { usePOSSettingsStore } from "@/stores/posSettings"
import { getItemStock } from "@/utils/stockValidator"
import { call } from "@/utils/apiWrapper"
import { Button, Dialog } from "frappe-ui"
import { computed, ref, watch } from "vue"

const { showSuccess, showError, showWarning } = useToast()
const settingsStore = usePOSSettingsStore()

const props = defineProps({
	modelValue: Boolean,
	item: Object,
	warehouses: {
		type: Array,
		default: () => [],
	},
	currency: {
		type: String,
		default: "EGP",
	},
})

const emit = defineEmits(["update:modelValue", "update-item"])

// Local state
const localItem = ref(null)
const localQuantity = ref(1)
const localUom = ref("")
const localRate = ref(0)
const localWarehouse = ref("")
const discountType = ref("percentage")
const discountValue = ref(0)
const calculatedSubtotal = ref(0)
const calculatedDiscount = ref(0)
const calculatedTotal = ref(0)
const hasStock = ref(true)
const isCheckingStock = ref(false)
const stockInfo = ref([])
const loadingStock = ref(false)

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit("update:modelValue", val),
})

const availableUoms = computed(() => {
	if (!localItem.value || !localItem.value.item_uoms) return []
	return localItem.value.item_uoms.filter(
		(u) => u.uom !== localItem.value.stock_uom,
	)
})

// Initialize local state when item changes
watch(
	() => props.item,
	(newItem) => {
		if (newItem) {
			localItem.value = { ...newItem }
			localQuantity.value = newItem.quantity || 1
			localUom.value = newItem.uom || newItem.stock_uom || "Nos"
			localRate.value = newItem.rate || 0
			localWarehouse.value =
				newItem.warehouse || props.warehouses[0]?.name || ""

			// Initialize discount
			if (newItem.discount_percentage && newItem.discount_percentage > 0) {
				discountType.value = "percentage"
				discountValue.value = newItem.discount_percentage
			} else if (newItem.discount_amount && newItem.discount_amount > 0) {
				discountType.value = "amount"
				discountValue.value = newItem.discount_amount
			} else {
				discountType.value = "percentage"
				discountValue.value = 0
			}

			// Reset stock check state
			hasStock.value = true
			isCheckingStock.value = false

			calculateTotals()
			
			// Load stock information for all warehouses
			loadStockInfo()
		}
	},
	{ immediate: true },
)

function incrementQuantity() {
	localQuantity.value++
	calculateTotals()
}

function decrementQuantity() {
	if (localQuantity.value > 1) {
		localQuantity.value--
		calculateTotals()
	}
}

function validateQuantity() {
	if (localQuantity.value < 1) {
		localQuantity.value = 1
	}
	calculateTotals()
}

function handleUomChange() {
	// When UOM changes, we need to fetch new rate from server
	// For now, we'll just recalculate with current rate
	calculateTotals()
}

async function handleWarehouseChange() {
	if (!localItem.value || !localWarehouse.value) return

	isCheckingStock.value = true
	try {
		// Check stock availability in the new warehouse
		const availableStock = await getItemStock(
			localItem.value.item_code,
			localWarehouse.value,
		)

		if (availableStock === 0) {
			hasStock.value = false
			showError(
				`"${localItem.value.item_name}" is not available in warehouse "${localWarehouse.value}". Please select another warehouse.`,
			)
		} else if (availableStock < localQuantity.value) {
			hasStock.value = false
			showWarning(
				`Only ${availableStock} units of "${localItem.value.item_name}" available in "${localWarehouse.value}". Current quantity: ${localQuantity.value}`,
			)
		} else {
			hasStock.value = true
			showSuccess(
				`${availableStock} units available in "${localWarehouse.value}"`,
			)
		}
	} catch (error) {
		console.error("Error checking warehouse stock:", error)
		hasStock.value = true // Allow update if stock check fails
	} finally {
		isCheckingStock.value = false
	}
}

function handleDiscountTypeChange() {
	// Reset discount value when type changes
	discountValue.value = 0
	calculateTotals()
}

function calculateDiscount() {
	if (discountType.value === "percentage") {
		// Ensure percentage doesn't exceed 100
		if (discountValue.value > 100) {
			discountValue.value = 100
		}
		calculatedDiscount.value =
			(calculatedSubtotal.value * discountValue.value) / 100
	} else {
		// Ensure amount doesn't exceed subtotal
		if (discountValue.value > calculatedSubtotal.value) {
			discountValue.value = calculatedSubtotal.value
		}
		calculatedDiscount.value = discountValue.value
	}
	calculatedTotal.value = calculatedSubtotal.value - calculatedDiscount.value
}

function calculateTotals() {
	calculatedSubtotal.value = localRate.value * localQuantity.value
	calculateDiscount()
}

function formatNumber(num) {
	return Number.parseFloat(num || 0).toFixed(2)
}

function updateItem() {
	const updatedItem = {
		...localItem.value,
		quantity: localQuantity.value,
		uom: localUom.value,
		rate: localRate.value,
		warehouse: localWarehouse.value,
		discount_percentage:
			discountType.value === "percentage" ? discountValue.value : 0,
		discount_amount:
			discountType.value === "amount" ? discountValue.value : 0,
	}

	emit("update-item", updatedItem)
	show.value = false
}

async function loadStockInfo() {
	if (!localItem.value || !localItem.value.item_code) {
		stockInfo.value = []
		return
	}
	
	loadingStock.value = true
	try {
		const result = await call("pos_next.api.items.get_item_stock_all_warehouses", {
			item_code: localItem.value.item_code,
		})
		stockInfo.value = result?.message || result || []
	} catch (error) {
		console.error("Error loading stock information:", error)
		stockInfo.value = []
	} finally {
		loadingStock.value = false
	}
}

function cancel() {
	show.value = false
}
</script>

<style scoped>
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border-width: 0;
}

/* Hide number input spinners */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
	-webkit-appearance: none;
	margin: 0;
}

input[type="number"] {
	-moz-appearance: textfield;
}
</style>
