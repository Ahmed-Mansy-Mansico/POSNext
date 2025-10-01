# Frontend Architecture: Clean Architecture & SOLID Principles for POS Next

## Overview
This document details the frontend architecture for POS Next using Vue 3, Pinia, TypeScript, and clean architecture principles with SOLID implementation.

## Core Architecture Layers

### 1. Domain Layer (Business Logic)
The innermost layer containing pure business logic, completely independent of frameworks.

#### Entities
```typescript
// domain/entities/Invoice.ts
export interface InvoiceItem {
  id: string
  itemCode: string
  itemName: string
  quantity: number
  rate: number
  discount: Discount
  tax: Tax
  batch?: string
  serialNo?: string
  notes?: string
  offers?: AppliedOffer[]
}

export interface Payment {
  id: string
  method: PaymentMethod
  amount: number
  reference?: string
  account?: string
}

export class Invoice {
  private items: InvoiceItem[] = []
  private payments: Payment[] = []
  private customer?: Customer
  private status: InvoiceStatus = 'draft'

  constructor(
    private readonly id: string,
    private readonly posProfile: string
  ) {}

  addItem(item: InvoiceItem): void {
    this.validateItem(item)
    this.items.push(item)
    this.recalculate()
  }

  removeItem(itemId: string): void {
    this.items = this.items.filter(i => i.id !== itemId)
    this.recalculate()
  }

  applyDiscount(discount: Discount): void {
    this.validateDiscount(discount)
    // Apply discount logic
  }

  get total(): number {
    return this.items.reduce((sum, item) => {
      return sum + this.calculateItemTotal(item)
    }, 0)
  }

  get taxAmount(): number {
    return this.items.reduce((sum, item) => {
      return sum + this.calculateItemTax(item)
    }, 0)
  }

  get grandTotal(): number {
    return this.total + this.taxAmount - this.discountAmount
  }

  canSubmit(): boolean {
    return this.isValid() && this.isPaymentComplete()
  }

  private calculateItemTotal(item: InvoiceItem): number {
    const baseAmount = item.quantity * item.rate
    return baseAmount - this.calculateItemDiscount(item)
  }

  private isPaymentComplete(): boolean {
    const totalPaid = this.payments.reduce((sum, p) => sum + p.amount, 0)
    return totalPaid >= this.grandTotal
  }
}
```

#### Value Objects
```typescript
// domain/valueObjects/Money.ts
export class Money {
  constructor(
    private readonly amount: number,
    private readonly currency: string
  ) {
    if (amount < 0) {
      throw new Error('Amount cannot be negative')
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.amount + other.amount, this.currency)
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency)
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error('Cannot operate on different currencies')
    }
  }
}

// domain/valueObjects/Discount.ts
export class Discount {
  constructor(
    private readonly type: 'percentage' | 'amount',
    private readonly value: number,
    private readonly maxAmount?: number
  ) {
    this.validate()
  }

  calculate(baseAmount: number): number {
    if (this.type === 'percentage') {
      const discount = baseAmount * (this.value / 100)
      return this.maxAmount ? Math.min(discount, this.maxAmount) : discount
    }
    return this.value
  }

  private validate(): void {
    if (this.type === 'percentage' && (this.value < 0 || this.value > 100)) {
      throw new Error('Percentage must be between 0 and 100')
    }
    if (this.value < 0) {
      throw new Error('Discount value cannot be negative')
    }
  }
}
```

