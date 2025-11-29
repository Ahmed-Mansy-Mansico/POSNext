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
		{"parent": pos_profile, "user": frappe.session.user},
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
		# Validate pos_profile parameter
		if not pos_profile:
			frappe.throw(_("POS Profile is required"))

		payment_methods = frappe.get_list(
			"POS Payment Method",
			filters={"parent": pos_profile},
			fields=["mode_of_payment", "default", "allow_in_returns"],
			order_by="idx",
			ignore_permissions=True
		)

		# Translation map for Arabic to English payment method names
		translation_map = {
			"نقد": "Cash",
			"تابي": "Tabi",
			"تمارا": "Tamara",
			"بطاقة": "Card",
			"بطاقة ائتمان": "Credit Card",
			"بطاقة مدين": "Debit Card",
			"تحويل بنكي": "Bank Transfer",
			"شيك": "Check",
			"محفظة إلكترونية": "E-Wallet",
		}

		# Get payment type for each method and translate Arabic names
		for method in payment_methods:
			payment_type = frappe.db.get_value(
				"Mode of Payment",
				method["mode_of_payment"],
				"type"
			)
			method["type"] = payment_type or "Cash"
			
			# Store original name FIRST (before translation)
			method["original_name"] = method["mode_of_payment"]
			
			# Translate Arabic payment method names to English for display
			if method["mode_of_payment"] in translation_map:
				method["mode_of_payment_display"] = translation_map[method["mode_of_payment"]]
			else:
				method["mode_of_payment_display"] = method["mode_of_payment"]

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


@frappe.whitelist()
def get_warehouses(pos_profile):
	"""Get all warehouses for the company in POS Profile"""
	try:
		if not pos_profile:
			return []

		# Get the company from POS Profile
		company = frappe.db.get_value("POS Profile", pos_profile, "company")

		if not company:
			return []

		# Get all active warehouses for the company
		warehouses = frappe.get_list(
			"Warehouse",
			filters={
				"company": company,
				"disabled": 0,
				"is_group": 0
			},
			fields=["name", "warehouse_name"],
			order_by="warehouse_name",
			limit_page_length=0
		)

		# Return warehouses with human-readable names
		return warehouses
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Warehouses Error")
		return []


@frappe.whitelist()
def get_tax_rate_from_category(pos_profile):
	"""Get tax rate from tax_category field in POS Profile"""
	try:
		if not pos_profile:
			frappe.logger().info(f"[Tax Rate API] No POS profile provided")
			return 0

		# Get the POS Profile
		profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)
		tax_category = getattr(profile_doc, 'tax_category', None)
		
		# Log all relevant fields for debugging
		frappe.logger().info(f"[Tax Rate API] POS Profile: {pos_profile}")
		frappe.logger().info(f"[Tax Rate API] Tax Category field value: {tax_category} (type: {type(tax_category).__name__})")

		if not tax_category:
			frappe.logger().info(f"[Tax Rate API] No tax_category found in POS Profile {pos_profile}")
			return 0

		# Method 1: Check if tax_category is a string containing percentage (e.g., "15%")
		if isinstance(tax_category, str) and '%' in tax_category:
			try:
				# Extract number from string like "15%" -> 15
				rate_str = tax_category.replace('%', '').strip()
				rate_value = float(rate_str)
				frappe.logger().info(f"[Tax Rate API] Extracted rate from string '{tax_category}': {rate_value}%")
				return rate_value
			except (ValueError, AttributeError):
				pass

		# Method 2: Try to get tax rate from Tax Category doctype (if it's a link field)
		# Check if Tax Category exists as a doctype
		if frappe.db.exists("Tax Category", tax_category):
			# Try different possible field names for tax rate
			possible_fields = ['tax_rate', 'rate', 'tax_percentage', 'percentage']
			
			for field_name in possible_fields:
				try:
					tax_rate = frappe.db.get_value("Tax Category", tax_category, field_name)
					if tax_rate is not None:
						rate_value = float(tax_rate) or 0
						if rate_value > 0:
							frappe.logger().info(f"[Tax Rate API] Found rate in Tax Category '{tax_category}' field '{field_name}': {rate_value}%")
							return rate_value
				except Exception:
					continue
			
			# If no direct field, try to get from tax rules in Tax Category
			try:
				tax_category_doc = frappe.get_doc("Tax Category", tax_category)
				# Check if there's a default tax template or rate
				if hasattr(tax_category_doc, 'tax_rate') and tax_category_doc.tax_rate:
					rate_value = float(tax_category_doc.tax_rate) or 0
					if rate_value > 0:
						frappe.logger().info(f"[Tax Rate API] Found rate in Tax Category doc: {rate_value}%")
						return rate_value
			except Exception as e:
				frappe.logger().info(f"[Tax Rate API] Could not get rate from Tax Category doc: {str(e)}")

		# If all methods fail, return 0
		frappe.logger().info(f"[Tax Rate API] Could not extract tax rate from tax_category '{tax_category}', returning 0")
		return 0
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Tax Rate from Category Error")
		frappe.logger().error(f"[Tax Rate API] Error: {str(e)}")
		# Return 0 instead of throwing - tax is optional
		return 0


@frappe.whitelist()
def update_warehouse(pos_profile, warehouse):
	"""Update warehouse in POS Profile"""
	try:
		if not pos_profile:
			frappe.throw(_("POS Profile is required"))

		if not warehouse:
			frappe.throw(_("Warehouse is required"))

		# Check if user has access to this POS Profile
		has_access = frappe.db.exists(
			"POS Profile User",
			{"parent": pos_profile, "user": frappe.session.user},
		)

		if not has_access and not frappe.has_permission("POS Profile", "write"):
			frappe.throw(_("You don't have permission to update this POS Profile"))

		# Get POS Profile to check company
		profile_doc = frappe.get_doc("POS Profile", pos_profile)

		# Validate warehouse exists and is active
		warehouse_doc = frappe.get_doc("Warehouse", warehouse)
		if warehouse_doc.disabled:
			frappe.throw(_("Warehouse {0} is disabled").format(warehouse))

		# Validate warehouse belongs to same company
		if warehouse_doc.company != profile_doc.company:
			frappe.throw(_(
				"Warehouse {0} belongs to {1}, but POS Profile belongs to {2}"
			).format(warehouse, warehouse_doc.company, profile_doc.company))

		# Update the POS Profile
		profile_doc.warehouse = warehouse
		profile_doc.save()

		return {
			"success": True,
			"message": _("Warehouse updated successfully"),
			"warehouse": warehouse
		}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Update Warehouse Error")
		frappe.throw(_("Error updating warehouse: {0}").format(str(e)))
