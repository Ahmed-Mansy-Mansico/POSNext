<template>
  <Dialog v-model="open" :options="{ title: 'Close POS Shift', size: 'xl' }">
    <template #body-content>
      <div class="space-y-6">
        <div v-if="closingDataResource.loading" class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p class="mt-4 text-sm text-gray-600">Loading shift data...</p>
        </div>

        <div v-else-if="closingData" class="space-y-6">
          <!-- Shift Summary -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="font-medium text-gray-900 mb-3">Shift Summary</h3>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-gray-500">POS Profile</p>
                <p class="font-medium">{{ closingData.pos_profile }}</p>
              </div>
              <div>
                <p class="text-gray-500">Period Start</p>
                <p class="font-medium">{{ formatDateTime(closingData.period_start_date) }}</p>
              </div>
              <div>
                <p class="text-gray-500">Total Invoices</p>
                <p class="font-medium">{{ closingData.payment_reconciliation?.length || 0 }}</p>
              </div>
              <div>
                <p class="text-gray-500">Grand Total</p>
                <p class="font-medium text-green-600">{{ formatCurrency(closingData.grand_total) }}</p>
              </div>
            </div>
          </div>

          <!-- Payment Reconciliation -->
          <div>
            <h3 class="font-medium text-gray-900 mb-3">Payment Reconciliation</h3>
            <div class="space-y-3">
              <div
                v-for="(payment, idx) in closingData.payment_reconciliation"
                :key="idx"
                class="border rounded-lg p-4"
              >
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <h4 class="font-medium text-gray-900">{{ payment.mode_of_payment }}</h4>
                    <p class="text-sm text-gray-500">Expected: {{ formatCurrency(payment.expected_amount) }}</p>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">Opening Amount</label>
                    <Input
                      :model-value="payment.opening_amount"
                      type="number"
                      disabled
                      class="bg-gray-50"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">Expected Amount</label>
                    <Input
                      :model-value="payment.expected_amount"
                      type="number"
                      disabled
                      class="bg-gray-50"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">Closing Amount *</label>
                    <Input
                      v-model="payment.closing_amount"
                      type="number"
                      step="0.01"
                      placeholder="Enter actual amount"
                      @input="calculateDifference(payment)"
                    />
                  </div>
                </div>

                <div v-if="payment.difference !== 0" class="mt-2">
                  <p :class="[
                    'text-sm font-medium',
                    payment.difference > 0 ? 'text-green-600' : 'text-red-600'
                  ]">
                    Difference: {{ formatCurrency(payment.difference) }}
                    {{ payment.difference > 0 ? '(Excess)' : '(Shortage)' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Taxes Summary (if available) -->
          <div v-if="closingData.taxes && closingData.taxes.length > 0">
            <h3 class="font-medium text-gray-900 mb-3">Taxes Collected</h3>
            <div class="border rounded-lg overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="(tax, idx) in closingData.taxes" :key="idx">
                    <td class="px-4 py-2 text-sm text-gray-900">{{ tax.account_head }}</td>
                    <td class="px-4 py-2 text-sm text-gray-900 text-right">{{ formatCurrency(tax.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="submitResource.error" class="rounded-md bg-red-50 p-4">
            <p class="text-sm text-red-800">{{ submitResource.error }}</p>
          </div>
        </div>

        <div v-else-if="closingDataResource.error" class="rounded-md bg-red-50 p-4">
          <p class="text-sm text-red-800">{{ closingDataResource.error }}</p>
        </div>
      </div>
    </template>

    <template #actions>
      <div class="flex justify-between w-full">
        <div></div>
        <div class="flex space-x-2">
          <Button variant="subtle" @click="closeDialog" :disabled="submitResource.loading">
            Cancel
          </Button>
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
        // Set closing_amount to expected_amount as default
        if (payment.closing_amount === null || payment.closing_amount === undefined) {
          payment.closing_amount = payment.expected_amount || 0
        }
        // Recalculate difference
        calculateDifference(payment)
      })
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
    payment => payment.closing_amount !== null && payment.closing_amount !== undefined
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
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return "0.00"
  return parseFloat(amount).toFixed(2)
}

function formatDateTime(datetime) {
  if (!datetime) return ""
  return new Date(datetime).toLocaleString()
}
</script>
