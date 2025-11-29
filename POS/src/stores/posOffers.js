import { defineStore } from "pinia"
import { computed, ref } from "vue"

const defaultSnapshot = () => ({
	subtotal: 0,
	itemCount: 0,
	itemCodes: [],
	itemGroups: [],
	brands: [],
	items: [],
})

function getDiscountSortValue(offer) {
	const percentage = Number.parseFloat(offer?.discount_percentage) || 0
	if (percentage) {
		return percentage
	}

	return Number.parseFloat(offer?.discount_amount) || 0
}

export const usePOSOffersStore = defineStore("posOffers", () => {
	const availableOffers = ref([])
	const cartSnapshot = ref(defaultSnapshot())
	const hasFetched = ref(false)
	const customOffers = ref([])
	const exceptionItemsList = ref([])
	const exceptionItemsLoaded = ref(false)

	async function loadExceptionItems() {
		if (exceptionItemsLoaded.value) {
			return true
		}
		
		
		try {
			// ✅ Correct path for pos_next app
			const response = await fetch('/api/method/pos_next.api.pos_offers.get_exception_items', {
				method: 'GET',
				headers: {
					'Accept': 'application/json'
				},
				credentials: 'same-origin'
			})
			
			if (!response.ok) {
				const errorText = await response.text()
				console.error('API Error Response:', errorText)
				throw new Error(`HTTP error! status: ${response.status}`)
			}
			
			const data = await response.json()
			console.log('API Response:', data)
			
			// API returns {message: [...]}
			const items = data.message || []
			
			exceptionItemsList.value = items
			exceptionItemsLoaded.value = true
			
			
			// Cache for faster loads
			try {
				localStorage.setItem('pos_exception_items_cache', JSON.stringify(items))
				localStorage.setItem('pos_exception_items_timestamp', Date.now().toString())
			} catch (e) {
				console.warn('Could not cache:', e)
			}
			
			return true
			
		} catch (error) {
			console.error('❌ Error loading exception items:', error)
			exceptionItemsList.value = []
			return false
		}
	}
	
	// Check if item is exception
	function isExceptionItem(itemCode) {
		if (!itemCode) {
			console.warn(' isExceptionItem called with empty itemCode')
			return false
		}
		
		if (exceptionItemsList.value.length === 0) {
			// If no exception items loaded, treat all items as normal
			return false
		}
		
		// Normalize item codes for comparison
		const normalizedItemCode = String(itemCode).trim().toUpperCase()
		const normalizedExceptions = exceptionItemsList.value.map(code => 
			String(code).trim().toUpperCase()
		)
		// Exact match
		if (normalizedExceptions.includes(normalizedItemCode)) {
			console.log(` ${itemCode} is EXCEPTION (exact match)`)
			return true
		}
		
		const isVariant = normalizedExceptions.some(exceptionCode => {
			// Check if item code starts with exception code followed by hyphen
			return normalizedItemCode.startsWith(exceptionCode + '-')
		})
		
		if (isVariant) {
			console.log(` ${itemCode} is EXCEPTION (variant of base item)`)
			return true
		}
		
		// Not an exception
		console.log(` ${itemCode} is NORMAL item`)
		return false
	}

	function updateCartSnapshot(snapshot = {}) {
		const subtotal = Number.parseFloat(snapshot.subtotal) || 0
		const itemCount = Number.isFinite(snapshot.itemCount)
			? snapshot.itemCount
			: 0
		const itemCodes = Array.isArray(snapshot.itemCodes)
			? snapshot.itemCodes
			: []
		const itemGroups = Array.isArray(snapshot.itemGroups)
			? snapshot.itemGroups
			: []
		const brands = Array.isArray(snapshot.brands) ? snapshot.brands : []
		const items = Array.isArray(snapshot.items) ? snapshot.items : []

		cartSnapshot.value = {
			subtotal,
			itemCount,
			itemCodes,
			itemGroups,
			brands,
			items,
		}
		calculateCustomOffers()
	}

	function resetCartSnapshot() {
		cartSnapshot.value = defaultSnapshot()
		customOffers.value = []
	}

	function setAvailableOffers(offers = []) {
		if (!Array.isArray(offers)) {
			availableOffers.value = []
		} else {
			availableOffers.value = offers
		}
		hasFetched.value = true
	}

	function clearOffers() {
		availableOffers.value = []
		customOffers.value = []
		hasFetched.value = false
	}
	async function calculateCustomOffers() {
		
		const items = cartSnapshot.value.items || []
		
		if (items.length === 0) {
			customOffers.value = []
			return
		}
		
		// LAZY LOAD: Load exception items when first needed
		if (!exceptionItemsLoaded.value) {
			const loaded = await loadExceptionItems()
			if (!loaded) {
				console.warn(' Could not load exception items, continuing without them')
				// Continue anyway - all items will be treated as normal items
			}
		}

		const offers = []
		
		// Count normal (non-exception) items
		let normalItemsCount = 0
		let normalItemsCodes = []
		
		items.forEach(item => {
			const code = item.item_code
			const qty = Number(item.qty) || Number(item.quantity) || 1
			
			if (!code) return
			
			// Check if exception using the loaded list
			if (!isExceptionItem(code)) {
				normalItemsCount += qty
				normalItemsCodes.push(code)
			}
		})
		
		
		// Rest of the function stays the same...
		if (normalItemsCount >= 3) {
			const sets = Math.floor(normalItemsCount / 3)
			const remaining = normalItemsCount % 3
			const pricePerSetWithVAT = 249
			const pricePerSetNoVAT = 249 / 1.15
			
			offers.push({
				offer_type: "any3for249",
				sets: sets,
				remaining_qty: remaining,
				total_qty: normalItemsCount,
				price_per_set: pricePerSetNoVAT,
				price_per_set_with_vat: pricePerSetWithVAT,
				affected_items: [...new Set(normalItemsCodes)],
				message: `Any 3 items for 249 SAR (${sets} set${sets > 1 ? 's' : ''})`
			})
		}
		
		customOffers.value = offers
		console.log('🎉 Final offers:', offers)
	}

	function checkOfferEligibility(offer) {
		const subtotal = cartSnapshot.value.subtotal || 0
		const itemCount = cartSnapshot.value.itemCount || 0
		const cartItemCodes = cartSnapshot.value.itemCodes || []
		const cartItemGroups = cartSnapshot.value.itemGroups || []
		const cartBrands = cartSnapshot.value.brands || []

		// Check if cart is empty
		if (itemCount === 0) {
			return {
				eligible: false,
				reason: "Cart is empty",
			}
		}

		// Check minimum amount
		if (offer?.min_amt && subtotal < offer.min_amt) {
			return {
				eligible: false,
				reason: `Minimum cart value of ${offer.min_amt} required`,
			}
		}

		// Check maximum amount
		if (offer?.max_amt && subtotal > offer.max_amt) {
			return {
				eligible: false,
				reason: `Maximum cart value exceeded (${offer.max_amt})`,
			}
		}

		// Check item eligibility based on apply_on
		if (offer?.apply_on === "Item Code") {
			// Check if cart contains any of the eligible items
			const eligibleItems = offer.eligible_items || []
			if (eligibleItems.length > 0) {
				const hasEligibleItem = eligibleItems.some((item) =>
					cartItemCodes.includes(item),
				)
				if (!hasEligibleItem) {
					return {
						eligible: false,
						reason: "Cart does not contain eligible items for this offer",
					}
				}
			}
		} else if (offer?.apply_on === "Item Group") {
			// Check if cart contains items from any of the eligible groups
			const eligibleGroups = offer.eligible_item_groups || []
			if (eligibleGroups.length > 0) {
				const hasEligibleGroup = eligibleGroups.some((group) =>
					cartItemGroups.includes(group),
				)
				if (!hasEligibleGroup) {
					return {
						eligible: false,
						reason: "Cart does not contain items from eligible groups",
					}
				}
			}
		} else if (offer?.apply_on === "Brand") {
			// Check if cart contains items from any of the eligible brands
			const eligibleBrands = offer.eligible_brands || []
			if (eligibleBrands.length > 0) {
				const hasEligibleBrand = eligibleBrands.some((brand) =>
					cartBrands.includes(brand),
				)
				if (!hasEligibleBrand) {
					return {
						eligible: false,
						reason: "Cart does not contain items from eligible brands",
					}
				}
			}
		}
		// If apply_on is 'Transaction', it applies to entire cart (no item-specific check needed)

		return { eligible: true, reason: null }
	}

	const allEligibleOffers = computed(() => {
		return availableOffers.value.filter((offer) => {
			if (offer?.coupon_based) {
				return false
			}

			const eligibility = checkOfferEligibility(offer)
			return eligibility.eligible
		})
	})

	const allEligibleOffersSorted = computed(() => {
		return [...allEligibleOffers.value].sort((a, b) => {
			return getDiscountSortValue(b) - getDiscountSortValue(a)
		})
	})

	const autoEligibleOffers = computed(() => {
		return availableOffers.value.filter((offer) => {
			if (!offer?.auto || offer?.coupon_based) {
				return false
			}

			const eligibility = checkOfferEligibility(offer)
			return eligibility.eligible
		})
	})

	const autoEligibleCount = computed(() => autoEligibleOffers.value.length)
	const totalCustomDiscount = computed(() => {
	return customOffers.value.reduce((sum, offer) => sum + (offer.discount_amount || 0), 0)
	})

	const hasCustomOffers = computed(() => {
		return customOffers.value.length > 0
	})

	function getUnlockAmount(offer) {
		const subtotal = cartSnapshot.value.subtotal || 0
		if (offer?.min_amt && subtotal < offer.min_amt) {
			return offer.min_amt - subtotal
		}
		return 0
	}
	// ✅ Load from cache immediately (synchronous)
	try {
		const cached = localStorage.getItem('pos_exception_items_cache')
		const timestamp = localStorage.getItem('pos_exception_items_timestamp')
		const cacheAge = timestamp ? Date.now() - parseInt(timestamp) : Infinity
		const maxAge = 24 * 60 * 60 * 1000 // 24 hours
		
		if (cached && cacheAge < maxAge) {
			const parsed = JSON.parse(cached)
			if (parsed && Array.isArray(parsed) && parsed.length > 0) {
				exceptionItemsList.value = parsed
				exceptionItemsLoaded.value = true
			}
		}
	} catch (e) {
		console.warn('Could not load from cache:', e)
	}

	//  Refresh from server in background
	setTimeout(() => {
		console.log('🔄 Refreshing exception items from server...')
		loadExceptionItems().catch(err => {
			console.warn(' Failed to refresh exception items:', err)
		})
	}, 1000)

	return {
		// State
		availableOffers,
		cartSnapshot,
		hasFetched,
		customOffers,
		exceptionItemsList,        
		exceptionItemsLoaded,     

		// Computed
		allEligibleOffers,
		allEligibleOffersSorted,
		autoEligibleOffers,
		autoEligibleCount,
		totalCustomDiscount, 
		hasCustomOffers, 

		// Actions
		updateCartSnapshot,
		resetCartSnapshot,
		setAvailableOffers,
		clearOffers,
		checkOfferEligibility,
		getUnlockAmount,
		calculateCustomOffers,
		loadExceptionItems,        
		isExceptionItem,           
	}
})
