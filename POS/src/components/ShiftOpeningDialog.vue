<template>
  <Dialog v-model="open" :options="{ title: 'Open POS Shift', size: 'xl' }">
    <template #body-content>
      <div class="space-y-6">
        <!-- Step 1: Select POS Profile -->
        <div v-if="step === 1" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Select POS Profile
            </label>
            <div v-if="profilesResource.loading" class="text-center py-4">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <div v-else-if="profilesResource.data && profilesResource.data.length > 0" class="grid grid-cols-1 gap-3">
              <div
                v-for="profile in profilesResource.data"
                :key="profile.name"
                @click="selectPosProfile(profile)"
                :class="[
                  'p-4 border rounded-lg cursor-pointer transition-all',
                  selectedProfile?.name === profile.name
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                ]"
              >
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="font-medium text-gray-900">{{ profile.name }}</h3>
                    <p class="text-sm text-gray-500 mt-1">{{ profile.company }}</p>
                  </div>
                  <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {{ profile.currency }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 text-gray-500">
              <p>No POS Profiles available. Please contact your administrator.</p>
            </div>
          </div>

          <div v-if="profilesResource.error" class="rounded-md bg-red-50 p-4">
            <p class="text-sm text-red-800">{{ profilesResource.error }}</p>
          </div>
        </div>

        <!-- Step 2: Enter Opening Balances -->
        <div v-if="step === 2" class="space-y-4">
          <div class="mb-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-medium text-gray-900">{{ selectedProfile?.name }}</h3>
                <p class="text-sm text-gray-500">{{ selectedProfile?.company }}</p>
              </div>
              <Button variant="subtle" @click="step = 1">Change Profile</Button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-3">
              Opening Balance (Optional)
            </label>

            <div v-if="dialogDataResource.loading" class="text-center py-4">
              <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>

            <div v-else-if="paymentMethods.length > 0" class="space-y-3">
              <div
                v-for="method in paymentMethods"
                :key="method.name"
                class="flex items-center justify-between p-3 border rounded-lg"
              >
                <div class="flex-1">
                  <label class="text-sm font-medium text-gray-700">
                    {{ method.mode_of_payment }}
                  </label>
                </div>
                <div class="w-32">
                  <Input
                    v-model="openingBalances[method.mode_of_payment]"
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div v-else class="text-center py-4 text-gray-500">
              <p class="text-sm">No payment methods configured for this POS Profile</p>
            </div>
          </div>

          <div v-if="dialogDataResource.error" class="rounded-md bg-red-50 p-4">
            <p class="text-sm text-red-800">{{ dialogDataResource.error }}</p>
          </div>

          <div v-if="createShiftResource.error" class="rounded-md bg-red-50 p-4">
            <p class="text-sm text-red-800">{{ createShiftResource.error }}</p>
          </div>
        </div>

        <!-- Step 3: Resume or Open New -->
        <div v-if="step === 3" class="space-y-4">
          <div class="text-center">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Existing Shift Found</h3>
            <p class="text-sm text-gray-500 mb-6">
              You have an open shift. Would you like to resume it or close it and open a new one?
            </p>

            <div v-if="existingShift" class="bg-gray-50 rounded-lg p-4 mb-6">
              <div class="text-sm text-gray-600">
                <p><strong>POS Profile:</strong> {{ existingShift.pos_profile?.name }}</p>
                <p><strong>Opened:</strong> {{ formatDateTime(existingShift.pos_opening_shift?.period_start_date) }}</p>
              </div>
            </div>

            <div class="flex space-x-3 justify-center">
              <Button variant="solid" theme="blue" @click="resumeShift">
                Resume Shift
              </Button>
              <Button variant="subtle" theme="gray" @click="closeAndOpenNew">
                Close & Open New
              </Button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #actions>
      <div class="flex justify-between w-full">
        <Button v-if="step > 1 && step !== 3" variant="subtle" @click="step--">
          Back
        </Button>
        <div v-else></div>

        <div class="flex space-x-2">
          <Button variant="subtle" @click="closeDialog" :disabled="createShiftResource.loading">
            Cancel
          </Button>
          <Button
            v-if="step === 1"
            variant="solid"
            theme="blue"
            @click="nextStep"
            :disabled="!selectedProfile"
          >
            Next
          </Button>
          <Button
            v-if="step === 2"
            variant="solid"
            theme="blue"
            @click="openShift"
            :loading="createShiftResource.loading"
          >
            Open Shift
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
import { createResource } from "frappe-ui"

const props = defineProps({
  modelValue: Boolean,
})

const emit = defineEmits(["update:modelValue", "shift-opened"])

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
})

const { createOpeningShift, getOpeningDialogData, checkOpeningShift } = useShift()

const step = ref(1)
const selectedProfile = ref(null)
const openingBalances = ref({})
const existingShift = ref(null)

// Get POS Profiles
const profilesResource = createResource({
  url: "pos_next.api.pos_profile.get_pos_profiles",
  auto: false,
})

// Get dialog data (payment methods)
const dialogDataResource = createResource({
  url: "pos_next.api.shifts.get_opening_dialog_data",
  auto: false,
})

// Create shift resource
const createShiftResource = createOpeningShift

// Computed payment methods for selected profile
const paymentMethods = computed(() => {
  if (!dialogDataResource.data || !selectedProfile.value) return []

  return (dialogDataResource.data.payments_method || []).filter(
    (method) => method.parent === selectedProfile.value.name
  )
})

// Watch dialog open state
watch(open, (isOpen) => {
  if (isOpen) {
    initDialog()
  } else {
    resetDialog()
  }
})

async function initDialog() {
  step.value = 1
  profilesResource.fetch()

  // Check if user already has an open shift
  const checkResult = await checkOpeningShift.fetch()
  if (checkResult) {
    existingShift.value = checkResult
    step.value = 3
  }
}

function resetDialog() {
  step.value = 1
  selectedProfile.value = null
  openingBalances.value = {}
  existingShift.value = null
}

function selectPosProfile(profile) {
  selectedProfile.value = profile
}

async function nextStep() {
  if (step.value === 1 && selectedProfile.value) {
    await dialogDataResource.fetch()
    step.value = 2
  }
}

async function openShift() {
  if (!selectedProfile.value) return

  // Prepare balance details
  const balance_details = paymentMethods.value.map((method) => ({
    mode_of_payment: method.mode_of_payment,
    opening_amount: parseFloat(openingBalances.value[method.mode_of_payment] || 0),
  }))

  try {
    await createShiftResource.submit({
      pos_profile: selectedProfile.value.name,
      company: selectedProfile.value.company,
      balance_details,
    })

    emit("shift-opened")
    closeDialog()
  } catch (error) {
    console.error("Error opening shift:", error)
  }
}

function resumeShift() {
  emit("shift-opened")
  closeDialog()
}

function closeAndOpenNew() {
  // TODO: Implement close shift and open new
  // For now, just reset to step 1
  existingShift.value = null
  step.value = 1
}

function closeDialog() {
  open.value = false
}

function formatDateTime(datetime) {
  if (!datetime) return ""
  return new Date(datetime).toLocaleString()
}
</script>
