# -*- coding: utf-8 -*-
# Copyright (c) 2025, POS Next and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, nowdate, getdate


@frappe.whitelist()
def get_offers(pos_profile):
    """Fetch auto-applicable offers for the POS profile."""
    profile = frappe.get_doc("POS Profile", pos_profile)
    date = nowdate()

    # Promotional Schemes generate pricing rules automatically, so we
    # only need to fetch the relevant pricing rules.
    return _get_pricing_rules(profile, date)


def _get_pricing_rules(pos_profile, date):
    """Return Pricing Rules generated via Promotional Schemes with slab details."""
    filters = {
        "company": pos_profile.company,
        "date": date,
    }

    # Fetch pricing rules
    pricing_rules = frappe.db.sql(
        """
        SELECT
                name, title, apply_on, selling, promotional_scheme,
                promotional_scheme_id, coupon_code_based,
                price_or_product_discount,
                priority, valid_from, valid_upto
        FROM `tabPricing Rule`
        WHERE
                disable = 0
                AND selling = 1
                AND promotional_scheme IS NOT NULL
                AND company = %(company)s
                AND (valid_from IS NULL OR valid_from <= %(date)s)
                AND (valid_upto IS NULL OR valid_upto >= %(date)s)
        ORDER BY priority DESC, name
        """,
        filters,
        as_dict=1,
    ) or []

    offers = []
    for rule in pricing_rules:
        # Get slab details based on discount type
        if rule.price_or_product_discount == "Price":
            # Fetch from Promotional Scheme Price Discount slabs
            slabs = frappe.db.sql(
                """
                SELECT
                    min_qty, max_qty, min_amount, max_amount,
                    rate_or_discount, rate, discount_amount, discount_percentage,
                    apply_multiple_pricing_rules
                FROM `tabPromotional Scheme Price Discount`
                WHERE parent = %(scheme)s AND disable = 0
                ORDER BY min_amount ASC, min_qty ASC
                LIMIT 1
                """,
                {"scheme": rule.promotional_scheme},
                as_dict=1,
            )
        else:
            # Fetch from Promotional Scheme Product Discount slabs
            slabs = frappe.db.sql(
                """
                SELECT
                    min_qty, max_qty, min_amount, max_amount,
                    apply_multiple_pricing_rules
                FROM `tabPromotional Scheme Product Discount`
                WHERE parent = %(scheme)s AND disable = 0
                ORDER BY min_amount ASC, min_qty ASC
                LIMIT 1
                """,
                {"scheme": rule.promotional_scheme},
                as_dict=1,
            )

        # Skip if no slabs found
        if not slabs:
            continue

        slab = slabs[0]

        # Determine if offer should auto-apply:
        # - Coupon-based offers are NEVER auto (must enter coupon code)
        # - Offers with apply_multiple_pricing_rules enabled are manual selection
        # - Otherwise, can auto-apply
        is_auto = 0
        if not rule.coupon_code_based:
            # Only non-coupon offers can be auto-apply
            # If apply_multiple_pricing_rules is not enabled, it's auto
            if not slab.apply_multiple_pricing_rules:
                is_auto = 1

        # Get eligible items/groups for this promotional scheme
        eligible_items = []
        eligible_item_groups = []
        eligible_brands = []

        if rule.apply_on == "Item Code":
            eligible_items = frappe.db.sql_list(
                """SELECT item_code FROM `tabPricing Rule Item Code`
                WHERE parent = %s""",
                rule.promotional_scheme
            )
        elif rule.apply_on == "Item Group":
            eligible_item_groups = frappe.db.sql_list(
                """SELECT item_group FROM `tabPricing Rule Item Group`
                WHERE parent = %s""",
                rule.promotional_scheme
            )
        elif rule.apply_on == "Brand":
            eligible_brands = frappe.db.sql_list(
                """SELECT brand FROM `tabPricing Rule Brand`
                WHERE parent = %s""",
                rule.promotional_scheme
            )

        offer = {
            "name": rule.name,
            "title": rule.title or rule.promotional_scheme or rule.name,
            "description": rule.title or rule.promotional_scheme,
            "apply_on": rule.apply_on,
            "offer": "Item Price" if rule.price_or_product_discount == "Price" else "Give Product",
            "auto": is_auto,
            "coupon_based": 1 if rule.coupon_code_based else 0,
            # Use min/max from slab
            "min_qty": flt(slab.min_qty),
            "max_qty": flt(slab.max_qty),
            "min_amt": flt(slab.min_amount),
            "max_amt": flt(slab.max_amount),
            # Discount info from slab (for price discounts)
            "discount_type": slab.rate_or_discount if rule.price_or_product_discount == "Price" else None,
            "rate": flt(slab.rate) if rule.price_or_product_discount == "Price" else 0,
            "discount_amount": flt(slab.discount_amount) if rule.price_or_product_discount == "Price" else 0,
            "discount_percentage": flt(slab.discount_percentage) if rule.price_or_product_discount == "Price" else 0,
            # Validity from pricing rule
            "valid_from": rule.valid_from,
            "valid_upto": rule.valid_upto,
            "source": "Promotional Scheme",
            "promotional_scheme": rule.promotional_scheme,
            "promotional_scheme_id": rule.promotional_scheme_id,
            # Eligibility criteria
            "eligible_items": eligible_items,
            "eligible_item_groups": eligible_item_groups,
            "eligible_brands": eligible_brands,
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
