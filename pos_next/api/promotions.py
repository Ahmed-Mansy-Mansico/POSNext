# -*- coding: utf-8 -*-
# Copyright (c) 2025, POS Next and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, nowdate, getdate, cstr, cint
import re


def check_promotion_permissions(action="read"):
	"""
	Check if user has permissions for promotional scheme operations.

	Args:
		action: Type of action - "read", "write", "delete"

	Raises:
		frappe.PermissionError: If user doesn't have required permissions
	"""
	# Check if user has required permissions for Promotional Scheme doctype
	if action == "read":
		if not frappe.has_permission("Promotional Scheme", "read"):
			frappe.throw(_("You don't have permission to view promotions"), frappe.PermissionError)
	elif action == "write":
		if not frappe.has_permission("Promotional Scheme", "write"):
			frappe.throw(_("You don't have permission to create or modify promotions"), frappe.PermissionError)
	elif action == "delete":
		if not frappe.has_permission("Promotional Scheme", "delete"):
			frappe.throw(_("You don't have permission to delete promotions"), frappe.PermissionError)


@frappe.whitelist()
def get_promotions(pos_profile=None, company=None, include_disabled=False):
	"""Get all promotional schemes for POS with simplified structure."""
	check_promotion_permissions("read")

	filters = {}

	if company:
		filters["company"] = company
	elif pos_profile:
		profile = frappe.get_doc("POS Profile", pos_profile)
		filters["company"] = profile.company

	if not include_disabled:
		filters["disable"] = 0

	# Get all promotional schemes
	schemes = frappe.get_all(
		"Promotional Scheme",
		filters=filters,
		fields=[
			"name", "apply_on", "disable", "selling", "buying",
			"applicable_for", "valid_from", "valid_upto", "company",
			"mixed_conditions", "is_cumulative"
		],
		order_by="modified desc"
	)

	# Enrich with pricing rules count and details
	today = getdate(nowdate())

	for scheme in schemes:
		# Get pricing rules count
		scheme["pricing_rules_count"] = frappe.db.count(
			"Pricing Rule",
			{"promotional_scheme": scheme.name}
		)

		# Get discount slabs
		scheme_doc = frappe.get_doc("Promotional Scheme", scheme.name)
		scheme["price_slabs"] = len(scheme_doc.price_discount_slabs or [])
		scheme["product_slabs"] = len(scheme_doc.product_discount_slabs or [])

		# Get items/groups/brands count
		if scheme.apply_on == "Item Code":
			scheme["items_count"] = len(scheme_doc.items or [])
		elif scheme.apply_on == "Item Group":
			scheme["items_count"] = len(scheme_doc.item_groups or [])
		elif scheme.apply_on == "Brand":
			scheme["items_count"] = len(scheme_doc.brands or [])
		else:
			scheme["items_count"] = 0

		# Calculate status based on dates and disable flag
		if scheme.disable:
			scheme["status"] = "Disabled"
		elif scheme.valid_from and getdate(scheme.valid_from) > today:
			scheme["status"] = "Not Started"
		elif scheme.valid_upto and getdate(scheme.valid_upto) < today:
			scheme["status"] = "Expired"
		else:
			scheme["status"] = "Active"

	return schemes


@frappe.whitelist()
def get_promotion_details(scheme_name):
	"""Get detailed information about a promotional scheme."""
	check_promotion_permissions("read")

	if not frappe.db.exists("Promotional Scheme", scheme_name):
		frappe.throw(_("Promotional Scheme {0} not found").format(scheme_name))

	scheme = frappe.get_doc("Promotional Scheme", scheme_name)

	# Convert to dict with all details
	data = scheme.as_dict()

	# Get active pricing rules
	data["pricing_rules"] = frappe.get_all(
		"Pricing Rule",
		filters={"promotional_scheme": scheme_name, "disable": 0},
		fields=["name", "title", "priority", "valid_from", "valid_upto"]
	)

	return data


