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
										{ label: 'Disabled Only', value: 'disabled' }
									]"
								/>
							</div>

							<!-- Create New Button -->
							<div class="p-4 bg-white border-b">
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
												<p :class="[
													'text-sm font-medium truncate',
													selectedPromotion?.name === promotion.name ? 'text-blue-900' : 'text-gray-900'
												]">
													{{ promotion.name }}
												</p>
												<p class="text-xs text-gray-500 mt-0.5">{{ promotion.items_count || 0 }} items</p>
											</div>
											<Badge
												:variant="promotion.disable ? 'subtle' : 'subtle'"
												:theme="promotion.disable ? 'red' : 'green'"
												size="sm"
											>
												{{ promotion.disable ? 'Disabled' : 'Active' }}
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
											<h3 class="text-xl font-semibold text-gray-900">
												{{ isCreating ? 'Create New Promotion' : 'Edit Promotion' }}
											</h3>
											<p class="text-sm text-gray-600 mt-1">
												{{ isCreating ? 'Fill in the details to create a new promotional scheme' : 'Update the promotion details below' }}
											</p>
										</div>
										<div class="flex items-center space-x-2">
											<Button
												v-if="!isCreating"
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
												v-if="!isCreating"
												@click="handleToggle(selectedPromotion)"
												variant="outline"
												:theme="selectedPromotion.disable ? 'green' : 'orange'"
											>
												<template #prefix>
													<FeatherIcon :name="selectedPromotion.disable ? 'check-circle' : 'x-circle'" class="w-4 h-4" />
												</template>
												{{ selectedPromotion.disable ? 'Enable' : 'Disable' }}
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
													/>

													<FormControl
														type="date"
														label="Valid Until"
														v-model="form.valid_upto"
													/>

													<FormControl
														type="select"
														label="Apply On"
														v-model="form.apply_on"
														:disabled="!isCreating"
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
													<div class="flex space-x-2">
														<FormControl
															type="text"
															v-model="itemSearch"
															:disabled="!isCreating"
															placeholder="Search items..."
															@input="searchItems"
															class="flex-1"
														>
															<template #prefix>
																<FeatherIcon name="search" class="w-4 h-4 text-gray-500" />
															</template>
														</FormControl>
														<Button
															@click="searchItems"
															:disabled="!isCreating"
															variant="solid"
														>
															Search
														</Button>
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
															required
														/>

														<FormControl
															v-if="form.discount_type === 'free_item'"
															type="text"
															label="Free Item Code"
															v-model="form.free_item"
															placeholder="ITEM-001"
															required
														/>

														<FormControl
															v-if="form.discount_type === 'free_item'"
															type="number"
															label="Free Quantity"
															v-model="form.free_qty"
															placeholder="1"
															required
														/>

														<FormControl
															type="number"
															label="Minimum Quantity"
															v-model="form.min_qty"
															placeholder="0"
														/>

														<FormControl
															type="number"
															:label="`Minimum Amount (${currency})`"
															v-model="form.min_amt"
															placeholder="0"
														/>
													</div>
												</div>
											</div>
										</Card>

										<!-- Action Buttons -->
										<div class="flex items-center justify-end space-x-3 pt-4 border-t">
											<Button
												@click="handleCancel"
												variant="ghost"
											>
												Cancel
											</Button>
											<Button
												@click="handleSubmit"
												:loading="loading"
												variant="solid"
											>
												<template #prefix>
													<FeatherIcon :name="isCreating ? 'plus' : 'save'" class="w-4 h-4" />
												</template>
												{{ isCreating ? 'Create Promotion' : 'Update Promotion' }}
											</Button>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { Button, FormControl, Badge, Card, LoadingIndicator, createResource, toast } from 'frappe-ui'
import { FeatherIcon } from 'frappe-ui'

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

const show = ref(props.modelValue)
const loading = ref(false)
const isCreating = ref(false)
const selectedPromotion = ref(null)

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
	min_amt: 0,
	valid_from: '',
	valid_upto: ''
})

// Dropdown data
const itemGroups = ref([])
const brands = ref([])
const searchResults = ref([])
const itemSearch = ref('')
const selectedItemGroup = ref('')
const selectedBrand = ref('')

