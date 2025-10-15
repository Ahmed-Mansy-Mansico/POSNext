<template>
	<!-- Full Page Overlay -->
	<Transition name="fade">
		<div
			v-if="show"
			class="fixed inset-0 bg-black bg-opacity-50 z-[300]"
			@click.self="handleClose"
		>
			<!-- Main Container -->
			<div class="fixed inset-0 flex items-center justify-center p-4">
				<div class="w-full h-full max-w-[95vw] max-h-[95vh] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
					<!-- Header -->
					<div class="flex items-center justify-between px-6 py-4 border-b">
						<div class="flex items-center space-x-3">
							<FeatherIcon name="tag" class="w-5 h-5 text-gray-700" />
							<div>
								<h2 class="text-lg font-semibold text-gray-900">Promotion Management</h2>
								<p class="text-sm text-gray-600">Create and manage promotional schemes</p>
							</div>
						</div>
						<div class="flex items-center space-x-2">
							<Button
								v-if="!isCreating && !selectedPromotion"
								@click="handleCreateNew"
								icon-left="plus"
							>
								<template #prefix>
									<FeatherIcon name="plus" class="w-4 h-4" />
								</template>
								New Promotion
							</Button>
							<Button
								variant="ghost"
								@click="handleClose"
								icon="x"
							>
								<template #icon>
									<FeatherIcon name="x" class="w-4 h-4" />
								</template>
							</Button>
						</div>
					</div>

					<!-- Content: Split Layout -->
					<div class="flex-1 flex overflow-hidden">
						<!-- LEFT SIDE: Promotion List & Navigation -->
						<div class="w-80 flex-shrink-0 border-r bg-gray-50 flex flex-col">
							<!-- Search & Filter -->
							<div class="p-4 bg-white border-b space-y-3">
								<FormControl
									type="text"
									v-model="searchQuery"
									placeholder="Search promotions..."
								>
									<template #prefix>
										<FeatherIcon name="search" class="w-4 h-4 text-gray-500" />
									</template>
								</FormControl>

								<FormControl
									type="select"
									v-model="filterStatus"
									:options="[
										{ label: 'All Status', value: 'all' },
										{ label: 'Active Only', value: 'active' },
										{ label: 'Expired Only', value: 'expired' },
										{ label: 'Not Started', value: 'not_started' },
										{ label: 'Disabled Only', value: 'disabled' }
									]"
								/>
							</div>

							<!-- Create New Button -->
							<div class="p-4 bg-white border-b space-y-2">
								<Button
									@click="handleCreateNew"
									variant="solid"
									class="w-full"
								>
									<template #prefix>
										<FeatherIcon name="plus-circle" class="w-4 h-4" />
									</template>
									Create New Promotion
								</Button>
								<Button
									@click="loadPromotions"
									variant="outline"
									class="w-full"
									:loading="loading"
								>
									<template #prefix>
										<FeatherIcon name="refresh-cw" class="w-4 h-4" />
									</template>
									Refresh
								</Button>
							</div>

							<!-- Promotions List -->
							<div class="flex-1 overflow-y-auto">
								<!-- Loading State -->
								<div v-if="loading && promotions.length === 0" class="flex items-center justify-center py-12">
									<div class="text-center">
										<LoadingIndicator class="w-6 h-6 mx-auto mb-2" />
										<p class="text-sm text-gray-600">Loading...</p>
									</div>
								</div>

								<!-- Empty State -->
								<div v-else-if="filteredPromotions.length === 0" class="text-center py-12 px-4">
									<div class="text-gray-400 mb-3">
										<FeatherIcon name="inbox" class="w-12 h-12 mx-auto" />
									</div>
									<p class="text-sm text-gray-600">No promotions found</p>
								</div>

								<!-- Promotion Items -->
								<div v-else class="p-2 space-y-1">
									<button
										v-for="promotion in filteredPromotions"
										:key="promotion.name"
										@click="handleSelectPromotion(promotion)"
										:class="[
											'w-full text-left p-3 rounded-md transition-all',
											selectedPromotion?.name === promotion.name
												? 'bg-blue-50 ring-2 ring-blue-500 ring-inset'
												: 'hover:bg-gray-100'
										]"
									>
										<div class="flex items-start justify-between mb-2">
											<div class="flex-1 min-w-0">
												<div class="flex items-center space-x-2">
													<p :class="[
														'text-sm font-medium truncate',
														selectedPromotion?.name === promotion.name ? 'text-blue-900' : 'text-gray-900'
													]">
														{{ promotion.name }}
													</p>
													<Badge
														v-if="promotion.source === 'Pricing Rule'"
														variant="subtle"
														theme="blue"
														size="sm"
													>
														Rule
													</Badge>
													<Badge
														v-else-if="promotion.source === 'Promotional Scheme'"
														variant="subtle"
														theme="purple"
														size="sm"
													>
														Scheme
													</Badge>
												</div>
												<p class="text-xs text-gray-500 mt-0.5">{{ promotion.items_count || 0 }} items</p>
											</div>
											<Badge
												variant="subtle"
												:theme="getStatusTheme(promotion.status)"
												size="sm"
											>
												{{ promotion.status || 'Active' }}
											</Badge>
										</div>
										<div class="flex items-center justify-between text-xs">
											<Badge variant="subtle">
												{{ promotion.apply_on }}
											</Badge>
											<span class="text-gray-500">
												{{ promotion.valid_upto ? formatDate(promotion.valid_upto) : 'No expiry' }}
											</span>
										</div>
									</button>
								</div>
							</div>
						</div>

						<!-- RIGHT SIDE: Work Area -->
						<div class="flex-1 overflow-y-auto bg-white">
							<!-- Empty State: No Selection -->
							<div v-if="!selectedPromotion && !isCreating" class="flex items-center justify-center h-full">
								<div class="text-center px-8 max-w-md">
									<div class="text-gray-300 mb-4">
										<FeatherIcon name="tag" class="w-16 h-16 mx-auto" />
									</div>
									<h3 class="text-xl font-semibold text-gray-900 mb-2">Select a Promotion</h3>
									<p class="text-sm text-gray-600 mb-6">Choose a promotion from the list to view and edit, or create a new one to get started</p>
									<Button
										@click="handleCreateNew"
										variant="solid"
									>
										<template #prefix>
											<FeatherIcon name="plus" class="w-4 h-4" />
										</template>
										Create New Promotion
									</Button>
								</div>
							</div>

							<!-- Create/Edit Form -->
							<div v-else class="p-6">
								<div class="max-w-5xl mx-auto">
									<!-- Form Header -->
									<div class="flex items-center justify-between mb-6 pb-4 border-b">
										<div>
											<div class="flex items-center space-x-3">
												<h3 class="text-xl font-semibold text-gray-900">
													{{ isCreating ? 'Create New Promotion' : 'Edit Promotion' }}
												</h3>
												<Badge
													v-if="!isCreating && selectedPromotion?.source === 'Pricing Rule'"
													variant="subtle"
													theme="blue"
													size="md"
												>
													Pricing Rule
												</Badge>
												<Badge
													v-else-if="!isCreating && selectedPromotion?.source === 'Promotional Scheme'"
													variant="subtle"
													theme="purple"
													size="md"
												>
													Promotional Scheme
												</Badge>
											</div>
											<p class="text-sm text-gray-600 mt-1">
												{{ isCreating ? 'Fill in the details to create a new promotional scheme' : isPricingRule ? 'View pricing rule details (read-only)' : 'Update the promotion details below' }}
											</p>
										</div>
										<div class="flex items-center space-x-2">
											<!-- Show info badge for read-only Pricing Rules -->
											<div v-if="isPricingRule" class="flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-lg">
												<FeatherIcon name="info" class="w-4 h-4 text-blue-600" />
												<span class="text-xs text-blue-700 font-medium">Read-only: Edit in ERPNext</span>
											</div>

											<Button
												v-if="!isCreating && !isPricingRule"
												@click="handleDelete(selectedPromotion)"
												variant="ghost"
												theme="red"
											>
												<template #prefix>
													<FeatherIcon name="trash-2" class="w-4 h-4" />
												</template>
												Delete
											</Button>
											<Button
												v-if="!isCreating && !isPricingRule"
												@click="handleToggle(selectedPromotion)"
												variant="outline"
												:theme="selectedPromotion.disable ? 'green' : 'orange'"
											>
												<template #prefix>
													<FeatherIcon :name="selectedPromotion.disable ? 'check-circle' : 'x-circle'" class="w-4 h-4" />
												</template>
												{{ selectedPromotion.disable ? 'Enable' : 'Disable' }}
											</Button>
											<div v-if="!isPricingRule" class="w-px h-6 bg-gray-200"></div>
											<Button
												@click="handleCancel"
												variant="ghost"
											>
												{{ isPricingRule ? 'Close' : 'Cancel' }}
											</Button>
											<Button
												v-if="!isPricingRule"
												@click="handleSubmit"
												:loading="loading"
												variant="solid"
											>
												<template #prefix>
													<FeatherIcon :name="isCreating ? 'plus' : 'save'" class="w-4 h-4" />
												</template>
												{{ isCreating ? 'Create' : 'Update' }}
											</Button>
										</div>
									</div>

									<!-- Form Content -->
									<div class="space-y-6">
										<!-- Basic Information Card -->
										<Card>
											<div class="p-5">
												<div class="flex items-center space-x-2 mb-4">
													<FeatherIcon name="info" class="w-4 h-4 text-blue-600" />
													<h4 class="text-sm font-semibold text-gray-900">Basic Information</h4>
												</div>
												<div class="grid grid-cols-3 gap-4">
													<div class="col-span-3">
														<FormControl
															type="text"
															label="Promotion Name"
															v-model="form.name"
															:disabled="!isCreating"
															placeholder="e.g., Summer Sale 2025"
															required
														/>
													</div>

													<FormControl
														type="date"
														label="Valid From"
														v-model="form.valid_from"
														:disabled="isPricingRule"
													/>

													<FormControl
														type="date"
														label="Valid Until"
														v-model="form.valid_upto"
														:disabled="isPricingRule"
													/>

													<FormControl
														type="select"
														label="Apply On"
														v-model="form.apply_on"
														:disabled="!isCreating || isPricingRule"
														:options="[
															{ label: 'Specific Items', value: 'Item Code' },
															{ label: 'Item Groups', value: 'Item Group' },
															{ label: 'Brands', value: 'Brand' },
															{ label: 'Entire Transaction', value: 'Transaction' }
														]"
														required
													/>
												</div>
											</div>
										</Card>

										<!-- Item Selection Card -->
										<Card v-if="form.apply_on !== 'Transaction'">
											<div class="p-5">
												<div class="flex items-center space-x-2 mb-4">
													<FeatherIcon name="list" class="w-4 h-4 text-green-600" />
													<h4 class="text-sm font-semibold text-gray-900">Select {{ form.apply_on }}</h4>
													<Badge variant="subtle" theme="red" size="sm">Required</Badge>
												</div>

												<!-- Item Code Search -->
												<div v-if="form.apply_on === 'Item Code'" class="space-y-3">
													<div>
														<FormControl
															type="text"
															v-model="itemSearch"
															:disabled="!isCreating"
															placeholder="Search items... (min 2 characters)"
														>
															<template #prefix>
																<FeatherIcon name="search" class="w-4 h-4 text-gray-500" />
															</template>
														</FormControl>
														<p class="text-xs text-gray-500 mt-1">Searching from {{ itemSearchStore.allItems.length }} cached items</p>
													</div>

													<!-- Search Results -->
													<div v-if="searchResults.length > 0" class="border rounded-lg overflow-hidden">
														<div class="max-h-40 overflow-y-auto divide-y">
															<button
																v-for="item in searchResults"
																:key="item.item_code"
																@click="addItem(item)"
																class="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
															>
																<p class="text-sm font-medium text-gray-900">{{ item.item_name }}</p>
																<p class="text-xs text-gray-500">{{ item.item_code }}</p>
															</button>
														</div>
													</div>

													<!-- Selected Items -->
													<div v-if="form.items.length > 0" class="flex flex-wrap gap-2">
														<Badge
															v-for="(item, index) in form.items"
															:key="index"
															variant="subtle"
															theme="blue"
														>
															{{ item.item_code }}
															<button
																@click="removeItem(index)"
																class="ml-1 hover:text-blue-900"
															>
																×
															</button>
														</Badge>
													</div>
												</div>

												<!-- Item Group Selection -->
												<div v-else-if="form.apply_on === 'Item Group'" class="space-y-3">
													<FormControl
														type="select"
														v-model="selectedItemGroup"
														:disabled="!isCreating"
														@change="addItemGroup"
														:options="[
															{ label: '-- Select Item Group --', value: '' },
															...itemGroups.map(g => ({ label: g.name, value: g.name }))
														]"
													/>

													<div v-if="form.items.length > 0" class="flex flex-wrap gap-2">
														<Badge
															v-for="(item, index) in form.items"
															:key="index"
															variant="subtle"
															theme="green"
														>
															{{ item.item_group }}
															<button
																@click="removeItem(index)"
																class="ml-1 hover:text-green-900"
															>
																×
															</button>
														</Badge>
													</div>
												</div>

												<!-- Brand Selection -->
												<div v-else-if="form.apply_on === 'Brand'" class="space-y-3">
													<FormControl
														type="select"
														v-model="selectedBrand"
														:disabled="!isCreating"
														@change="addBrand"
														:options="[
															{ label: '-- Select Brand --', value: '' },
															...brands.map(b => ({ label: b.name, value: b.name }))
														]"
													/>

													<div v-if="form.items.length > 0" class="flex flex-wrap gap-2">
														<Badge
															v-for="(item, index) in form.items"
															:key="index"
															variant="subtle"
															theme="purple"
														>
															{{ item.brand }}
															<button
																@click="removeItem(index)"
																class="ml-1 hover:text-purple-900"
															>
																×
															</button>
														</Badge>
													</div>
												</div>
											</div>
										</Card>

										<!-- Discount Details Card -->
										<Card>
											<div class="p-5">
												<div class="flex items-center space-x-2 mb-4">
													<FeatherIcon name="percent" class="w-4 h-4 text-purple-600" />
													<h4 class="text-sm font-semibold text-gray-900">Discount Details</h4>
													<Badge variant="subtle" theme="red" size="sm">Required</Badge>
												</div>

												<div class="space-y-4">
													<!-- Discount Type Selection -->
													<div>
														<label class="block text-sm font-medium text-gray-700 mb-3">Discount Type</label>
														<div class="grid grid-cols-3 gap-3">
															<button
																v-for="type in discountTypes"
																:key="type.value"
																@click="form.discount_type = type.value"
																:disabled="!isCreating"
																:class="[
																	'p-3 border rounded-lg transition-all flex items-center justify-center space-x-2',
																	form.discount_type === type.value
																		? 'border-blue-600 bg-blue-50 text-blue-900'
																		: 'border-gray-300 hover:border-gray-400 text-gray-700',
																	!isCreating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
																]"
															>
																<FeatherIcon :name="type.icon" class="w-4 h-4" />
																<span class="text-sm font-medium">{{ type.label }}</span>
															</button>
														</div>
													</div>

													<!-- Discount Values -->
													<div class="grid grid-cols-3 gap-4">
														<FormControl
															v-if="form.discount_type !== 'free_item'"
															type="number"
															:label="form.discount_type === 'percentage' ? 'Discount (%)' : `Discount (${currency})`"
															v-model="form.discount_value"
															placeholder="0"
															:disabled="isPricingRule"
															required
														/>

														<!-- Free Item Search -->
														<div v-if="form.discount_type === 'free_item'" class="space-y-2">
															<label class="block text-sm font-medium text-gray-700">Free Item <span class="text-red-500">*</span></label>

															<!-- Search Input -->
															<FormControl
																v-if="!form.free_item"
																type="text"
																v-model="freeItemSearch"
																placeholder="Search item... (min 2 characters)"
															>
																<template #prefix>
																	<FeatherIcon name="search" class="w-4 h-4 text-gray-500" />
																</template>
															</FormControl>

															<!-- Search Results -->
															<div v-if="freeItemSearchResults.length > 0 && !form.free_item" class="border rounded-lg overflow-hidden">
																<div class="max-h-40 overflow-y-auto divide-y">
																	<button
																		v-for="item in freeItemSearchResults"
																		:key="item.item_code"
																		@click="selectFreeItem(item)"
																		type="button"
																		class="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
																	>
																		<p class="text-sm font-medium text-gray-900">{{ item.item_name }}</p>
																		<p class="text-xs text-gray-500">{{ item.item_code }}</p>
																	</button>
																</div>
															</div>

															<!-- Selected Free Item -->
															<div v-if="form.free_item" class="flex items-center space-x-2">
																<Badge variant="subtle" theme="green" size="md">
																	{{ form.free_item }}
																	<button
																		@click="form.free_item = ''"
																		type="button"
																		class="ml-2 hover:text-green-900"
																	>
																		×
																	</button>
																</Badge>
															</div>
														</div>

														<FormControl
															v-if="form.discount_type === 'free_item'"
															type="number"
															label="Free Quantity"
															v-model="form.free_qty"
															placeholder="1"
															:disabled="isPricingRule"
															required
														/>

														<FormControl
															type="number"
															label="Minimum Quantity"
															v-model="form.min_qty"
															placeholder="0"
															:disabled="isPricingRule"
														/>

														<FormControl
															type="number"
															label="Maximum Quantity"
															v-model="form.max_qty"
															placeholder="0"
															:disabled="isPricingRule"
														/>

														<FormControl
															type="number"
															:label="`Minimum Amount (${currency})`"
															v-model="form.min_amt"
															placeholder="0"
															:disabled="isPricingRule"
														/>

														<FormControl
															type="number"
															:label="`Maximum Amount (${currency})`"
															v-model="form.max_amt"
															placeholder="0"
															:disabled="isPricingRule"
														/>
													</div>
												</div>
											</div>
										</Card>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Delete Confirmation Dialog -->
				<Transition name="fade">
					<div
						v-if="showDeleteConfirm"
						class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[400]"
						@click.self="cancelDelete"
					>
						<div class="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-6">
							<div class="flex items-start space-x-4">
								<div class="flex-shrink-0">
									<div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
										<FeatherIcon name="alert-triangle" class="w-6 h-6 text-red-600" />
									</div>
								</div>
								<div class="flex-1">
									<h3 class="text-lg font-semibold text-gray-900 mb-2">Delete Promotion</h3>
									<p class="text-sm text-gray-600 mb-1">
										Are you sure you want to delete <strong>"{{ promotionToDelete?.name }}"</strong>?
									</p>
									<p class="text-sm text-gray-500">
										This will also delete all associated pricing rules. This action cannot be undone.
									</p>
								</div>
							</div>
							<div class="flex justify-end space-x-3 mt-6">
								<Button
									@click="cancelDelete"
									variant="ghost"
								>
									Cancel
								</Button>
								<Button
									@click="confirmDelete"
									variant="solid"
									theme="red"
								>
									<template #prefix>
										<FeatherIcon name="trash-2" class="w-4 h-4" />
									</template>
									Delete Promotion
								</Button>
							</div>
						</div>
					</div>
				</Transition>
			</div>
		</div>
	</Transition>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { Button, FormControl, Badge, Card, LoadingIndicator, createResource } from 'frappe-ui'