@frappe.whitelist()
def create_promotion(data):
	"""
	Create a promotional scheme.

	Simplified input format:
	{
		"name": "Summer Sale 2025",
		"company": "Company Name",
		"apply_on": "Item Group",  # Item Code, Item Group, Brand, Transaction
		"items": [{"item_code": "ITEM-001"}] or [{"item_group": "Electronics"}] or [{"brand": "Apple"}],
		"discount_type": "percentage",  # percentage, amount, or free_item
		"discount_value": 10,  # percentage value or amount
		"free_item": "ITEM-FREE",  # if discount_type is free_item
		"free_qty": 1,  # if discount_type is free_item
		"min_qty": 5,
		"min_amt": 1000,
		"valid_from": "2025-01-01",
		"valid_upto": "2025-12-31",
		"applicable_for": "Customer Group",  # optional
		"customer_group": "Retail"  # if applicable_for is set
	}
	"""
	check_promotion_permissions("write")

	import json
	if isinstance(data, str):
		data = json.loads(data)

	# Validate required fields
	if not data.get("name"):
		frappe.throw(_("Promotion name is required"))
	if not data.get("company"):
		frappe.throw(_("Company is required"))
	if not data.get("apply_on"):
		frappe.throw(_("Apply On is required"))

	try:
		# Create promotional scheme
		scheme = frappe.new_doc("Promotional Scheme")
		scheme.update({
			"name": data.get("name"),
			"company": data.get("company"),
			"apply_on": data.get("apply_on"),
			"selling": 1,  # Always enable selling for POS
			"buying": 0,
			"valid_from": data.get("valid_from") or nowdate(),
			"valid_upto": data.get("valid_upto"),
			"mixed_conditions": cint(data.get("mixed_conditions", 0)),
			"is_cumulative": cint(data.get("is_cumulative", 0)),
		})

		# Set applicable for
		if data.get("applicable_for"):
			scheme.applicable_for = data["applicable_for"]
			applicable_key = frappe.scrub(data["applicable_for"])
			if data.get(applicable_key):
				# Handle both single value and list
				values = data[applicable_key] if isinstance(data[applicable_key], list) else [data[applicable_key]]
				for value in values:
					scheme.append(applicable_key, {applicable_key: value})

		# Add items/groups/brands based on apply_on
		apply_on_key = frappe.scrub(data["apply_on"])
		items_data = data.get("items", [])

		if data["apply_on"] == "Item Code" and items_data:
			for item in items_data:
				scheme.append("items", {
					"item_code": item.get("item_code"),
					"uom": item.get("uom")
				})
		elif data["apply_on"] == "Item Group" and items_data:
			for item in items_data:
				scheme.append("item_groups", {
					"item_group": item.get("item_group"),
					"uom": item.get("uom")
				})
		elif data["apply_on"] == "Brand" and items_data:
			for item in items_data:
				scheme.append("brands", {
					"brand": item.get("brand"),
					"uom": item.get("uom")
				})

		# Add discount slab
		discount_type = data.get("discount_type", "percentage")

		if discount_type in ["percentage", "amount"]:
			# Price discount
			slab = scheme.append("price_discount_slabs", {})
			slab.rule_description = data.get("rule_description") or _("Discount Rule")
			slab.min_qty = flt(data.get("min_qty", 0))
			slab.max_qty = flt(data.get("max_qty", 0))
			slab.min_amount = flt(data.get("min_amt", 0))
			slab.max_amount = flt(data.get("max_amt", 0))

			if discount_type == "percentage":
				slab.rate_or_discount = "Discount Percentage"
				slab.discount_percentage = flt(data.get("discount_value", 0))
			else:
				slab.rate_or_discount = "Discount Amount"
				slab.discount_amount = flt(data.get("discount_value", 0))

			if data.get("priority"):
				slab.priority = cstr(data["priority"])

		elif discount_type == "free_item":
			# Product discount
			slab = scheme.append("product_discount_slabs", {})
			slab.rule_description = data.get("rule_description") or _("Free Item Rule")
			slab.min_qty = flt(data.get("min_qty", 0))
			slab.max_qty = flt(data.get("max_qty", 0))
			slab.min_amount = flt(data.get("min_amt", 0))
			slab.max_amount = flt(data.get("max_amt", 0))
			slab.free_item = data.get("free_item")
			slab.free_qty = flt(data.get("free_qty", 1))
			slab.free_item_uom = data.get("free_item_uom")
			slab.same_item = cint(data.get("same_item", 0))

			if data.get("priority"):
				slab.priority = cstr(data["priority"])

		# Save the scheme (this will auto-generate pricing rules)
		scheme.flags.ignore_permissions = True
		scheme.insert()
		frappe.db.commit()

		return {
			"success": True,
			"message": _("Promotion {0} created successfully").format(scheme.name),
			"scheme_name": scheme.name
		}

	except Exception as e:
		frappe.db.rollback()
		frappe.log_error(
			title=_("Promotion Creation Failed"),
			message=frappe.get_traceback()
		)
		frappe.throw(_("Failed to create promotion: {0}").format(str(e)))


