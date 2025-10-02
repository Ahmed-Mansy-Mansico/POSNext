# -*- coding: utf-8 -*-
# Copyright (c) 2025, POS Next and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, nowdate, getdate


@frappe.whitelist()
def get_offers(pos_profile):
	"""
	Get all active offers for a POS Profile
	Includes both custom POS Offers and ERPNext Pricing Rules
	"""
	profile = frappe.get_doc("POS Profile", pos_profile)
	company = profile.company
	warehouse = profile.warehouse
	date = nowdate()

	offers = []

	# Get POS Offers if POSAwesome is installed
	if frappe.db.table_exists("POS Offer"):
		pos_offers = _get_pos_offers(pos_profile, company, warehouse, date)
		offers.extend(pos_offers)

	# Get ERPNext Pricing Rules
	pricing_rules = _get_pricing_rules(company, date)
	offers.extend(pricing_rules)

	# Get Promotional Schemes if available
	if frappe.db.table_exists("Promotional Scheme"):
		promo_offers = _get_promotional_schemes(profile, date)
		offers.extend(promo_offers)

	return offers


def _get_pos_offers(pos_profile, company, warehouse, date):
	"""Get offers from POS Offer doctype (POSAwesome pattern)"""
	values = {
		"company": company,
		"pos_profile": pos_profile,
		"warehouse": warehouse,
		"valid_from": date,
		"valid_upto": date,
	}

	offers = frappe.db.sql(
		"""
		SELECT
			name, title, description, apply_on, offer, company,
			pos_profile, warehouse, item, item_group, brand,
			valid_from, valid_upto, coupon_based, auto,
			min_qty, max_qty, min_amt, max_amt,
			apply_type, apply_item_code, apply_item_group,
			discount_type, rate, discount_amount, discount_percentage,
			given_qty, replace_item, replace_cheapest_item
		FROM `tabPOS Offer`
		WHERE
			disable = 0 AND
			company = %(company)s AND
			(pos_profile IS NULL OR pos_profile = '' OR pos_profile = %(pos_profile)s) AND
			(warehouse IS NULL OR warehouse = '' OR warehouse = %(warehouse)s) AND
			(valid_from IS NULL OR valid_from = '' OR valid_from <= %(valid_from)s) AND
			(valid_upto IS NULL OR valid_upto = '' OR valid_upto >= %(valid_upto)s)
		ORDER BY title
		""",
		values=values,
		as_dict=1,
	) or []

	return offers


def _get_pricing_rules(company, date):
	"""Get active Pricing Rules from ERPNext"""
	pricing_rules = frappe.db.sql(
		"""
		SELECT
			name, title, apply_on, selling,
			min_qty, max_qty, min_amt, max_amt,
			price_or_product_discount, rate_or_discount,
			rate, discount_amount, discount_percentage,
			priority, valid_from, valid_upto
		FROM `tabPricing Rule`
		WHERE
			disable = 0 AND
			selling = 1 AND
			company = %(company)s AND
			(valid_from IS NULL OR valid_from <= %(date)s) AND
			(valid_upto IS NULL OR valid_upto >= %(date)s)
		ORDER BY priority DESC, name
		""",
		{"company": company, "date": date},
		as_dict=1,
	) or []

	# Transform to standard offer format
	offers = []
	for rule in pricing_rules:
		offer = {
			"name": rule.name,
			"title": rule.title or rule.name,
			"description": rule.title,
			"apply_on": rule.apply_on,
			"offer": "Item Price" if rule.price_or_product_discount == "Price" else "Give Product",
			"auto": 1,
			"coupon_based": 0,
			"min_qty": flt(rule.min_qty),
			"max_qty": flt(rule.max_qty),
			"min_amt": flt(rule.min_amt),
			"max_amt": flt(rule.max_amt),
			"discount_type": rule.rate_or_discount,
			"rate": flt(rule.rate),
			"discount_amount": flt(rule.discount_amount),
			"discount_percentage": flt(rule.discount_percentage),
			"valid_from": rule.valid_from,
			"valid_upto": rule.valid_upto,
			"source": "Pricing Rule",
		}
		offers.append(offer)

	return offers


def _get_promotional_schemes(pos_profile, date):
	"""Get active Promotional Schemes"""
	schemes = frappe.db.sql(
		"""
		SELECT name, apply_on, company, valid_from, valid_upto
		FROM `tabPromotional Scheme`
		WHERE
			disable = 0 AND
			selling = 1 AND
			company = %(company)s AND
			(valid_from IS NULL OR valid_from <= %(date)s) AND
			(valid_upto IS NULL OR valid_upto >= %(date)s)
		""",
		{"company": pos_profile.company, "date": date},
		as_dict=1,
	) or []

	offers = []
	for scheme_data in schemes:
		try:
			scheme = frappe.get_doc("Promotional Scheme", scheme_data.name)
			offers.extend(_parse_promotional_scheme(scheme, pos_profile))
		except Exception:
			frappe.log_error(
				frappe.get_traceback(),
				f"Failed to load Promotional Scheme {scheme_data.name}"
			)
			continue

	return offers