import { FeatherIcon } from 'frappe-ui'
import { useItemSearchStore } from '@/stores/itemSearch'
import { useToast } from '@/composables/useToast'

// Use shared toast
const { showSuccess, showError, showWarning } = useToast()

const props = defineProps({
	modelValue: Boolean,
	posProfile: String,
	company: String,
	currency: {
		type: String,
		default: 'USD'
	}
})

const emit = defineEmits(['update:modelValue', 'promotion-saved'])

// Access cached items from the store
const itemSearchStore = useItemSearchStore()

const show = ref(props.modelValue)
const loading = ref(false)
const isCreating = ref(false)
const selectedPromotion = ref(null)
const showDeleteConfirm = ref(false)
const promotionToDelete = ref(null)

// List view state
const promotions = ref([])
const searchQuery = ref('')
const filterStatus = ref('all')

// Form state
const form = ref({
	name: '',
	company: props.company,
	apply_on: 'Item Group',
	discount_type: 'percentage',
	discount_value: 0,
	free_item: '',
	free_qty: 1,
	items: [],
	min_qty: 0,
	max_qty: 0,
	min_amt: 0,
	max_amt: 0,
	valid_from: '',
	valid_upto: ''
})

// Dropdown data
const itemGroups = ref([])
const brands = ref([])
const itemSearch = ref('')
const freeItemSearch = ref('')
const selectedItemGroup = ref('')
const selectedBrand = ref('')