#### Use Cases
```typescript
// domain/useCases/CreateInvoiceUseCase.ts
export interface CreateInvoiceInput {
  customerId?: string
  items: InvoiceItemInput[]
  posProfile: string
  openingShift?: string
}

export interface CreateInvoiceOutput {
  invoice: Invoice
  warnings: string[]
}

export class CreateInvoiceUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private stockValidator: IStockValidator,
    private priceCalculator: IPriceCalculator
  ) {}

  async execute(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
    // Validate input
    this.validateInput(input)

    // Create invoice
    const invoice = new Invoice(
      generateId(),
      input.posProfile
    )

    // Set customer if provided
    if (input.customerId) {
      const customer = await this.customerRepository.findById(input.customerId)
      invoice.setCustomer(customer)
    }

    // Add items with validation
    const warnings: string[] = []
    for (const itemInput of input.items) {
      try {
        // Validate stock
        const stockStatus = await this.stockValidator.validate(
          itemInput.itemCode,
          itemInput.quantity
        )

        if (!stockStatus.available) {
          warnings.push(`Low stock for ${itemInput.itemCode}`)
        }

        // Calculate price
        const price = await this.priceCalculator.calculate(
          itemInput.itemCode,
          input.customerId
        )

        // Add item to invoice
        invoice.addItem({
          ...itemInput,
          rate: price.rate,
          tax: price.tax
        })
      } catch (error) {
        warnings.push(`Failed to add ${itemInput.itemCode}: ${error.message}`)
      }
    }

    // Save invoice
    await this.invoiceRepository.save(invoice)

    return { invoice, warnings }
  }

  private validateInput(input: CreateInvoiceInput): void {
    if (!input.items || input.items.length === 0) {
      throw new Error('Invoice must have at least one item')
    }
    // Additional validations
  }
}

// domain/useCases/ProcessPaymentUseCase.ts
export class ProcessPaymentUseCase {
  constructor(
    private paymentGateway: IPaymentGateway,
    private invoiceRepository: IInvoiceRepository
  ) {}

  async execute(invoiceId: string, payment: PaymentInput): Promise<PaymentResult> {
    // Get invoice
    const invoice = await this.invoiceRepository.findById(invoiceId)

    if (!invoice) {
      throw new Error('Invoice not found')
    }

    // Validate payment amount
    const remainingAmount = invoice.grandTotal - invoice.paidAmount
    if (payment.amount > remainingAmount) {
      throw new Error('Payment exceeds invoice amount')
    }

    // Process payment through gateway
    const result = await this.paymentGateway.process({
      method: payment.method,
      amount: payment.amount,
      reference: invoice.id
    })

    if (result.success) {
      // Add payment to invoice
      invoice.addPayment({
        method: payment.method,
        amount: payment.amount,
        reference: result.transactionId
      })

      // Update invoice
      await this.invoiceRepository.update(invoice)
    }

    return result
  }
}
```

### 2. Application Layer
Orchestrates the flow of data and coordinates use cases.

#### Application Services
```typescript
// application/services/InvoiceService.ts
export class InvoiceService {
  constructor(
    private createInvoiceUseCase: CreateInvoiceUseCase,
    private processPaymentUseCase: ProcessPaymentUseCase,
    private applyDiscountUseCase: ApplyDiscountUseCase,
    private eventBus: IEventBus
  ) {}

  async createInvoice(data: CreateInvoiceDTO): Promise<InvoiceDTO> {
    try {
      // Execute use case
      const result = await this.createInvoiceUseCase.execute(data)

      // Emit event
      this.eventBus.emit('invoice.created', {
        invoiceId: result.invoice.id,
        customerId: data.customerId
      })

      // Return DTO
      return this.toDTO(result.invoice)
    } catch (error) {
      this.handleError(error)
    }
  }

  async processPayment(invoiceId: string, payment: PaymentDTO): Promise<PaymentResultDTO> {
    const result = await this.processPaymentUseCase.execute(invoiceId, payment)

    if (result.success) {
      this.eventBus.emit('payment.processed', {
        invoiceId,
        amount: payment.amount,
        method: payment.method
      })
    }

    return result
  }

  private toDTO(invoice: Invoice): InvoiceDTO {
    return {
      id: invoice.id,
      items: invoice.items.map(this.itemToDTO),
      total: invoice.total,
      taxAmount: invoice.taxAmount,
      grandTotal: invoice.grandTotal,
      status: invoice.status
    }
  }
}

// application/services/OfferService.ts
export class OfferService {
  constructor(
    private offerEngine: IOfferEngine,
    private couponValidator: ICouponValidator
  ) {}

  async applyOffers(invoice: Invoice): Promise<AppliedOffer[]> {
    // Get applicable offers
    const offers = await this.offerEngine.getApplicableOffers(invoice)

    // Apply offers in priority order
    const applied: AppliedOffer[] = []
    for (const offer of offers) {
      if (this.canApplyOffer(offer, invoice, applied)) {
        const result = await this.applyOffer(offer, invoice)
        applied.push(result)
      }
    }

    return applied
  }

  async validateCoupon(code: string, invoice: Invoice): Promise<CouponValidation> {
    return await this.couponValidator.validate(code, invoice)
  }
}
```

### 3. Infrastructure Layer
Implements external dependencies and framework-specific code.

#### API Implementation
```typescript
// infrastructure/api/FrappeAPIService.ts
import axios, { AxiosInstance } from 'axios'

export class FrappeAPIService {
  private client: AxiosInstance

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response.data,
      async (error) => {
        if (error.response?.status === 401) {
          await this.refreshToken()
          return this.client.request(error.config)
        }
        return Promise.reject(error)
      }
    )
  }

  async get<T>(endpoint: string, params?: any): Promise<T> {
    return await this.client.get(endpoint, { params })
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return await this.client.post(endpoint, data)
  }
}

// infrastructure/api/endpoints/InvoiceAPI.ts
export class InvoiceAPI {
  constructor(private api: FrappeAPIService) {}

  async create(invoice: CreateInvoiceRequest): Promise<InvoiceResponse> {
    return await this.api.post('/api/v1/invoices', invoice)
  }

  async get(id: string): Promise<InvoiceResponse> {
    return await this.api.get(`/api/v1/invoices/${id}`)
  }

  async submit(id: string): Promise<void> {
    return await this.api.post(`/api/v1/invoices/${id}/submit`, {})
  }
}
```