def _parse_promotional_scheme(scheme, pos_profile):
	"""Parse promotional scheme into offers"""
	# Skip unsupported configurations
	if scheme.applicable_for or scheme.apply_rule_on_other:
		return []

	if scheme.mixed_conditions or scheme.is_cumulative:
		return []

	offers = []

	# Price discount slabs
	for slab in scheme.get("price_discount_slabs", []):
		if slab.disable:
			continue

		offer = {
			"name": f"promo-{scheme.name}-{slab.name}",
			"title": scheme.name,
			"description": slab.rule_description or scheme.name,
			"apply_on": scheme.apply_on,
			"offer": "Grand Total" if scheme.apply_on == "Transaction" else "Item Price",
			"auto": 1,
			"coupon_based": 0,
			"min_qty": flt(slab.min_qty),
			"max_qty": flt(slab.max_qty),
			"min_amt": flt(slab.min_amount),
			"max_amt": flt(slab.max_amount),
			"discount_type": slab.rate_or_discount,
			"rate": flt(slab.rate),
			"discount_amount": flt(slab.discount_amount),
			"discount_percentage": flt(slab.discount_percentage),
			"valid_from": scheme.valid_from,
			"valid_upto": scheme.valid_upto,
			"source": "Promotional Scheme",
		}
		offers.append(offer)

	# Product discount slabs (free items)
	for slab in scheme.get("product_discount_slabs", []):
		if slab.disable or flt(slab.free_qty) <= 0:
			continue

		offer = {
			"name": f"promo-{scheme.name}-{slab.name}",
			"title": scheme.name,
			"description": slab.rule_description or scheme.name,
			"apply_on": scheme.apply_on,
			"offer": "Give Product",
			"auto": 1,
			"coupon_based": 0,
			"min_qty": flt(slab.min_qty),
			"max_qty": flt(slab.max_qty),
			"min_amt": flt(slab.min_amount),
			"max_amt": flt(slab.max_amount),
			"given_qty": flt(slab.free_qty),
			"give_item": slab.free_item,
			"discount_type": "Rate" if flt(slab.free_item_rate) else "Discount Percentage",
			"rate": flt(slab.free_item_rate),
			"discount_percentage": 100 if not flt(slab.free_item_rate) else 0,
			"valid_from": scheme.valid_from,
			"valid_upto": scheme.valid_upto,
			"source": "Promotional Scheme",
		}
		offers.append(offer)

	return offers


@frappe.whitelist()
def validate_coupon(coupon_code, customer=None, company=None):
	"""
	Validate coupon code and return associated offer
	"""
	# Check if POS Coupon doctype exists (POSAwesome)
	if not frappe.db.table_exists("POS Coupon"):
		return {
			"valid": False,
			"message": "Coupon system not installed",
		}

	# Check if coupon exists
	if not frappe.db.exists("POS Coupon", {"coupon_code": coupon_code.upper()}):
		return {
			"valid": False,
			"message": "Invalid coupon code",
		}

	coupon = frappe.get_doc("POS Coupon", {"coupon_code": coupon_code.upper()})

	# Validate dates
	if coupon.valid_from and getdate(coupon.valid_from) > getdate(nowdate()):
		return {
			"valid": False,
			"message": "Coupon not yet valid",
		}

	if coupon.valid_upto and getdate(coupon.valid_upto) < getdate(nowdate()):
		return {
			"valid": False,
			"message": "Coupon expired",
		}

	# Check usage limit
	if coupon.used and coupon.maximum_use and coupon.used >= coupon.maximum_use:
		return {
			"valid": False,
			"message": "Coupon usage limit reached",
		}

	# Validate customer (for gift cards)
	if customer and coupon.coupon_type == "Gift Card":
		if customer != coupon.customer:
			return {
				"valid": False,
				"message": "Coupon not valid for this customer",
			}

	# Validate company
	if company and coupon.company != company:
		return {
			"valid": False,
			"message": "Coupon not valid for this company",
		}

	# Get associated POS Offer
	pos_offer = frappe.get_doc("POS Offer", coupon.pos_offer)

	if pos_offer.disable:
		return {
			"valid": False,
			"message": "Offer no longer active",
		}

	return {
		"valid": True,
		"message": "Coupon valid",
		"coupon": coupon.as_dict(),
		"offer": pos_offer.as_dict(),
	}


@frappe.whitelist()
def get_active_coupons(customer, company):
	"""Get active gift card coupons for a customer"""
	if not frappe.db.table_exists("POS Coupon"):
		return []

	coupons = frappe.get_all(
		"POS Coupon",
		filters={
			"company": company,
			"coupon_type": "Gift Card",
			"customer": customer,
			"used": 0,
		},
		fields=["name", "coupon_code", "coupon_name", "valid_from", "valid_upto", "pos_offer"],
	)

	return coupons