// Discount types
const discountTypes = [
	{ value: 'percentage', label: 'Percentage', icon: 'percent' },
	{ value: 'amount', label: 'Fixed Amount', icon: 'dollar-sign' },
	{ value: 'free_item', label: 'Free Item', icon: 'gift' }
]

// Computed
const isPricingRule = computed(() => {
	return !isCreating.value && selectedPromotion.value?.source === 'Pricing Rule'
})

const filteredPromotions = computed(() => {
	let filtered = promotions.value

	// Filter by search query
	if (searchQuery.value) {
		filtered = filtered.filter(p =>
			p.name.toLowerCase().includes(searchQuery.value.toLowerCase())
		)
	}

	// Filter by status
	if (filterStatus.value === 'active') {
		filtered = filtered.filter(p => p.status === 'Active')
	} else if (filterStatus.value === 'expired') {
		filtered = filtered.filter(p => p.status === 'Expired')
	} else if (filterStatus.value === 'not_started') {
		filtered = filtered.filter(p => p.status === 'Not Started')
	} else if (filterStatus.value === 'disabled') {
		filtered = filtered.filter(p => p.status === 'Disabled')
	}

	return filtered
})

// Computed: Filter cached items based on search term
const searchResults = computed(() => {
	if (!itemSearch.value || itemSearch.value.length < 2) {
		return []
	}

	const term = itemSearch.value.toLowerCase()
	const allItems = itemSearchStore.allItems || []

	// Filter items by search term
	const filtered = allItems.filter(item =>
		item.item_code?.toLowerCase().includes(term) ||
		item.item_name?.toLowerCase().includes(term) ||
		item.barcode?.toLowerCase().includes(term)
	)

	// Limit to 20 results for performance
	return filtered.slice(0, 20)
})

