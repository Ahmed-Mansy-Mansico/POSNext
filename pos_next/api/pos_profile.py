# -*- coding: utf-8 -*-
# Copyright (c) 2024, POS Next and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _


@frappe.whitelist()
def get_pos_profiles():
	"""Get all POS Profiles accessible by current user"""
	pos_profiles = frappe.db.sql(
		"""
		SELECT DISTINCT p.name, p.company, p.currency, p.warehouse,
			p.selling_price_list, p.write_off_account, p.write_off_cost_center
		FROM `tabPOS Profile` p
		INNER JOIN `tabPOS Profile User` u ON u.parent = p.name
		WHERE p.disabled = 0 AND u.user = %s
		ORDER BY p.name
		""",
		frappe.session.user,
		as_dict=1,
	)

	return pos_profiles


@frappe.whitelist()
def get_pos_profile_data(pos_profile):
	"""Get detailed POS Profile data"""
	if not pos_profile:
		frappe.throw(_("POS Profile is required"))

	# Check if user has access to this POS Profile
	has_access = frappe.db.exists(
		"POS Profile User",
		{"parent": pos_profile, "user": frappe.session.user}
	)

	if not has_access:
		frappe.throw(_("You don't have access to this POS Profile"))

	profile_doc = frappe.get_doc("POS Profile", pos_profile)
	company_doc = frappe.get_doc("Company", profile_doc.company)

	return {
		"pos_profile": profile_doc,
		"company": company_doc,
		"print_settings": {
			"auto_print": profile_doc.get("print_receipt_on_order_complete", 0),
			"print_format": profile_doc.get("print_format"),
			"letter_head": profile_doc.get("letter_head"),
		}
	}


@frappe.whitelist()
def get_payment_methods(pos_profile):
	"""Get available payment methods from POS Profile"""
	try:
		payment_methods = frappe.get_list(
			"POS Payment Method",
			filters={"parent": pos_profile},
			fields=["mode_of_payment", "default", "allow_in_returns"],
			order_by="idx",
			ignore_permissions=True
		)

		# Get payment type for each method
		for method in payment_methods:
			payment_type = frappe.db.get_value(
				"Mode of Payment",
				method["mode_of_payment"],
				"type"
			)
			method["type"] = payment_type or "Cash"

		return payment_methods
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Payment Methods Error")
		frappe.throw(_("Error fetching payment methods: {0}").format(str(e)))


@frappe.whitelist()
def get_taxes(pos_profile):
	"""Get tax configuration from POS Profile"""
	try:
		if not pos_profile:
			return []

		# Get the POS Profile
		profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)
		taxes_and_charges = getattr(profile_doc, 'taxes_and_charges', None)

		if not taxes_and_charges:
			return []

		# Get the tax template
		template_doc = frappe.get_cached_doc("Sales Taxes and Charges Template", taxes_and_charges)

		# Extract tax rows
		taxes = []
		for tax_row in template_doc.taxes:
			taxes.append({
				"account_head": tax_row.account_head,
				"charge_type": tax_row.charge_type,
				"rate": tax_row.rate,
				"description": tax_row.description,
				"included_in_print_rate": getattr(tax_row, 'included_in_print_rate', 0),
				"idx": tax_row.idx
			})

		return taxes
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Taxes Error")
		# Return empty array instead of throwing - taxes are optional
		return []
