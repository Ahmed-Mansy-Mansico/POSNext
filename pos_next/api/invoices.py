# -*- coding: utf-8 -*-
# Copyright (c) 2024, POS Next and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import json
import uuid
import frappe
from frappe import _
from frappe.utils import flt, nowdate, nowtime, get_datetime


@frappe.whitelist()
def get_items(pos_profile, search_term=None, item_group=None, start=0, limit=20):
	"""Get items for POS with stock, price, and tax details"""
	try:
		pos_profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)

		filters = {"disabled": 0, "has_variants": 0}

		# Add item group filter if provided
		if item_group:
			filters["item_group"] = item_group

		# Build search conditions
		or_filters = []
		if search_term:
			or_filters = [
				["item_code", "like", f"%{search_term}%"],
				["item_name", "like", f"%{search_term}%"],
				["description", "like", f"%{search_term}%"]
			]

		# Get items
		items = frappe.get_list(
			"Item",
			filters=filters,
			or_filters=or_filters if or_filters else None,
			fields=[
				"name as item_code",
				"item_name",
				"description",
				"stock_uom",
				"image",
				"is_stock_item",
				"has_batch_no",
				"has_serial_no"
			],
			start=start,
			page_length=limit,
			order_by="item_name asc"
		)

		# Enrich items with price and stock data
		for item in items:
			# Get price
			price = frappe.db.get_value(
				"Item Price",
				{
					"item_code": item["item_code"],
					"price_list": pos_profile_doc.selling_price_list
				},
				"price_list_rate"
			)
			item["rate"] = price or 0

			# Get stock if warehouse specified
			if pos_profile_doc.warehouse and item.get("is_stock_item"):
				stock = frappe.db.get_value(
					"Bin",
					{
						"item_code": item["item_code"],
						"warehouse": pos_profile_doc.warehouse
					},
					"actual_qty"
				)
				item["actual_qty"] = stock or 0
			else:
				item["actual_qty"] = 0

		return items
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Items Error")
		frappe.throw(_("Error fetching items: {0}").format(str(e)))


@frappe.whitelist()
def get_item_details(item_code, pos_profile, customer=None, qty=1):
	"""Get detailed item info including price, tax, stock"""
	try:
		from pos_next.api.items import get_item_detail

		pos_profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)
		item_doc = frappe.get_cached_doc("Item", item_code)

		# Prepare item dict
		item = {
			"item_code": item_code,
			"has_batch_no": item_doc.has_batch_no,
			"has_serial_no": item_doc.has_serial_no,
			"is_stock_item": item_doc.is_stock_item,
			"pos_profile": pos_profile,
			"qty": qty
		}

		return get_item_detail(
			item=json.dumps(item),
			warehouse=pos_profile_doc.warehouse,
			price_list=pos_profile_doc.selling_price_list,
			company=pos_profile_doc.company
		)
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Item Details Error")
		frappe.throw(_("Error fetching item details: {0}").format(str(e)))


@frappe.whitelist()
def create_draft_invoice(invoice_data):
	"""Save invoice draft to IndexedDB queue"""
	# For now, we'll return a simple draft ID
	# In future, this can be enhanced to store drafts server-side
	import uuid
	draft_id = str(uuid.uuid4())
	return {"draft_id": draft_id}