// Computed: Filter cached items for free item selection
const freeItemSearchResults = computed(() => {
	if (!freeItemSearch.value || freeItemSearch.value.length < 2) {
		return []
	}

	const term = freeItemSearch.value.toLowerCase()
	const allItems = itemSearchStore.allItems || []

	// Filter items by search term
	const filtered = allItems.filter(item =>
		item.item_code?.toLowerCase().includes(term) ||
		item.item_name?.toLowerCase().includes(term) ||
		item.barcode?.toLowerCase().includes(term)
	)

	// Limit to 20 results for performance
	return filtered.slice(0, 20)
})

// Resources
const promotionsResource = createResource({
	url: 'pos_next.api.promotions.get_promotions',
	makeParams() {
		return {
			pos_profile: props.posProfile,
			company: props.company,
			include_disabled: true
		}
	},
	auto: false,
	onSuccess(data) {
		promotions.value = data || []
		loading.value = false
	}
})

const itemGroupsResource = createResource({
	url: 'pos_next.api.promotions.get_item_groups',
	makeParams() {
		return { company: props.company }
	},
	auto: false,
	onSuccess(data) {
		itemGroups.value = data || []
	},
	onError(error) {
		console.error('Error loading item groups:', error)
		handleError(error, 'Failed to load item groups')
	}
})

