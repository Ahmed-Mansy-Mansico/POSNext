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
		"company": company_doc
	}