#### Repository Implementations
```typescript
// infrastructure/repositories/InvoiceRepository.ts
export class InvoiceRepository implements IInvoiceRepository {
  constructor(
    private api: InvoiceAPI,
    private cache: CacheService,
    private mapper: InvoiceMapper
  ) {}

  async findById(id: string): Promise<Invoice | null> {
    // Check cache first
    const cached = await this.cache.get(`invoice:${id}`)
    if (cached) {
      return this.mapper.toDomain(cached)
    }

    // Fetch from API
    try {
      const response = await this.api.get(id)
      const invoice = this.mapper.toDomain(response)

      // Cache result
      await this.cache.set(`invoice:${id}`, response, 300)

      return invoice
    } catch (error) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  }

  async save(invoice: Invoice): Promise<void> {
    const data = this.mapper.toAPI(invoice)
    const response = await this.api.create(data)

    // Update invoice with server response
    invoice.setId(response.id)

    // Invalidate cache
    await this.cache.invalidate(`invoice:${invoice.id}`)
  }

  async update(invoice: Invoice): Promise<void> {
    const data = this.mapper.toAPI(invoice)
    await this.api.update(invoice.id, data)

    // Invalidate cache
    await this.cache.invalidate(`invoice:${invoice.id}`)
  }
}

// infrastructure/repositories/OfflineInvoiceRepository.ts
export class OfflineInvoiceRepository implements IInvoiceRepository {
  constructor(
    private db: DexieDatabase,
    private syncQueue: SyncQueue
  ) {}

  async save(invoice: Invoice): Promise<void> {
    // Save to IndexedDB
    await this.db.invoices.put(invoice)

    // Add to sync queue
    await this.syncQueue.add({
      type: 'invoice',
      action: 'create',
      data: invoice,
      timestamp: Date.now()
    })
  }

  async findById(id: string): Promise<Invoice | null> {
    return await this.db.invoices.get(id)
  }
}
```

#### Offline Support
```typescript
// infrastructure/offline/DexieDatabase.ts
import Dexie, { Table } from 'dexie'

export class DexieDatabase extends Dexie {
  invoices!: Table<Invoice>
  items!: Table<Item>
  customers!: Table<Customer>
  syncQueue!: Table<SyncItem>

  constructor() {
    super('POSDatabase')

    this.version(1).stores({
      invoices: '++id, customerId, status, createdAt',
      items: '++id, itemCode, itemName, *barcodes',
      customers: '++id, customerName, mobile, email',
      syncQueue: '++id, type, status, timestamp'
    })
  }

  async clearOldData(daysToKeep: number = 7): Promise<void> {
    const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)

    await this.transaction('rw', this.invoices, this.syncQueue, async () => {
      await this.invoices.where('createdAt').below(cutoffDate).delete()
      await this.syncQueue.where('timestamp').below(cutoffDate).delete()
    })
  }
}

// infrastructure/offline/SyncService.ts
export class SyncService {
  private syncInProgress = false
  private syncInterval?: NodeJS.Timer

  constructor(
    private db: DexieDatabase,
    private api: FrappeAPIService,
    private eventBus: IEventBus
  ) {}

  startAutoSync(intervalMs: number = 30000): void {
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        this.sync()
      }
    }, intervalMs)
  }

  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return { success: false, message: 'Sync already in progress' }
    }

    this.syncInProgress = true
    this.eventBus.emit('sync.started')

    try {
      const pendingItems = await this.db.syncQueue
        .where('status')
        .equals('pending')
        .toArray()

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as SyncError[]
      }

      for (const item of pendingItems) {
        try {
          await this.syncItem(item)
          await this.db.syncQueue.update(item.id, { status: 'synced' })
          results.successful++
        } catch (error) {
          await this.db.syncQueue.update(item.id, {
            status: 'failed',
            error: error.message,
            retryCount: (item.retryCount || 0) + 1
          })
          results.failed++
          results.errors.push({ item, error })
        }
      }

      this.eventBus.emit('sync.completed', results)
      return { success: true, results }
    } finally {
      this.syncInProgress = false
    }
  }

  private async syncItem(item: SyncItem): Promise<void> {
    switch (item.type) {
      case 'invoice':
        await this.syncInvoice(item)
        break
      case 'customer':
        await this.syncCustomer(item)
        break
      default:
        throw new Error(`Unknown sync type: ${item.type}`)
    }
  }
}
```