const brandsResource = createResource({
	url: 'pos_next.api.promotions.get_brands',
	auto: false,
	onSuccess(data) {
		brands.value = data || []
	},
	onError(error) {
		console.error('Error loading brands:', error)
		handleError(error, 'Failed to load brands')
	}
})

const savePromotionResource = createResource({
	url: 'pos_next.api.promotions.create_promotion',
	makeParams() {
		return { data: JSON.stringify(form.value) }
	},
	auto: false,
	onSuccess(data) {
		loading.value = false
		const responseData = data?.message || data
		const successMessage = responseData?.message || 'Promotion created successfully'

		showSuccess(successMessage)
		emit('promotion-saved', responseData)
		loadPromotions()
		returnToList()
	},
	onError(error) {
		loading.value = false
		handleError(error, 'Failed to create promotion')
	}
})

const updatePromotionResource = createResource({
	url: 'pos_next.api.promotions.update_promotion',
	makeParams() {
		return {
			scheme_name: form.value.name,
			data: JSON.stringify({
				valid_from: form.value.valid_from,
				valid_upto: form.value.valid_upto,
				min_qty: form.value.min_qty,
				max_qty: form.value.max_qty,
				min_amt: form.value.min_amt,
				max_amt: form.value.max_amt,
				discount_value: form.value.discount_value,
				free_item: form.value.free_item,
				free_qty: form.value.free_qty
			})
		}
	},
	auto: false,
	onSuccess(data) {
		loading.value = false
		const responseData = data?.message || data
		const successMessage = responseData?.message || 'Promotion updated successfully'

		showSuccess(successMessage)
		loadPromotions()
		returnToList()
	},
	onError(error) {
		loading.value = false
		handleError(error, 'Failed to update promotion')
	}
})