// Discount types
const discountTypes = [
	{ value: 'percentage', label: 'Percentage', icon: 'percent' },
	{ value: 'amount', label: 'Fixed Amount', icon: 'dollar-sign' },
	{ value: 'free_item', label: 'Free Item', icon: 'gift' }
]

// Computed
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
		filtered = filtered.filter(p => !p.disable)
	} else if (filterStatus.value === 'disabled') {
		filtered = filtered.filter(p => p.disable)
	}

	return filtered
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
	}
})

const brandsResource = createResource({
	url: 'pos_next.api.promotions.get_brands',
	auto: false,
	onSuccess(data) {
		brands.value = data || []
	}
})

const searchItemsResource = createResource({
	url: 'pos_next.api.promotions.search_items',
	makeParams() {
		return {
			search_term: itemSearch.value,
			pos_profile: props.posProfile,
			limit: 20
		}
	},
	auto: false,
	onSuccess(data) {
		searchResults.value = data || []
	}
})

const savePromotionResource = createResource({
	url: 'pos_next.api.promotions.create_simple_promotion',
	makeParams() {
		return { data: JSON.stringify(form.value) }
	},
	auto: false,
	onSuccess(data) {
		loading.value = false
		toast({
			title: 'Success',
			text: data.message || 'Promotion created successfully',
			icon: 'check',
			iconClasses: 'text-green-600'
		})
		emit('promotion-saved', data)
		loadPromotions()
		resetForm()
		isCreating.value = false
		selectedPromotion.value = null
	},
	onError(error) {
		loading.value = false
		toast({
			title: 'Error',
			text: error.message || 'Failed to save promotion',
			icon: 'x',
			iconClasses: 'text-red-600'
		})
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
				min_amt: form.value.min_amt,
				discount_value: form.value.discount_value,
				free_item: form.value.free_item,
				free_qty: form.value.free_qty
			})
		}
	},
	auto: false,
	onSuccess(data) {
		loading.value = false
		toast({
			title: 'Success',
			text: 'Promotion updated successfully',
			icon: 'check',
			iconClasses: 'text-green-600'
		})
		loadPromotions()
	}
})

const toggleResource = createResource({
	url: 'pos_next.api.promotions.toggle_promotion',
	auto: false,
	onSuccess() {
		toast({
			title: 'Success',
			text: 'Promotion status updated',
			icon: 'check',
			iconClasses: 'text-green-600'
		})
		loadPromotions()
	}
})

const deleteResource = createResource({
	url: 'pos_next.api.promotions.delete_promotion',
	auto: false,
	onSuccess() {
		toast({
			title: 'Success',
			text: 'Promotion deleted',
			icon: 'check',
			iconClasses: 'text-green-600'
		})
		loadPromotions()
		selectedPromotion.value = null
		isCreating.value = false
		resetForm()
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
	form.value.name = promotion.name
	// Could load full promotion details here if needed
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
	if (confirm(`Delete "${promotion.name}"? This will also delete all associated pricing rules.`)) {
		deleteResource.submit({ scheme_name: promotion.name })
	}
}

function handleSubmit() {
	// Validate
	if (!form.value.name) {
		toast({
			title: 'Validation Error',
			text: 'Please enter a promotion name',
			icon: 'alert-circle',
			iconClasses: 'text-orange-600'
		})
		return
	}

	if (form.value.apply_on !== 'Transaction' && form.value.items.length === 0) {
		toast({
			title: 'Validation Error',
			text: `Please select at least one ${form.value.apply_on}`,
			icon: 'alert-circle',
			iconClasses: 'text-orange-600'
		})
		return
	}

	loading.value = true

	if (isCreating.value) {
		savePromotionResource.reload()
	} else {
		updatePromotionResource.reload()
	}
}

function searchItems() {
	if (itemSearch.value.length > 2) {
		searchItemsResource.reload()
	}
}

function addItem(item) {
	if (!form.value.items.some(i => i.item_code === item.item_code)) {
		form.value.items.push({ item_code: item.item_code })
	}
	itemSearch.value = ''
	searchResults.value = []
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
		min_amt: 0,
		valid_from: '',
		valid_upto: ''
	}
	itemSearch.value = ''
	selectedItemGroup.value = ''
	selectedBrand.value = ''
	searchResults.value = []
}

function formatDate(dateStr) {
	if (!dateStr) return ''
	const date = new Date(dateStr)
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