### 4. Presentation Layer
Vue 3 components, composables, and Pinia stores.

#### Pinia Stores
```typescript
// presentation/stores/invoiceStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useInvoiceStore = defineStore('invoice', () => {
  // State
  const currentInvoice = ref<Invoice | null>(null)
  const items = ref<InvoiceItem[]>([])
  const customer = ref<Customer | null>(null)
  const payments = ref<Payment[]>([])
  const appliedOffers = ref<AppliedOffer[]>([])

  // Services
  const invoiceService = inject<InvoiceService>('invoiceService')
  const offerService = inject<OfferService>('offerService')

  // Getters
  const subtotal = computed(() =>
    items.value.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
  )

  const discountAmount = computed(() =>
    items.value.reduce((sum, item) => sum + item.discountAmount, 0)
  )

  const taxAmount = computed(() =>
    items.value.reduce((sum, item) => sum + item.taxAmount, 0)
  )

  const grandTotal = computed(() =>
    subtotal.value - discountAmount.value + taxAmount.value
  )

  const remainingAmount = computed(() => {
    const paid = payments.value.reduce((sum, p) => sum + p.amount, 0)
    return grandTotal.value - paid
  })

  const canSubmit = computed(() =>
    items.value.length > 0 && remainingAmount.value <= 0
  )

  // Actions
  async function addItem(itemCode: string, quantity: number = 1) {
    const item = await itemService.getItem(itemCode)

    if (!item) {
      throw new Error('Item not found')
    }

    // Check if item already exists
    const existingItem = items.value.find(i => i.itemCode === itemCode)

    if (existingItem) {
      existingItem.quantity += quantity
    } else {
      items.value.push({
        id: generateId(),
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity,
        rate: item.rate,
        discountAmount: 0,
        taxAmount: calculateTax(item)
      })
    }

    // Apply automatic offers
    await applyOffers()
  }

  async function removeItem(itemId: string) {
    items.value = items.value.filter(i => i.id !== itemId)
    await applyOffers()
  }

  async function updateQuantity(itemId: string, quantity: number) {
    const item = items.value.find(i => i.id === itemId)
    if (item) {
      item.quantity = quantity
      await applyOffers()
    }
  }

  async function applyDiscount(itemId: string, discount: Discount) {
    const item = items.value.find(i => i.id === itemId)
    if (item) {
      item.discountAmount = discount.calculate(item.quantity * item.rate)
    }
  }

  async function applyOffers() {
    const invoice = createInvoiceFromState()
    appliedOffers.value = await offerService.applyOffers(invoice)
  }

  async function applyCoupon(code: string) {
    const validation = await offerService.validateCoupon(code, createInvoiceFromState())

    if (!validation.valid) {
      throw new Error(validation.message)
    }

    appliedOffers.value.push(validation.offer)
  }

  async function processPayment(payment: PaymentInput) {
    payments.value.push({
      id: generateId(),
      method: payment.method,
      amount: payment.amount,
      reference: payment.reference
    })
  }

  async function submitInvoice() {
    if (!canSubmit.value) {
      throw new Error('Invoice cannot be submitted')
    }

    const invoice = await invoiceService.createInvoice({
      customer: customer.value?.id,
      items: items.value,
      payments: payments.value,
      offers: appliedOffers.value
    })

    currentInvoice.value = invoice
    resetState()

    return invoice
  }

  function resetState() {
    items.value = []
    customer.value = null
    payments.value = []
    appliedOffers.value = []
  }

  return {
    // State
    currentInvoice,
    items,
    customer,
    payments,
    appliedOffers,

    // Getters
    subtotal,
    discountAmount,
    taxAmount,
    grandTotal,
    remainingAmount,
    canSubmit,

    // Actions
    addItem,
    removeItem,
    updateQuantity,
    applyDiscount,
    applyOffers,
    applyCoupon,
    processPayment,
    submitInvoice,
    resetState
  }
})
```