const toggleResource = createResource({
	url: 'pos_next.api.promotions.toggle_promotion',
	auto: false,
	onSuccess() {
		showSuccess('Promotion status updated successfully')
		loadPromotions()
	},
	onError(error) {
		handleError(error, 'Failed to update promotion status')
	}
})

const deleteResource = createResource({
	url: 'pos_next.api.promotions.delete_promotion',
	auto: false,
	onSuccess(data) {
		const responseData = data?.message || data
		const successMessage = responseData?.message || 'Promotion deleted successfully'

		showSuccess(successMessage)

		// Close delete confirmation dialog
		showDeleteConfirm.value = false
		promotionToDelete.value = null

		// Reload and return to list
		loadPromotions()
		returnToList()
	},
	onError(error) {
		loading.value = false
		showDeleteConfirm.value = false
		promotionToDelete.value = null
		handleError(error, 'Failed to delete promotion')
	}
})

const promotionDetailsResource = createResource({
	url: 'pos_next.api.promotions.get_promotion_details',
	makeParams() {
		return {
			scheme_name: selectedPromotion.value?.name
		}
	},
	auto: false,
	onSuccess(data) {
		loading.value = false
		populateFormFromPromotion(data)
	},
	onError(error) {
		loading.value = false
		handleError(error, 'Failed to load promotion details')
	}
})