@frappe.whitelist()
def apply_coupon_to_invoice(invoice_name, coupon_code):
	"""
	Apply a coupon to an invoice
	Updates coupon usage count
	"""
	if not frappe.db.table_exists("POS Coupon"):
		frappe.throw("Coupon system not available")

	# Get coupon
	if not frappe.db.exists("POS Coupon", {"coupon_code": coupon_code.upper()}):
		frappe.throw("Invalid coupon code")

	coupon = frappe.get_doc("POS Coupon", {"coupon_code": coupon_code.upper()})

	# Increment usage count
	if coupon.maximum_use and coupon.used >= coupon.maximum_use:
		frappe.throw("Coupon usage limit exceeded")

	coupon.used = (coupon.used or 0) + 1
	coupon.save(ignore_permissions=True)

	return {
		"success": True,
		"message": f"Coupon {coupon_code} applied successfully",
		"coupon": coupon.as_dict()
	}


@frappe.whitelist()
def cancel_coupon_usage(coupon_code):
	"""
	Cancel coupon usage (when invoice is cancelled)
	Decrements usage count
	"""
	if not frappe.db.table_exists("POS Coupon"):
		return

	if not frappe.db.exists("POS Coupon", {"coupon_code": coupon_code.upper()}):
		return

	coupon = frappe.get_doc("POS Coupon", {"coupon_code": coupon_code.upper()})

	if coupon.used > 0:
		coupon.used = coupon.used - 1
		coupon.save(ignore_permissions=True)

	return {
		"success": True,
		"message": "Coupon usage cancelled"
	}


@frappe.whitelist()
def get_all_coupons(pos_profile=None, customer=None):
	"""
	Get all available coupons (promotional and gift cards)
	"""
	if not frappe.db.table_exists("POS Coupon"):
		return []

	filters = {
		"used": ["<", "maximum_use"],
	}

	# Filter by customer for gift cards
	if customer:
		filters["customer"] = ["in", [customer, ""]]

	# Get POS Profile company if provided
	if pos_profile:
		profile = frappe.get_doc("POS Profile", pos_profile)
		filters["company"] = profile.company

	coupons = frappe.get_all(
		"POS Coupon",
		filters=filters,
		fields=[
			"name", "coupon_code", "coupon_name", "coupon_type",
			"valid_from", "valid_upto", "pos_offer", "customer",
			"used", "maximum_use", "company"
		],
		order_by="creation desc"
	)

	# Get offer details for each coupon
	for coupon in coupons:
		if coupon.pos_offer:
			try:
				offer = frappe.get_doc("POS Offer", coupon.pos_offer)
				coupon["offer_title"] = offer.title
				coupon["offer_description"] = offer.description
				coupon["discount_percentage"] = offer.discount_percentage
				coupon["discount_amount"] = offer.discount_amount
				coupon["min_amt"] = offer.min_amt
			except Exception:
				pass

	return coupons


@frappe.whitelist()
def create_promotional_coupon(pos_offer, coupon_name, maximum_use=None, valid_from=None, valid_upto=None):
	"""
	Create a promotional coupon code
	"""
	if not frappe.db.table_exists("POS Coupon"):
		frappe.throw("Coupon system not available")

	# Verify POS Offer exists
	if not frappe.db.exists("POS Offer", pos_offer):
		frappe.throw("POS Offer not found")

	offer = frappe.get_doc("POS Offer", pos_offer)

	if not offer.coupon_based:
		frappe.throw("POS Offer must be coupon-based")

	# Create coupon
	coupon = frappe.new_doc("POS Coupon")
	coupon.coupon_name = coupon_name
	coupon.coupon_type = "Promotional"
	coupon.pos_offer = pos_offer
	coupon.company = offer.company

	if maximum_use:
		coupon.maximum_use = maximum_use
	if valid_from:
		coupon.valid_from = valid_from
	if valid_upto:
		coupon.valid_upto = valid_upto

	coupon.insert(ignore_permissions=True)

	return {
		"success": True,
		"coupon_code": coupon.coupon_code,
		"coupon": coupon.as_dict()
	}


@frappe.whitelist()
def create_gift_card(pos_offer, customer, amount=None):
	"""
	Create a gift card coupon for a customer
	"""
	if not frappe.db.table_exists("POS Coupon"):
		frappe.throw("Coupon system not available")

	# Verify POS Offer exists
	if not frappe.db.exists("POS Offer", pos_offer):
		frappe.throw("POS Offer not found")

	offer = frappe.get_doc("POS Offer", pos_offer)

	# Create gift card
	coupon = frappe.new_doc("POS Coupon")
	coupon.coupon_name = frappe.generate_hash()[:10].upper()
	coupon.coupon_type = "Gift Card"
	coupon.pos_offer = pos_offer
	coupon.company = offer.company
	coupon.customer = customer
	coupon.maximum_use = 1

	coupon.insert(ignore_permissions=True)

	return {
		"success": True,
		"coupon_code": coupon.coupon_code,
		"coupon": coupon.as_dict()
	}