#### Vue Composables
```typescript
// presentation/composables/useInvoice.ts
import { ref, computed, watch } from 'vue'
import { useInvoiceStore } from '@/stores/invoiceStore'
import { useNotification } from '@/composables/useNotification'

export function useInvoice() {
  const store = useInvoiceStore()
  const { notify } = useNotification()
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function addItemByBarcode(barcode: string) {
    loading.value = true
    error.value = null

    try {
      const item = await itemService.findByBarcode(barcode)
      await store.addItem(item.itemCode)
      notify.success(`Added ${item.itemName}`)
    } catch (e) {
      error.value = e
      notify.error(e.message)
    } finally {
      loading.value = false
    }
  }

  async function quickCheckout() {
    if (!store.canSubmit) {
      notify.warning('Please complete payment')
      return
    }

    loading.value = true
    try {
      const invoice = await store.submitInvoice()
      notify.success(`Invoice ${invoice.id} created`)
      await printInvoice(invoice)
    } catch (e) {
      error.value = e
      notify.error(e.message)
    } finally {
      loading.value = false
    }
  }

  // Auto-save draft
  const draftSaveDebounced = useDebounceFn(async () => {
    if (store.items.length > 0) {
      await saveDraft()
    }
  }, 5000)

  watch(() => store.items, draftSaveDebounced, { deep: true })

  return {
    loading,
    error,
    addItemByBarcode,
    quickCheckout,
    ...toRefs(store)
  }
}

// presentation/composables/useOffline.ts
export function useOffline() {
  const isOnline = ref(navigator.onLine)
  const syncStatus = ref<'idle' | 'syncing' | 'error'>('idle')
  const pendingCount = ref(0)

  const syncService = inject<SyncService>('syncService')

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    checkPendingItems()
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  async function handleOnline() {
    isOnline.value = true
    await sync()
  }

  function handleOffline() {
    isOnline.value = false
  }

  async function sync() {
    syncStatus.value = 'syncing'
    try {
      await syncService.sync()
      syncStatus.value = 'idle'
      await checkPendingItems()
    } catch (error) {
      syncStatus.value = 'error'
    }
  }

  async function checkPendingItems() {
    pendingCount.value = await syncService.getPendingCount()
  }

  return {
    isOnline: readonly(isOnline),
    syncStatus: readonly(syncStatus),
    pendingCount: readonly(pendingCount),
    sync
  }
}
```

#### Vue Components
```typescript
// presentation/components/invoice/InvoiceCart.vue
<template>
  <div class="invoice-cart">
    <!-- Header -->
    <div class="cart-header">
      <h3 class="text-lg font-semibold">Cart</h3>
      <Badge v-if="items.length" :label="items.length.toString()" />
    </div>

    <!-- Items -->
    <div class="cart-items">
      <TransitionGroup name="cart-item">
        <CartItem
          v-for="item in items"
          :key="item.id"
          :item="item"
          @update="updateItem"
          @remove="removeItem(item.id)"
        />
      </TransitionGroup>

      <EmptyState v-if="!items.length" message="No items in cart" />
    </div>

    <!-- Summary -->
    <div class="cart-summary">
      <SummaryRow label="Subtotal" :value="formatCurrency(subtotal)" />
      <SummaryRow
        v-if="discountAmount > 0"
        label="Discount"
        :value="`-${formatCurrency(discountAmount)}`"
        class="text-green-600"
      />
      <SummaryRow label="Tax" :value="formatCurrency(taxAmount)" />
      <Divider />
      <SummaryRow
        label="Grand Total"
        :value="formatCurrency(grandTotal)"
        class="text-xl font-bold"
      />
    </div>

    <!-- Actions -->
    <div class="cart-actions">
      <Button
        variant="outline"
        @click="clearCart"
        :disabled="!items.length"
      >
        Clear
      </Button>
      <Button
        variant="solid"
        @click="proceedToPayment"
        :disabled="!items.length"
      >
        Pay {{ formatCurrency(grandTotal) }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useInvoiceStore } from '@/stores/invoiceStore'
import { useRouter } from 'vue-router'
import { formatCurrency } from '@/utils/formatters'

const store = useInvoiceStore()
const router = useRouter()

const {
  items,
  subtotal,
  discountAmount,
  taxAmount,
  grandTotal
} = storeToRefs(store)

function updateItem(itemId: string, updates: Partial<InvoiceItem>) {
  store.updateItem(itemId, updates)
}

function removeItem(itemId: string) {
  store.removeItem(itemId)
}

function clearCart() {
  if (confirm('Clear all items from cart?')) {
    store.resetState()
  }
}

function proceedToPayment() {
  router.push('/payment')
}
</script>

// presentation/components/items/ItemGrid.vue
<template>
  <div class="item-grid">
    <!-- Search -->
    <ItemSearch v-model="searchQuery" @barcode="handleBarcode" />

    <!-- Filters -->
    <ItemFilters v-model="filters" />

    <!-- Grid -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <ItemCard
        v-for="item in filteredItems"
        :key="item.itemCode"
        :item="item"
        @click="addToCart(item)"
      />
    </div>

    <!-- Virtual Scroller for large lists -->
    <VirtualList
      v-if="filteredItems.length > 100"
      :items="filteredItems"
      :item-height="200"
      v-slot="{ item }"
    >
      <ItemCard :item="item" @click="addToCart(item)" />
    </VirtualList>

    <!-- Pagination -->
    <Pagination
      v-model="currentPage"
      :total="totalItems"
      :per-page="itemsPerPage"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useItemStore } from '@/stores/itemStore'
import { useInvoiceStore } from '@/stores/invoiceStore'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'

const itemStore = useItemStore()
const invoiceStore = useInvoiceStore()

const searchQuery = ref('')
const filters = ref({
  category: null,
  brand: null,
  inStock: false
})

const currentPage = ref(1)
const itemsPerPage = 20

const filteredItems = computed(() => {
  let items = itemStore.items

  // Apply search
  if (searchQuery.value) {
    items = items.filter(item =>
      item.itemName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.itemCode.includes(searchQuery.value)
    )
  }

  // Apply filters
  if (filters.value.category) {
    items = items.filter(item => item.category === filters.value.category)
  }

  if (filters.value.inStock) {
    items = items.filter(item => item.stock > 0)
  }

  return items
})

function handleBarcode(barcode: string) {
  invoiceStore.addItemByBarcode(barcode)
}

function addToCart(item: Item) {
  invoiceStore.addItem(item.itemCode)
}
</script>
```