watch(() => props.modelValue, (val) => {
	show.value = val
	if (val) {
		loadPromotions()
		loadData()
	}
})

watch(show, (val) => {
	emit('update:modelValue', val)
	if (!val) {
		resetForm()
		selectedPromotion.value = null
		isCreating.value = false
	}
})

// Utility: Parse error messages from server response
function parseErrorMessage(error) {
	try {
		// Check if there's a _server_messages field
		if (error._server_messages) {
			const messages = JSON.parse(error._server_messages)
			if (Array.isArray(messages) && messages.length > 0) {
				const firstMessage = typeof messages[0] === 'string' ? JSON.parse(messages[0]) : messages[0]
				return firstMessage.message || error.message || 'An error occurred'
			}
		}
		// Fallback to error.message
		return error.message || 'An error occurred'
	} catch (e) {
		return error.message || 'An error occurred'
	}
}

// Utility: Show error with proper parsing
function handleError(error, defaultMessage = 'An error occurred') {
	const errorMessage = parseErrorMessage(error)
	showError(errorMessage || defaultMessage)
}

// Utility: Reset form and return to list view (keep dialog open)
function returnToList() {
	resetForm()
	selectedPromotion.value = null
	isCreating.value = false
}

function loadPromotions() {
	loading.value = true
	promotionsResource.reload()
}

function loadData() {
	itemGroupsResource.reload()
	brandsResource.reload()
}

function handleClose() {
	show.value = false
}

function handleCreateNew() {
	resetForm()
	isCreating.value = true
	selectedPromotion.value = null
}

function handleSelectPromotion(promotion) {
	isCreating.value = false
	selectedPromotion.value = promotion
	loading.value = true
	promotionDetailsResource.reload()
}

function handleCancel() {
	resetForm()
	selectedPromotion.value = null
	isCreating.value = false
}

function handleToggle(promotion) {
	toggleResource.submit({ scheme_name: promotion.name })
}

function handleDelete(promotion) {
	promotionToDelete.value = promotion
	showDeleteConfirm.value = true
}

function confirmDelete() {
	if (promotionToDelete.value) {
		loading.value = true
		deleteResource.submit({ scheme_name: promotionToDelete.value.name })
	}
}

function cancelDelete() {
	showDeleteConfirm.value = false
	promotionToDelete.value = null
}

function handleSubmit() {
	// Validate
	if (!form.value.name) {
		showWarning('Please enter a promotion name')
		return
	}

	// Check for duplicate name when creating
	if (isCreating.value) {
		const duplicate = promotions.value.find(p =>
			p.name.toLowerCase() === form.value.name.toLowerCase()
		)
		if (duplicate) {
			showWarning(`Promotion "${form.value.name}" already exists. Please use a different name.`)
			return
		}
	}

	if (form.value.apply_on !== 'Transaction' && form.value.items.length === 0) {
		showWarning(`Please select at least one ${form.value.apply_on}`)
		return
	}

	loading.value = true

	if (isCreating.value) {
		savePromotionResource.reload()
	} else {
		updatePromotionResource.reload()
	}
}

