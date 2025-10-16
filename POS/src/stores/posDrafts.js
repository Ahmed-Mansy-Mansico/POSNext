import { deleteDraft, getDraftsCount, saveDraft } from "@/utils/draftManager"
import { toast } from "frappe-ui"
import { defineStore } from "pinia"
import { ref } from "vue"

export const usePOSDraftsStore = defineStore("posDrafts", () => {
	// State
	const draftsCount = ref(0)

	// Actions
	async function updateDraftsCount() {
		try {
			draftsCount.value = await getDraftsCount()
		} catch (error) {
			console.error("Error getting drafts count:", error)
		}
	}

	async function saveDraftInvoice(
		invoiceItems,
		customer,
		posProfile,
		appliedOffers = [],
	) {
		if (invoiceItems.length === 0) {
			toast.create({
				title: "Empty Cart",
				text: "Cannot save an empty cart as draft",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
			return false
		}

		try {
			const draftData = {
				pos_profile: posProfile,
				customer: customer,
				items: invoiceItems,
				applied_offers: appliedOffers, // Save applied offers
			}

			await saveDraft(draftData)
			await updateDraftsCount()

			toast.create({
				title: "Draft Saved",
				text: "Invoice saved as draft successfully",
				icon: "check",
				iconClasses: "text-green-600",
			})

			return true
		} catch (error) {
			console.error("Error saving draft:", error)
			toast.create({
				title: "Error",
				text: "Failed to save draft",
				icon: "alert-circle",
				iconClasses: "text-red-600",
			})
			return false
		}
	}

	async function loadDraft(draft) {
		try {
			// Delete the draft after loading (to prevent duplicates)
			await deleteDraft(draft.draft_id)
			await updateDraftsCount()

			toast.create({
				title: "Draft Loaded",
				text: "Draft invoice loaded successfully",
				icon: "check",
				iconClasses: "text-green-600",
			})

			return {
				items: draft.items || [],
				customer: draft.customer,
				applied_offers: draft.applied_offers || [], // Restore applied offers
			}
		} catch (error) {
			console.error("Error loading draft:", error)
			toast.create({
				title: "Error",
				text: "Failed to load draft",
				icon: "alert-circle",
				iconClasses: "text-red-600",
			})
			throw error
		}
	}

	return {
		// State
		draftsCount,

		// Actions
		updateDraftsCount,
		saveDraftInvoice,
		loadDraft,
	}
})