@frappe.whitelist()
def submit_invoice(invoice_data):
	"""Create and submit POS Invoice or Sales Invoice"""
	try:
		if isinstance(invoice_data, str):
			invoice_data = json.loads(invoice_data)

		pos_profile = invoice_data.get("pos_profile")
		if not pos_profile:
			frappe.throw(_("POS Profile is required"))

		pos_profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)

		# Get customer - try multiple sources
		customer = invoice_data.get("customer")

		# If customer is a dict, extract the name
		if isinstance(customer, dict):
			customer = customer.get("name") or customer.get("customer_name")

		# Fall back to POS Profile default customer
		if not customer:
			customer = pos_profile_doc.customer

		# If still no customer, throw error
		if not customer:
			frappe.throw(_("Customer is required. Please select a customer or set a default customer in POS Profile."))

		# Create Sales Invoice
		invoice = frappe.new_doc("Sales Invoice")
		invoice.pos_profile = pos_profile
		invoice.customer = customer
		invoice.company = pos_profile_doc.company
		invoice.selling_price_list = pos_profile_doc.selling_price_list
		invoice.currency = pos_profile_doc.currency
		invoice.is_pos = 1
		invoice.is_return = invoice_data.get("is_return", 0)
		invoice.posting_date = nowdate()
		invoice.posting_time = nowtime()

		# Set warehouse
		invoice.set_warehouse = pos_profile_doc.warehouse

		# Add items
		items = invoice_data.get("items", [])
		if not items:
			frappe.throw(_("At least one item is required"))

		for item_data in items:
			item_code = item_data.get("item_code")
			if not item_code:
				continue

			invoice.append("items", {
				"item_code": item_code,
				"qty": flt(item_data.get("qty") or item_data.get("quantity", 1)),
				"rate": flt(item_data.get("rate", 0)),
				"warehouse": item_data.get("warehouse") or pos_profile_doc.warehouse,
				"batch_no": item_data.get("batch_no"),
				"serial_no": item_data.get("serial_no"),
				"uom": item_data.get("uom") or item_data.get("stock_uom"),
				"conversion_factor": flt(item_data.get("conversion_factor", 1)),
			})

		# Calculate totals
		invoice.run_method("calculate_taxes_and_totals")

		# Add payments
		payments = invoice_data.get("payments", [])
		if payments:
			for payment in payments:
				mode_of_payment = payment.get("mode_of_payment")
				amount = flt(payment.get("amount", 0))

				if mode_of_payment and amount > 0:
					# Get payment account from POS Payment Method
					payment_method = frappe.db.get_value(
						"POS Payment Method",
						{"parent": pos_profile, "mode_of_payment": mode_of_payment},
						["default_account", "allow_in_returns"],
						as_dict=1
					)

					if payment_method:
						invoice.append("payments", {
							"mode_of_payment": mode_of_payment,
							"amount": amount,
							"account": payment_method.get("default_account"),
						})

		# Set paid amount and change
		total_paid = sum(flt(p.get("amount", 0)) for p in invoice_data.get("payments", []))
		invoice.paid_amount = total_paid
		invoice.change_amount = max(total_paid - invoice.grand_total, 0)

		# Save invoice
		invoice.insert(ignore_permissions=True)

		# Submit if fully paid
		if invoice.paid_amount >= invoice.grand_total:
			invoice.submit()

		frappe.db.commit()

		return {
			"name": invoice.name,
			"status": "Submitted" if invoice.docstatus == 1 else "Draft",
			"grand_total": invoice.grand_total,
			"outstanding_amount": invoice.outstanding_amount,
			"paid_amount": invoice.paid_amount,
			"change_amount": invoice.change_amount
		}
	except Exception as e:
		frappe.db.rollback()
		frappe.log_error(frappe.get_traceback(), "Submit Invoice Error")
		frappe.throw(_("Error submitting invoice: {0}").format(str(e)))


@frappe.whitelist()
def get_customers(pos_profile, search_term=None, start=0, limit=20):
	"""Get customers for autocomplete"""
	try:
		filters = {"disabled": 0}

		if search_term:
			filters["customer_name"] = ["like", f"%{search_term}%"]

		# Get the customer group from POS Profile if exists
		pos_profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)
		if hasattr(pos_profile_doc, 'customer_group') and pos_profile_doc.customer_group:
			filters["customer_group"] = pos_profile_doc.customer_group

		customers = frappe.get_list(
			"Customer",
			filters=filters,
			fields=["name", "customer_name", "mobile_no", "email_id", "customer_group"],
			start=start,
			page_length=limit,
			order_by="customer_name asc"
		)

		return customers
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Customers Error")
		frappe.throw(_("Error fetching customers: {0}").format(str(e)))


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

		# Get additional details for each payment method
		for method in payment_methods:
			mode_doc = frappe.get_cached_doc("Mode of Payment", method["mode_of_payment"])
			method["type"] = mode_doc.type

		return payment_methods
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Payment Methods Error")
		frappe.throw(_("Error fetching payment methods: {0}").format(str(e)))


@frappe.whitelist()
def apply_offers(invoice_data):
	"""Calculate and apply promotional offers"""
	try:
		if isinstance(invoice_data, str):
			invoice_data = json.loads(invoice_data)

		# For now, return the invoice_data as-is
		# In future, integrate with POSawesome's offer engine
		return invoice_data
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Apply Offers Error")
		frappe.throw(_("Error applying offers: {0}").format(str(e)))


@frappe.whitelist()
def get_item_groups(pos_profile):
	"""Get item groups for filtering"""
	try:
		# Get item groups from POS Profile's item groups table
		item_groups = frappe.db.sql(
			"""
			SELECT DISTINCT ig.item_group
			FROM `tabPOS Item Group` ig
			WHERE ig.parent = %s
			ORDER BY ig.item_group
			""",
			pos_profile,
			as_dict=1
		)

		# If no item groups defined in POS Profile, get all item groups
		if not item_groups:
			item_groups = frappe.get_list(
				"Item Group",
				filters={"is_group": 0},
				fields=["name as item_group"],
				order_by="name",
				limit_page_length=50
			)

		return item_groups
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Item Groups Error")
		frappe.throw(_("Error fetching item groups: {0}").format(str(e)))