function addItem(item) {
	if (!form.value.items.some(i => i.item_code === item.item_code)) {
		form.value.items.push({ item_code: item.item_code })
	}
	// Clear search term (searchResults will automatically update via computed)
	itemSearch.value = ''
}

function addItemGroup() {
	if (selectedItemGroup.value && !form.value.items.some(i => i.item_group === selectedItemGroup.value)) {
		form.value.items.push({ item_group: selectedItemGroup.value })
	}
	selectedItemGroup.value = ''
}

function addBrand() {
	if (selectedBrand.value && !form.value.items.some(i => i.brand === selectedBrand.value)) {
		form.value.items.push({ brand: selectedBrand.value })
	}
	selectedBrand.value = ''
}

function removeItem(index) {
	form.value.items.splice(index, 1)
}

function selectFreeItem(item) {
	form.value.free_item = item.item_code
	freeItemSearch.value = ''
}

function resetForm() {
	form.value = {
		name: '',
		company: props.company,
		apply_on: 'Item Group',
		discount_type: 'percentage',
		discount_value: 0,
		free_item: '',
		free_qty: 1,
		items: [],
		min_qty: 0,
		max_qty: 0,
		min_amt: 0,
		max_amt: 0,
		valid_from: '',
		valid_upto: ''
	}
	itemSearch.value = ''
	freeItemSearch.value = ''
	selectedItemGroup.value = ''
	selectedBrand.value = ''
}

function populateFormFromPromotion(promotion) {
	// Reset form first
	resetForm()

	// Basic fields
	form.value.name = promotion.name
	form.value.company = promotion.company
	form.value.apply_on = promotion.apply_on
	form.value.valid_from = promotion.valid_from || ''
	form.value.valid_upto = promotion.valid_upto || ''

	// Populate items/item_groups/brands based on apply_on
	if (promotion.apply_on === 'Item Code' && promotion.items) {
		form.value.items = promotion.items.map(item => ({
			item_code: item.item_code,
			uom: item.uom
		}))
	} else if (promotion.apply_on === 'Item Group' && promotion.item_groups) {
		form.value.items = promotion.item_groups.map(group => ({
			item_group: group.item_group,
			uom: group.uom
		}))
	} else if (promotion.apply_on === 'Brand' && promotion.brands) {
		form.value.items = promotion.brands.map(brand => ({
			brand: brand.brand,
			uom: brand.uom
		}))
	}

	// Populate discount details from slabs
	if (promotion.price_discount_slabs && promotion.price_discount_slabs.length > 0) {
		const slab = promotion.price_discount_slabs[0]
		form.value.min_qty = slab.min_qty || 0
		form.value.max_qty = slab.max_qty || 0
		form.value.min_amt = slab.min_amount || 0
		form.value.max_amt = slab.max_amount || 0

		if (slab.rate_or_discount === 'Discount Percentage') {
			form.value.discount_type = 'percentage'
			form.value.discount_value = slab.discount_percentage || 0
		} else if (slab.rate_or_discount === 'Discount Amount') {
			form.value.discount_type = 'amount'
			form.value.discount_value = slab.discount_amount || 0
		}
	} else if (promotion.product_discount_slabs && promotion.product_discount_slabs.length > 0) {
		const slab = promotion.product_discount_slabs[0]
		form.value.discount_type = 'free_item'
		form.value.free_item = slab.free_item || ''
		form.value.free_qty = slab.free_qty || 1
		form.value.min_qty = slab.min_qty || 0
		form.value.max_qty = slab.max_qty || 0
		form.value.min_amt = slab.min_amount || 0
		form.value.max_amt = slab.max_amount || 0
	}
}

function formatDate(dateStr) {
	if (!dateStr) return ''
	const date = new Date(dateStr)
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getStatusTheme(status) {
	switch (status) {
		case 'Active':
			return 'green'
		case 'Expired':
			return 'red'
		case 'Not Started':
			return 'orange'
		case 'Disabled':
			return 'gray'
		default:
			return 'gray'
	}
}
</script>

<style scoped>
/* Fade transition for overlay */
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