@frappe.whitelist()
def update_promotion(scheme_name, data):
	"""
	Update an existing promotional scheme.
	Supports updating validity dates, discount values, and slab conditions.
	"""
	check_promotion_permissions("write")

	import json
	if isinstance(data, str):
		data = json.loads(data)

	if not frappe.db.exists("Promotional Scheme", scheme_name):
		frappe.throw(_("Promotional Scheme {0} not found").format(scheme_name))

	try:
		scheme = frappe.get_doc("Promotional Scheme", scheme_name)

		# Update basic fields
		if "valid_from" in data:
			scheme.valid_from = data["valid_from"]
		if "valid_upto" in data:
			scheme.valid_upto = data["valid_upto"]
		if "disable" in data:
			scheme.disable = cint(data["disable"])

		# Update discount values in slabs
		if "discount_value" in data or "min_qty" in data or "max_qty" in data or "min_amt" in data or "max_amt" in data:
			# Update price discount slabs
			if scheme.price_discount_slabs and len(scheme.price_discount_slabs) > 0:
				slab = scheme.price_discount_slabs[0]
				if "min_qty" in data:
					slab.min_qty = flt(data["min_qty"])
				if "max_qty" in data:
					slab.max_qty = flt(data["max_qty"])
				if "min_amt" in data:
					slab.min_amount = flt(data["min_amt"])
				if "max_amt" in data:
					slab.max_amount = flt(data["max_amt"])
				if "discount_value" in data:
					if slab.rate_or_discount == "Discount Percentage":
						slab.discount_percentage = flt(data["discount_value"])
					elif slab.rate_or_discount == "Discount Amount":
						slab.discount_amount = flt(data["discount_value"])

		# Update free item slabs
		if "free_item" in data or "free_qty" in data or "min_qty" in data or "max_qty" in data or "min_amt" in data or "max_amt" in data:
			if scheme.product_discount_slabs and len(scheme.product_discount_slabs) > 0:
				slab = scheme.product_discount_slabs[0]
				if "free_item" in data:
					slab.free_item = data["free_item"]
				if "free_qty" in data:
					slab.free_qty = flt(data["free_qty"])
				if "min_qty" in data:
					slab.min_qty = flt(data["min_qty"])
				if "max_qty" in data:
					slab.max_qty = flt(data["max_qty"])
				if "min_amt" in data:
					slab.min_amount = flt(data["min_amt"])
				if "max_amt" in data:
					slab.max_amount = flt(data["max_amt"])

		# Save
		scheme.flags.ignore_permissions = True
		scheme.save()
		frappe.db.commit()

		return {
			"success": True,
			"message": _("Promotion {0} updated successfully").format(scheme_name)
		}

	except Exception as e:
		frappe.db.rollback()
		frappe.log_error(
			title=_("Promotion Update Failed"),
			message=frappe.get_traceback()
		)
		frappe.throw(_("Failed to update promotion: {0}").format(str(e)))