## Design Patterns Implementation

### 1. Strategy Pattern for Payments
```typescript
// Payment Strategy
interface PaymentStrategy {
  process(amount: Money): Promise<PaymentResult>
  validate(amount: Money): boolean
  getTransactionFee(): number
}

class CashPaymentStrategy implements PaymentStrategy {
  async process(amount: Money): Promise<PaymentResult> {
    // Cash payment logic
    return { success: true, reference: generateReference() }
  }

  validate(amount: Money): boolean {
    return amount.value > 0
  }

  getTransactionFee(): number {
    return 0
  }
}

class CardPaymentStrategy implements PaymentStrategy {
  constructor(private gateway: CardPaymentGateway) {}

  async process(amount: Money): Promise<PaymentResult> {
    return await this.gateway.chargeCard(amount)
  }

  validate(amount: Money): boolean {
    return amount.value >= 10 // Minimum card payment
  }

  getTransactionFee(): number {
    return 0.029 // 2.9% fee
  }
}

class PaymentProcessor {
  private strategy: PaymentStrategy

  setStrategy(strategy: PaymentStrategy) {
    this.strategy = strategy
  }

  async process(amount: Money): Promise<PaymentResult> {
    if (!this.strategy.validate(amount)) {
      throw new Error('Invalid payment amount')
    }

    const fee = amount.value * this.strategy.getTransactionFee()
    const totalAmount = new Money(amount.value + fee, amount.currency)

    return await this.strategy.process(totalAmount)
  }
}
```

### 2. Observer Pattern for Real-time Updates
```typescript
// Event Bus Implementation
class EventBus implements IEventBus {
  private events: Map<string, Set<EventHandler>> = new Map()

  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set())
    }
    this.events.get(event)!.add(handler)
  }

  off(event: string, handler: EventHandler): void {
    this.events.get(event)?.delete(handler)
  }

  emit(event: string, data?: any): void {
    this.events.get(event)?.forEach(handler => handler(data))
  }
}

// Usage in components
const eventBus = inject<IEventBus>('eventBus')

eventBus.on('invoice.updated', (invoice) => {
  // Update UI
})

eventBus.on('stock.low', (item) => {
  notify.warning(`Low stock for ${item.name}`)
})
```

### 3. Factory Pattern for Entity Creation
```typescript
class InvoiceFactory {
  static create(type: 'sales' | 'pos' | 'return', data: InvoiceData): Invoice {
    switch (type) {
      case 'sales':
        return new SalesInvoice(data)
      case 'pos':
        return new POSInvoice(data)
      case 'return':
        return new ReturnInvoice(data)
      default:
        throw new Error(`Unknown invoice type: ${type}`)
    }
  }
}

class ItemFactory {
  static create(data: ItemData): Item {
    if (data.hasVariants) {
      return new VariantItem(data)
    }
    if (data.isBundle) {
      return new BundleItem(data)
    }
    return new StandardItem(data)
  }
}
```

