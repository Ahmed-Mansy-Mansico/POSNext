<template>
  <Dialog v-model="open" :options="{ title: 'Close POS Shift', size: '4xl' }">
    <template #body-content>
      <div class="space-y-6">
        <div v-if="closingDataResource.loading" class="text-center py-12">
          <div class="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          <p class="mt-4 text-lg font-medium text-gray-600">Loading shift data...</p>
          <p class="text-sm text-gray-500">Calculating totals and reconciliation...</p>
        </div>

        <div v-else-if="closingData" class="space-y-6">
          <!-- Shift Summary Header -->
          <div class="bg-white border border-gray-200 rounded-lg p-6 shadow">
            <div class="flex justify-between items-start mb-6">
              <div>
                <h3 class="text-base font-medium text-gray-900">{{ closingData.pos_profile }}</h3>
                <p class="text-sm text-gray-500 mt-1">{{ formatDateTime(closingData.period_start_date) }}</p>
              </div>
              <div class="text-right">
                <div class="text-xs text-gray-500 uppercase">Duration</div>
                <div class="text-lg font-semibold text-gray-900">{{ getShiftDuration() }}</div>
              </div>
            </div>

            <!-- Key Metrics Grid -->
            <div class="grid grid-cols-4 gap-4">
              <!-- Total Sales -->
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="text-blue-600 text-xs uppercase font-medium mb-1">Total Sales</div>
                <div class="text-2xl font-bold text-blue-900 mb-1">{{ formatCurrency(closingData.grand_total) }}</div>
                <div class="text-blue-600 text-xs">{{ getInvoiceCount() }} invoices</div>
              </div>

              <!-- Net Amount -->
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div class="text-gray-600 text-xs uppercase font-medium mb-1">Net Amount</div>
                <div class="text-2xl font-bold text-gray-900 mb-1">{{ formatCurrency(closingData.net_total) }}</div>
                <div class="text-gray-600 text-xs">Before tax</div>
              </div>

              <!-- Items Sold -->
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div class="text-gray-600 text-xs uppercase font-medium mb-1">Items Sold</div>
                <div class="text-2xl font-bold text-gray-900 mb-1">{{ closingData.total_quantity || 0 }}</div>
                <div class="text-gray-600 text-xs">Total items</div>
              </div>

              <!-- Tax Collected -->
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div class="text-gray-600 text-xs uppercase font-medium mb-1">Tax Collected</div>
                <div class="text-2xl font-bold text-gray-900 mb-1">{{ formatCurrency(getTotalTax()) }}</div>
                <div class="text-gray-600 text-xs">Total tax</div>
              </div>
            </div>
          </div>

          <!-- No Sales Warning -->
          <div v-if="getInvoiceCount() === 0" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-yellow-900">No Sales During This Shift</h3>
                <p class="text-sm text-yellow-700 mt-2">
                  No invoices were created during this shift. Your closing amounts should match your opening amounts.
                </p>
              </div>
            </div>
          </div>

          <!-- Invoice Details (Collapsible) -->
          <div v-if="getInvoiceCount() > 0" class="bg-white border border-gray-200 rounded-lg overflow-hidden shadow">
            <button
              @click="showInvoiceDetails = !showInvoiceDetails"
              class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div class="text-left">
                <h3 class="text-lg font-medium text-gray-900">Invoice Details</h3>
                <p class="text-sm text-gray-500">{{ getInvoiceCount() }} transactions • {{ formatCurrency(closingData.grand_total) }}</p>
              </div>
              <svg
                :class="['h-5 w-5 text-gray-400 transition-transform', showInvoiceDetails ? 'transform rotate-180' : '']"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div v-show="showInvoiceDetails" class="border-t border-gray-200">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="(invoice, idx) in closingData.pos_transactions" :key="idx" class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class="text-sm font-medium text-gray-900">
                          {{ invoice.pos_invoice || invoice.sales_invoice || 'N/A' }}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {{ invoice.customer }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{ formatTime(invoice.posting_date) }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-right">
                        <span class="text-sm font-semibold text-gray-900">
                          {{ formatCurrency(invoice.grand_total) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot class="bg-gray-50">
                    <tr>
                      <td colspan="3" class="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                        Total:
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-right">
                        <span class="text-base font-bold text-gray-900">
                          {{ formatCurrency(closingData.grand_total) }}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <!-- Payment Reconciliation -->
          <div class="bg-white border border-gray-200 rounded-lg overflow-hidden shadow">
            <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">Payment Reconciliation</h3>
                  <p class="text-sm text-gray-600">Count your cash and enter actual amounts below</p>
                </div>
                <div v-if="getTotalDifference() !== 0" class="text-right">
                  <div class="text-xs text-gray-500 uppercase">Total Variance</div>
                  <div :class="[
                    'text-xl font-bold',
                    getTotalDifference() > 0 ? 'text-blue-600' : 'text-red-600'
                  ]">
                    {{ getTotalDifference() > 0 ? '+' : '' }}{{ formatCurrency(Math.abs(getTotalDifference())) }}
                  </div>
                </div>
              </div>
            </div>

            <div class="p-6 space-y-4">
              <!-- Payment Method Cards -->
              <div
                v-for="(payment, idx) in closingData.payment_reconciliation"
                :key="idx"
                :class="[
                  'border rounded-lg p-5 transition-all',
                  payment.difference === 0 ? 'border-green-200 bg-green-50' :
                  payment.difference > 0 ? 'border-blue-200 bg-blue-50' :
                  'border-red-200 bg-red-50'
                ]"
              >
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center space-x-3">
                    <!-- Payment Method Icon -->
                    <div :class="['rounded-lg p-2', getPaymentIcon(payment.mode_of_payment).color]">
                      <span class="text-xl">{{ getPaymentIcon(payment.mode_of_payment).icon }}</span>
                    </div>
                    <div>
                      <h4 class="text-base font-semibold text-gray-900">{{ payment.mode_of_payment }}</h4>
                      <p class="text-sm text-gray-600">Expected: <span class="font-medium">{{ formatCurrency(payment.expected_amount) }}</span></p>
                    </div>
                  </div>

                  <!-- Status Badge -->
                  <div v-if="payment.closing_amount !== null && payment.closing_amount !== undefined">
                    <span v-if="payment.difference === 0" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Balanced
                    </span>
                    <span v-else-if="payment.difference > 0" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Over {{ formatCurrency(payment.difference) }}
                    </span>
                    <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Short {{ formatCurrency(Math.abs(payment.difference)) }}
                    </span>
                  </div>
                </div>

                <!-- Amount Entry Grid -->
                <div class="grid grid-cols-3 gap-3">
                  <!-- Opening Amount -->
                  <div class="bg-white rounded-lg p-3 border border-gray-200">
                    <label class="block text-xs font-medium text-gray-500 uppercase mb-1">Opening</label>
                    <div class="text-lg font-semibold text-gray-900">
                      {{ formatCurrency(payment.opening_amount) }}
                    </div>
                    <div class="text-xs text-gray-500 mt-1">Shift start</div>
                  </div>

                  <!-- Expected Amount -->
                  <div class="bg-white rounded-lg p-3 border border-gray-200">
                    <label class="block text-xs font-medium text-gray-500 uppercase mb-1">Expected</label>
                    <div class="text-lg font-semibold text-gray-900">
                      {{ formatCurrency(payment.expected_amount) }}
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      <span v-if="getSalesForPayment(payment) > 0">
                        +{{ formatCurrency(getSalesForPayment(payment)) }} sales
                      </span>
                      <span v-else>No sales</span>
                    </div>
                  </div>

                  <!-- Actual/Closing Amount -->
                  <div class="bg-white rounded-lg p-3 border border-gray-300">
                    <label class="block text-xs font-medium text-gray-700 uppercase mb-1">
                      Actual Amount *
                    </label>
                    <Input
                      v-model="payment.closing_amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      @input="calculateDifference(payment)"
                    />
                    <div class="text-xs text-gray-500 mt-1">Count & enter</div>
                  </div>
                </div>

                <!-- Difference Alert -->
                <div v-if="payment.closing_amount !== null && payment.closing_amount !== undefined && payment.difference !== 0"
                     class="mt-3 p-3 rounded-lg" :class="[
                  payment.difference > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'
                ]">
                  <div class="flex items-center justify-between">
                    <div>
                      <p :class="['text-sm font-medium', payment.difference > 0 ? 'text-blue-900' : 'text-red-900']">
                        {{ payment.difference > 0 ? 'Cash Over' : 'Cash Short' }}
                      </p>
                      <p :class="['text-xs', payment.difference > 0 ? 'text-blue-700' : 'text-red-700']">
                        {{ payment.difference > 0
                          ? 'You have more than expected.'
                          : 'You have less than expected.'
                        }}
                      </p>
                    </div>
                    <div :class="['text-xl font-bold', payment.difference > 0 ? 'text-blue-700' : 'text-red-700']">
                      {{ payment.difference > 0 ? '+' : '' }}{{ formatCurrency(payment.difference) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Reconciliation Summary -->
            <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-600">Total Expected</p>
                  <p class="text-xl font-semibold text-gray-900">{{ formatCurrency(getTotalExpected()) }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm text-gray-600">Total Actual</p>
                  <p class="text-xl font-semibold text-gray-900">{{ formatCurrency(getTotalActual()) }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm text-gray-600">Net Variance</p>
                  <p :class="[
                    'text-xl font-bold',
                    getTotalDifference() === 0 ? 'text-green-600' :
                    getTotalDifference() > 0 ? 'text-blue-600' : 'text-red-600'
                  ]">
                    {{ getTotalDifference() === 0 ? '✓ ' : getTotalDifference() > 0 ? '+' : '' }}{{ formatCurrency(Math.abs(getTotalDifference())) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Tax Summary -->
          <div v-if="closingData.taxes && closingData.taxes.length > 0" class="bg-white border border-gray-200 rounded-lg overflow-hidden shadow">
            <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 class="text-lg font-medium text-gray-900">Tax Summary</h3>
            </div>
            <div class="p-6">
              <div class="space-y-3">
                <div v-for="(tax, idx) in closingData.taxes" :key="idx" class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p class="text-sm font-medium text-gray-900">{{ tax.account_head }}</p>
                    <p class="text-xs text-gray-500">Rate: {{ tax.rate }}%</p>
                  </div>
                  <div class="text-right">
                    <p class="text-base font-semibold text-gray-900">{{ formatCurrency(tax.amount) }}</p>
                  </div>
                </div>
              </div>
              <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-700">Total Tax Collected</span>
                  <span class="text-lg font-bold text-gray-900">{{ formatCurrency(getTotalTax()) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="submitResource.error" class="rounded-lg bg-red-50 border border-red-200 p-4">
            <div class="flex">
              <svg class="h-5 w-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
              <div>
                <h4 class="text-sm font-medium text-red-800">Error Closing Shift</h4>
                <p class="text-sm text-red-700 mt-1">{{ submitResource.error }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="closingDataResource.error" class="rounded-lg bg-red-50 border border-red-200 p-4">
          <div class="flex">
            <svg class="h-5 w-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <div>
              <h3 class="text-sm font-medium text-red-800">Failed to Load Shift Data</h3>
              <p class="text-sm text-red-700 mt-1">{{ closingDataResource.error }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #actions>
      <div class="flex justify-between w-full items-center">
        <Button
          variant="subtle"
          @click="closeDialog"
          :disabled="submitResource.loading"
        >
          Cancel
        </Button>

        <div class="flex items-center space-x-3">
          <!-- Validation Warning -->
          <div v-if="!canSubmit && closingData" class="text-sm text-yellow-600 font-medium">
            Please enter all closing amounts
          </div>

          <Button
            variant="solid"
            theme="blue"
            @click="submitClosing"
            :loading="submitResource.loading"
            :disabled="!canSubmit"
          >
            {{ submitResource.loading ? 'Closing Shift...' : 'Close Shift' }}
          </Button>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from "vue"
import { Dialog, Input, Button } from "frappe-ui"
import { useShift } from "../composables/useShift"

const props = defineProps({
  modelValue: Boolean,
  openingShift: String,
})

const emit = defineEmits(["update:modelValue", "shift-closed"])

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
})

const { getClosingShiftData, submitClosingShift } = useShift()

const closingData = ref(null)
const closingDataResource = getClosingShiftData
const submitResource = submitClosingShift
const showInvoiceDetails = ref(false)

// Watch dialog open state
watch(open, (isOpen) => {
  if (isOpen && props.openingShift) {
    loadClosingData()
  }
})

async function loadClosingData() {
  try {
    const data = await closingDataResource.submit({ opening_shift: props.openingShift })
    closingData.value = data

    // Initialize closing amounts with expected amounts
    if (data.payment_reconciliation) {
      data.payment_reconciliation.forEach(payment => {
        // Set closing_amount to expected_amount as default for better UX
        if (payment.closing_amount === null || payment.closing_amount === undefined) {
          payment.closing_amount = payment.expected_amount || 0
        }
        // Calculate initial difference
        calculateDifference(payment)
      })
    }

    // Auto-expand invoice details if there are few invoices
    if (getInvoiceCount() > 0 && getInvoiceCount() <= 10) {
      showInvoiceDetails.value = true
    }
  } catch (error) {
    console.error("Error loading closing data:", error)
  }
}

function calculateDifference(payment) {
  const closing = parseFloat(payment.closing_amount) || 0
  const expected = parseFloat(payment.expected_amount) || 0
  payment.difference = closing - expected
}

const canSubmit = computed(() => {
  if (!closingData.value || !closingData.value.payment_reconciliation) return false

  // Check if all closing amounts are filled
  return closingData.value.payment_reconciliation.every(
    payment => payment.closing_amount !== null && payment.closing_amount !== undefined && payment.closing_amount !== ''
  )
})

async function submitClosing() {
  if (!closingData.value) return

  try {
    // Ensure all differences are calculated
    if (closingData.value.payment_reconciliation) {
      closingData.value.payment_reconciliation.forEach(payment => {
        calculateDifference(payment)
      })
    }

    // Submit the closing shift
    await submitResource.submit({ closing_shift: closingData.value })
    emit("shift-closed")
    closeDialog()
  } catch (error) {
    console.error("Error submitting closing shift:", error)
  }
}

function closeDialog() {
  open.value = false
  closingData.value = null
  showInvoiceDetails.value = false
}

// Formatting Functions
function formatCurrency(amount) {
  if (amount === null || amount === undefined) return "0.00"
  return parseFloat(amount).toFixed(2)
}

function formatDateTime(datetime) {
  if (!datetime) return ""
  return new Date(datetime).toLocaleString()
}

function formatTime(datetime) {
  if (!datetime) return ""
  return new Date(datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Calculation Functions
function getInvoiceCount() {
  if (!closingData.value) return 0
  const transactions = closingData.value.pos_transactions || []
  return transactions.length
}

function getTotalTax() {
  if (!closingData.value || !closingData.value.taxes) return 0
  return closingData.value.taxes.reduce((sum, tax) => sum + parseFloat(tax.amount || 0), 0)
}

function getTotalExpected() {
  if (!closingData.value || !closingData.value.payment_reconciliation) return 0
  return closingData.value.payment_reconciliation.reduce((sum, payment) =>
    sum + parseFloat(payment.expected_amount || 0), 0)
}

function getTotalActual() {
  if (!closingData.value || !closingData.value.payment_reconciliation) return 0
  return closingData.value.payment_reconciliation.reduce((sum, payment) =>
    sum + parseFloat(payment.closing_amount || 0), 0)
}

function getTotalDifference() {
  return getTotalActual() - getTotalExpected()
}

function getSalesForPayment(payment) {
  return parseFloat(payment.expected_amount || 0) - parseFloat(payment.opening_amount || 0)
}

function getShiftDuration() {
  if (!closingData.value || !closingData.value.period_start_date) return "N/A"

  const start = new Date(closingData.value.period_start_date)
  const end = new Date()
  const diff = end - start

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function getPaymentIcon(method) {
  const methodLower = method.toLowerCase()

  if (methodLower.includes('cash')) {
    return { icon: '💵', color: 'bg-green-500' }
  } else if (methodLower.includes('card') || methodLower.includes('credit') || methodLower.includes('debit')) {
    return { icon: '💳', color: 'bg-blue-500' }
  } else if (methodLower.includes('mobile') || methodLower.includes('wallet') || methodLower.includes('upi') || methodLower.includes('phone')) {
    return { icon: '📱', color: 'bg-purple-500' }
  } else if (methodLower.includes('bank') || methodLower.includes('transfer')) {
    return { icon: '🏦', color: 'bg-indigo-500' }
  } else if (methodLower.includes('cheque') || methodLower.includes('check')) {
    return { icon: '📝', color: 'bg-yellow-500' }
  } else {
    return { icon: '💰', color: 'bg-gray-500' }
  }
}
</script>