@frappe.whitelist()
def toggle_promotion(scheme_name, disable=None):
	"""Enable or disable a promotional scheme."""
	check_promotion_permissions("write")

	if not frappe.db.exists("Promotional Scheme", scheme_name):
		frappe.throw(_("Promotional Scheme {0} not found").format(scheme_name))

	try:
		scheme = frappe.get_doc("Promotional Scheme", scheme_name)

		if disable is not None:
			scheme.disable = cint(disable)
		else:
			scheme.disable = 0 if scheme.disable else 1

		scheme.flags.ignore_permissions = True
		scheme.save()
		frappe.db.commit()

		status = "disabled" if scheme.disable else "enabled"
		return {
			"success": True,
			"message": _("Promotion {0} {1}").format(scheme_name, status),
			"disabled": scheme.disable
		}

	except Exception as e:
		frappe.db.rollback()
		frappe.log_error(
			title=_("Promotion Toggle Failed"),
			message=frappe.get_traceback()
		)
		frappe.throw(_("Failed to toggle promotion: {0}").format(str(e)))


@frappe.whitelist()
def delete_promotion(scheme_name):
	"""Delete a promotional scheme and its pricing rules."""
	check_promotion_permissions("delete")

	if not frappe.db.exists("Promotional Scheme", scheme_name):
		frappe.throw(_("Promotional Scheme {0} not found").format(scheme_name))

	try:
		# This will automatically delete associated pricing rules via on_trash
		frappe.delete_doc("Promotional Scheme", scheme_name, ignore_permissions=True)
		frappe.db.commit()

		return {
			"success": True,
			"message": _("Promotion {0} deleted successfully").format(scheme_name)
		}

	except Exception as e:
		frappe.db.rollback()
		frappe.log_error(
			title=_("Promotion Deletion Failed"),
			message=frappe.get_traceback()
		)
		frappe.throw(_("Failed to delete promotion: {0}").format(str(e)))


@frappe.whitelist()
def get_item_groups(company=None):
	"""Get all item groups."""
	# Item Group is a global doctype, not company-specific
	# Return all item groups (both parent groups and leaf nodes)
	return frappe.get_all(
		"Item Group",
		fields=["name", "parent_item_group", "is_group"],
		order_by="name"
	)


@frappe.whitelist()
def get_brands():
	"""Get all brands."""
	return frappe.get_all(
		"Brand",
		fields=["name"],
		order_by="name"
	)


@frappe.whitelist()
def search_items(search_term, pos_profile=None, limit=20):
	"""Search for items."""
	# Rate limiting: Track API calls per user
	cache_key = f"search_items_rate_limit:{frappe.session.user}"
	call_count_raw = frappe.cache().get(cache_key)
	call_count = int(call_count_raw) if call_count_raw else 0

	if call_count > 50:  # Max 50 searches per minute
		frappe.throw(_("Too many search requests. Please wait a moment."))

	frappe.cache().setex(cache_key, 60, call_count + 1)

	# Sanitize search term to prevent SQL injection
	if not search_term or not isinstance(search_term, str):
		return []

	# Remove any special SQL characters and limit length
	search_term = re.sub(r'[^\w\s-]', '', search_term)[:100]

	if len(search_term) < 2:
		return []

	filters = {"disabled": 0}

	if pos_profile:
		profile = frappe.get_doc("POS Profile", pos_profile)
		if profile.item_groups:
			item_groups = [d.item_group for d in profile.item_groups]
			filters["item_group"] = ["in", item_groups]

	# Limit results
	limit = min(int(limit) if limit else 20, 50)  # Max 50 results

	return frappe.get_all(
		"Item",
		filters=filters,
		or_filters={
			"item_code": ["like", f"%{search_term}%"],
			"item_name": ["like", f"%{search_term}%"]
		},
		fields=["item_code", "item_name", "item_group", "brand", "stock_uom"],
		limit=limit,
		order_by="item_name"
	)