### 4. Decorator Pattern for Features
```typescript
// Base Invoice
interface IInvoice {
  calculate(): number
}

// Concrete Invoice
class BasicInvoice implements IInvoice {
  constructor(private items: InvoiceItem[]) {}

  calculate(): number {
    return this.items.reduce((sum, item) => sum + item.total, 0)
  }
}

// Decorators
class DiscountDecorator implements IInvoice {
  constructor(
    private invoice: IInvoice,
    private discount: Discount
  ) {}

  calculate(): number {
    const base = this.invoice.calculate()
    return base - this.discount.calculate(base)
  }
}

class TaxDecorator implements IInvoice {
  constructor(
    private invoice: IInvoice,
    private taxRate: number
  ) {}

  calculate(): number {
    const base = this.invoice.calculate()
    return base + (base * this.taxRate)
  }
}

// Usage
let invoice: IInvoice = new BasicInvoice(items)
invoice = new DiscountDecorator(invoice, new Discount('percentage', 10))
invoice = new TaxDecorator(invoice, 0.18)
const total = invoice.calculate()
```

### 5. Repository Pattern with Unit of Work
```typescript
// Unit of Work
class UnitOfWork {
  private newEntities: Set<Entity> = new Set()
  private dirtyEntities: Set<Entity> = new Set()
  private removedEntities: Set<Entity> = new Set()

  registerNew(entity: Entity): void {
    this.newEntities.add(entity)
  }

  registerDirty(entity: Entity): void {
    if (!this.newEntities.has(entity)) {
      this.dirtyEntities.add(entity)
    }
  }

  registerRemoved(entity: Entity): void {
    if (this.newEntities.has(entity)) {
      this.newEntities.delete(entity)
    } else {
      this.dirtyEntities.delete(entity)
      this.removedEntities.add(entity)
    }
  }

  async commit(): Promise<void> {
    try {
      // Begin transaction
      await this.beginTransaction()

      // Insert new entities
      for (const entity of this.newEntities) {
        await this.repository.insert(entity)
      }

      // Update dirty entities
      for (const entity of this.dirtyEntities) {
        await this.repository.update(entity)
      }

      // Delete removed entities
      for (const entity of this.removedEntities) {
        await this.repository.delete(entity)
      }

      // Commit transaction
      await this.commitTransaction()

      // Clear tracking
      this.clear()
    } catch (error) {
      await this.rollbackTransaction()
      throw error
    }
  }

  private clear(): void {
    this.newEntities.clear()
    this.dirtyEntities.clear()
    this.removedEntities.clear()
  }
}
```

## Testing Architecture

### Unit Tests
```typescript
// domain/entities/Invoice.spec.ts
describe('Invoice', () => {
  let invoice: Invoice

  beforeEach(() => {
    invoice = new Invoice('INV001', 'POS001')
  })

  describe('addItem', () => {
    it('should add item to invoice', () => {
      const item = createMockItem()
      invoice.addItem(item)
      expect(invoice.items).toContain(item)
    })

    it('should recalculate totals after adding item', () => {
      const item = createMockItem({ rate: 100, quantity: 2 })
      invoice.addItem(item)
      expect(invoice.total).toBe(200)
    })

    it('should throw error for invalid item', () => {
      const invalidItem = createMockItem({ quantity: -1 })
      expect(() => invoice.addItem(invalidItem)).toThrow()
    })
  })

  describe('applyDiscount', () => {
    it('should apply percentage discount', () => {
      invoice.addItem(createMockItem({ rate: 100, quantity: 1 }))
      invoice.applyDiscount(new Discount('percentage', 10))
      expect(invoice.discountAmount).toBe(10)
      expect(invoice.grandTotal).toBe(90)
    })
  })
})

// application/services/InvoiceService.spec.ts
describe('InvoiceService', () => {
  let service: InvoiceService
  let mockRepository: jest.Mocked<IInvoiceRepository>
  let mockEventBus: jest.Mocked<IEventBus>

  beforeEach(() => {
    mockRepository = createMockRepository()
    mockEventBus = createMockEventBus()
    service = new InvoiceService(mockRepository, mockEventBus)
  })

  describe('createInvoice', () => {
    it('should create invoice and emit event', async () => {
      const data = createMockInvoiceData()
      const result = await service.createInvoice(data)

      expect(mockRepository.save).toHaveBeenCalled()
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'invoice.created',
        expect.any(Object)
      )
      expect(result).toBeDefined()
    })
  })
})
```

### Integration Tests
```typescript
// tests/integration/invoice-flow.spec.ts
describe('Invoice Flow Integration', () => {
  let app: App
  let store: ReturnType<typeof useInvoiceStore>

  beforeEach(() => {
    app = createApp(POSApp)
    const pinia = createPinia()
    app.use(pinia)
    store = useInvoiceStore()
  })

  it('should complete full invoice flow', async () => {
    // Add items
    await store.addItem('ITEM001', 2)
    await store.addItem('ITEM002', 1)

    expect(store.items).toHaveLength(2)
    expect(store.grandTotal).toBeGreaterThan(0)

    // Apply discount
    await store.applyDiscount(store.items[0].id, new Discount('percentage', 10))

    // Process payment
    await store.processPayment({
      method: 'cash',
      amount: store.grandTotal
    })

    expect(store.canSubmit).toBe(true)

    // Submit invoice
    const invoice = await store.submitInvoice()

    expect(invoice).toBeDefined()
    expect(invoice.status).toBe('submitted')
    expect(store.items).toHaveLength(0) // State should be reset
  })
})
```

### E2E Tests
```typescript
// tests/e2e/pos-transaction.spec.ts
import { test, expect } from '@playwright/test'

test.describe('POS Transaction', () => {
  test('should complete a sale', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // Navigate to POS
    await page.goto('/pos')

    // Search and add item
    await page.fill('[placeholder="Search items..."]', 'Coffee')
    await page.click('.item-card:first-child')

    // Verify cart
    await expect(page.locator('.cart-items')).toContainText('Coffee')

    // Proceed to payment
    await page.click('button:has-text("Pay")')

    // Select payment method
    await page.click('button:has-text("Cash")')

    // Complete transaction
    await page.click('button:has-text("Complete Sale")')

    // Verify success
    await expect(page.locator('.notification')).toContainText('Invoice created')
  })
})
```

## Performance Optimization

### Code Splitting
```typescript
// router/index.ts
const routes = [
  {
    path: '/pos',
    component: () => import('@/pages/POS.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/reports',
    component: () => import('@/pages/Reports.vue'),
    meta: { requiresAuth: true }
  }
]
```

### Virtual Scrolling
```typescript
// components/VirtualList.vue
<template>
  <div
    ref="viewport"
    class="virtual-list-viewport"
    @scroll="onScroll"
  >
    <div
      class="virtual-list-spacer"
      :style="{ height: totalHeight + 'px' }"
    />
    <div
      class="virtual-list-content"
      :style="{ transform: `translateY(${offset}px)` }"
    >
      <div
        v-for="item in visibleItems"
        :key="item.id"
        class="virtual-list-item"
      >
        <slot :item="item" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVirtualList } from '@/composables/useVirtualList'

const props = defineProps<{
  items: any[]
  itemHeight: number
  buffer: number
}>()

const { visibleItems, totalHeight, offset, onScroll } = useVirtualList(
  props.items,
  props.itemHeight,
  props.buffer
)
</script>
```

### Web Workers
```typescript
// workers/invoice-calculator.worker.ts
self.addEventListener('message', (event) => {
  const { type, data } = event.data

  switch (type) {
    case 'CALCULATE_INVOICE':
      const result = calculateInvoiceTotals(data)
      self.postMessage({ type: 'INVOICE_CALCULATED', data: result })
      break
  }
})

function calculateInvoiceTotals(invoice: InvoiceData) {
  // Heavy calculations
  return {
    subtotal,
    tax,
    discount,
    grandTotal
  }
}

// Usage in component
const worker = new Worker('/workers/invoice-calculator.worker.js')

worker.postMessage({
  type: 'CALCULATE_INVOICE',
  data: invoiceData
})

worker.addEventListener('message', (event) => {
  if (event.data.type === 'INVOICE_CALCULATED') {
    updateTotals(event.data.data)
  }
})
```

## Security Considerations

### Input Validation
```typescript
// utils/validators.ts
import { z } from 'zod'

export const InvoiceItemSchema = z.object({
  itemCode: z.string().min(1).max(50),
  quantity: z.number().positive().max(9999),
  rate: z.number().positive().max(999999),
  discount: z.number().min(0).max(100).optional()
})

export const PaymentSchema = z.object({
  method: z.enum(['cash', 'card', 'mobile', 'credit']),
  amount: z.number().positive(),
  reference: z.string().optional()
})

// Usage
function validateInvoiceItem(data: unknown) {
  return InvoiceItemSchema.parse(data)
}
```

### XSS Prevention
```typescript
// utils/sanitize.ts
import DOMPurify from 'dompurify'

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  })
}

// Usage in components
<template>
  <div v-html="sanitizeHTML(userContent)" />
</template>
```

## Conclusion

This frontend architecture provides:

1. **Clean Architecture** - Clear separation of concerns with distinct layers
2. **SOLID Principles** - Each component has single responsibility, open for extension
3. **Type Safety** - Full TypeScript implementation
4. **Testability** - Easy to test with dependency injection
5. **Offline First** - Robust offline support with sync
6. **Performance** - Optimized with code splitting, virtual scrolling, workers
7. **Security** - Input validation, XSS prevention
8. **Maintainability** - Clear structure, patterns, and documentation

The architecture is scalable, maintainable, and follows industry best practices for modern Vue 3 applications.