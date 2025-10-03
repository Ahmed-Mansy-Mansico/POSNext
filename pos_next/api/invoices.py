# -*- coding: utf-8 -*-
# Copyright (c) 2024, POS Next and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import json
import frappe
from frappe import _
from frappe.utils import flt, cint, nowdate, nowtime, get_datetime
from erpnext.stock.doctype.batch.batch import get_batch_qty, get_batch_no
from erpnext.accounts.doctype.sales_invoice.sales_invoice import get_bank_cash_account


# ==========================================
# Helper Functions
# ==========================================

def get_payment_account(mode_of_payment, company):
	"""
	Get account for mode of payment.
	Tries multiple fallback methods to find a suitable account.
	"""
	# Try 1: Mode of Payment Account table
	account = frappe.db.get_value(
		"Mode of Payment Account",
		{"parent": mode_of_payment, "company": company},
		"default_account"
	)
	if account:
		return {"account": account}

	# Try 2: POS Payment Method from POS Profile
	account = frappe.db.sql("""
		SELECT ppm.default_account
		FROM `tabPOS Payment Method` ppm
		INNER JOIN `tabPOS Profile` pp ON ppm.parent = pp.name
		WHERE ppm.mode_of_payment = %s
		AND pp.company = %s
		AND ppm.default_account IS NOT NULL
		LIMIT 1
	""", (mode_of_payment, company), as_dict=1)

	if account and account[0].default_account:
		return {"account": account[0].default_account}

	# Try 3: Company default cash account (for cash payments)
	if "cash" in mode_of_payment.lower():
		account = frappe.get_value("Company", company, "default_cash_account")
		if account:
			return {"account": account}

	# Try 4: Company default bank account
	account = frappe.get_value("Company", company, "default_bank_account")
	if account:
		return {"account": account}

	# Try 5: Any Cash/Bank account for the company
	account = frappe.db.get_value(
		"Account",
		{
			"company": company,
			"account_type": ["in", ["Cash", "Bank"]],
			"is_group": 0
		},
		"name"
	)
	if account:
		return {"account": account}

	# No account found - throw error
	frappe.throw(
		_("Please set default Cash or Bank account in Mode of Payment {0} or set default accounts in Company {1}").format(
			mode_of_payment, company
		),
		title=_("Missing Account"),
	)


# ==========================================
# Stock Validation Functions (from POSAwesome)
# ==========================================

def _get_available_stock(item):
	"""Return available stock qty for an item row."""
	warehouse = item.get("warehouse")
	batch_no = item.get("batch_no")
	item_code = item.get("item_code")

	if not item_code or not warehouse:
		return 0

	if batch_no:
		return get_batch_qty(batch_no, warehouse) or 0

	# Get stock from Bin
	bin_qty = frappe.db.get_value(
		"Bin",
		{"item_code": item_code, "warehouse": warehouse},
		"actual_qty"
	)
	return flt(bin_qty) or 0


def _collect_stock_errors(items):
	"""Return list of items exceeding available stock."""
	errors = []
	for d in items:
		if flt(d.get("qty")) < 0:
			continue

		available = _get_available_stock(d)
		requested = flt(d.get("stock_qty") or (flt(d.get("qty")) * flt(d.get("conversion_factor") or 1)))

		if requested > available:
			errors.append({
				"item_code": d.get("item_code"),
				"warehouse": d.get("warehouse"),
				"requested_qty": requested,
				"available_qty": available,
			})

	return errors


def _should_block(pos_profile):
	"""Check if sale should be blocked for insufficient stock."""
	allow_negative = cint(frappe.db.get_single_value("Stock Settings", "allow_negative_stock") or 0)
	if allow_negative:
		return False

	# Check POS Profile setting if it exists
	block_sale = 1  # Default to blocking
	if pos_profile:
		# Try to get custom field from POSAwesome (may not exist in vanilla ERPNext)
		block_sale = cint(
			frappe.db.get_value(
				"POS Profile",
				pos_profile,
				"posa_block_sale_beyond_available_qty"
			) or 1
		)

	return bool(block_sale)


def _validate_stock_on_invoice(invoice_doc):
	"""Validate stock availability before submission."""
	if invoice_doc.doctype == "Sales Invoice" and not cint(getattr(invoice_doc, "update_stock", 0)):
		return

	# Collect all stock items to check
	items_to_check = [d.as_dict() for d in invoice_doc.items if d.get("is_stock_item")]

	# Include packed items if present
	if hasattr(invoice_doc, "packed_items"):
		items_to_check.extend([d.as_dict() for d in invoice_doc.packed_items])

	# Check for stock errors
	errors = _collect_stock_errors(items_to_check)

	# Throw error if stock insufficient and blocking is enabled
	if errors and _should_block(invoice_doc.pos_profile):
		frappe.throw(frappe.as_json({"errors": errors}), frappe.ValidationError)


def _auto_set_return_batches(invoice_doc):
	"""Assign batch numbers for return invoices without a source invoice.

	When an item requires a batch number, this function allocates the first
	available batch in FIFO order. If no batches exist in the selected
	warehouse, an informative error is raised.
	"""
	if not invoice_doc.is_return or invoice_doc.get("return_against"):
		return

	for d in invoice_doc.items:
		if not d.get("item_code") or not d.get("warehouse"):
			continue

		has_batch = frappe.db.get_value("Item", d.item_code, "has_batch_no")
		if has_batch and not d.get("batch_no"):
			batch_list = get_batch_qty(item_code=d.item_code, warehouse=d.warehouse) or []
			batch_list = [b for b in batch_list if flt(b.get("qty")) > 0]

			if batch_list:
				# FIFO: batches are already sorted by posting/expiry in ERPNext
				d.batch_no = batch_list[0].get("batch_no")
			else:
				frappe.throw(_("No batches available in {0} for {1}.").format(d.warehouse, d.item_code))


# ==========================================
# Validation Functions
# ==========================================

@frappe.whitelist()
def validate_cart_items(items, pos_profile=None):
	"""Validate cart items for available stock.

	Returns a list of item dicts where requested quantity exceeds availability.
	This can be used on the front-end for pre-submission checks.
	"""
	if isinstance(items, str):
		items = json.loads(items)

	if pos_profile and not frappe.db.exists("POS Profile", pos_profile):
		pos_profile = None

	if not _should_block(pos_profile):
		return []

	errors = _collect_stock_errors(items)
	if not errors:
		return []

	return errors


@frappe.whitelist()
def validate_return_items(original_invoice_name, return_items, doctype="Sales Invoice"):
	"""Ensure that return items do not exceed the quantity from the original invoice."""
	original_invoice = frappe.get_doc(doctype, original_invoice_name)
	original_item_qty = {}

	for item in original_invoice.items:
		original_item_qty[item.item_code] = original_item_qty.get(item.item_code, 0) + item.qty

	# Get all returned items from this invoice
	returned_items = frappe.get_all(
		doctype,
		filters={
			"return_against": original_invoice_name,
			"docstatus": 1,
			"is_return": 1,
		},
		fields=["name"],
	)

	for returned_invoice in returned_items:
		ret_doc = frappe.get_doc(doctype, returned_invoice.name)
		for item in ret_doc.items:
			if item.item_code in original_item_qty:
				original_item_qty[item.item_code] -= abs(item.qty)

	# Validate new return items
	for item in return_items:
		item_code = item.get("item_code")
		return_qty = abs(item.get("qty", 0))
		if item_code in original_item_qty and return_qty > original_item_qty[item_code]:
			return {
				"valid": False,
				"message": _("You are trying to return more quantity for item {0} than was sold.").format(item_code)
			}

	return {"valid": True}


# ==========================================
# Invoice Management (Two-Step Flow)
# ==========================================

@frappe.whitelist()
def update_invoice(data):
	"""Create or update invoice draft (Step 1)."""
	try:
		data = json.loads(data) if isinstance(data, str) else data

		pos_profile = data.get("pos_profile")
		doctype = "Sales Invoice"

		# Ensure the document type is set
		data.setdefault("doctype", doctype)

		# Create or update invoice
		if data.get("name"):
			invoice_doc = frappe.get_doc(doctype, data.get("name"))
			invoice_doc.update(data)
		else:
			invoice_doc = frappe.get_doc(data)


		pos_profile_doc = None
		if pos_profile:
			try:
				pos_profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)
			except Exception as profile_err:
				frappe.throw(_("Unable to load POS Profile {0}").format(pos_profile))

			invoice_doc.pos_profile = pos_profile

			if pos_profile_doc.company and not invoice_doc.get("company"):
				invoice_doc.company = pos_profile_doc.company
			if pos_profile_doc.currency and not invoice_doc.get("currency"):
				invoice_doc.currency = pos_profile_doc.currency

		company = invoice_doc.get("company") or (pos_profile_doc.company if pos_profile_doc else None)

		if company and invoice_doc.get("payments"):
			for payment in invoice_doc.payments:
				if payment.mode_of_payment and not payment.get("account"):
					try:
						account_info = get_payment_account(payment.mode_of_payment, company)
						payment.account = account_info.get("account")
					except Exception:
						pass  # Will be handled during save

		# Validate return items if this is a return invoice
		if (data.get("is_return") or invoice_doc.is_return) and invoice_doc.get("return_against"):
			validation = validate_return_items(
				invoice_doc.return_against,
				[d.as_dict() for d in invoice_doc.items],
				doctype=invoice_doc.doctype,
			)
			if not validation.get("valid"):
				frappe.throw(validation.get("message"))

		# Ensure customer exists
		customer_name = invoice_doc.get("customer")
		if customer_name and not frappe.db.exists("Customer", customer_name):
			try:
				cust = frappe.get_doc({
					"doctype": "Customer",
					"customer_name": customer_name,
					"customer_group": "All Customer Groups",
					"territory": "All Territories",
					"customer_type": "Individual",
				})
				cust.flags.ignore_permissions = True
				cust.insert()
				invoice_doc.customer = cust.name
				invoice_doc.customer_name = cust.customer_name
			except Exception as e:
				frappe.log_error(f"Failed to create customer {customer_name}: {e}")

		# Set missing values
		invoice_doc.ignore_pricing_rule = 1
		invoice_doc.flags.ignore_pricing_rule = True
		invoice_doc.set_missing_values()

		# Set as POS invoice
		invoice_doc.is_pos = 1

		# Important: Set update_stock flag for stock updates
		invoice_doc.update_stock = 1

		# Set accounts for payment methods before saving
		for payment in invoice_doc.payments:
			if payment.mode_of_payment and not payment.get('account'):
				try:
					account_info = get_payment_account(payment.mode_of_payment, invoice_doc.company)
					payment.account = account_info['account']
				except Exception:
					pass  # Will be handled during save

		# For return invoices, ensure payments are negative
		if invoice_doc.is_return:
			for payment in invoice_doc.payments:
				payment.amount = -abs(payment.amount)
				if payment.base_amount:
					payment.base_amount = -abs(payment.base_amount)

			invoice_doc.paid_amount = flt(sum(p.amount for p in invoice_doc.payments))
			invoice_doc.base_paid_amount = flt(sum(p.base_amount or 0 for p in invoice_doc.payments))

		# Save as draft
		invoice_doc.flags.ignore_permissions = True
		frappe.flags.ignore_account_permission = True
		invoice_doc.docstatus = 0
		invoice_doc.save()

		return invoice_doc.as_dict()
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Update Invoice Error")
		raise


@frappe.whitelist()
def submit_invoice(invoice=None, data=None):
	"""Submit the invoice (Step 2)."""
	try:

		# Handle different calling conventions
		if invoice is None:
			if data:
				# Check if data is a JSON string containing both params
				data_parsed = json.loads(data) if isinstance(data, str) else data

				# frappe-ui might send all params nested in data
				if isinstance(data_parsed, dict):
					if "invoice" in data_parsed:
						invoice = data_parsed.get("invoice")
						data = data_parsed.get("data", {})
					elif "name" in data_parsed or "doctype" in data_parsed:
						# Data itself might be the invoice
						invoice = data_parsed
						data = {}
					else:
						frappe.throw(_("Missing invoice parameter. Received data: {0}").format(json.dumps(data_parsed, default=str)))
				else:
					frappe.throw(_("Missing invoice parameter"))
			else:
				frappe.throw(_("Both invoice and data parameters are missing"))


		# Parse JSON strings if needed
		if isinstance(data, str):
			data = json.loads(data) if data and data != '{}' else {}
		if isinstance(invoice, str):
			invoice = json.loads(invoice)


		pos_profile = invoice.get("pos_profile")
		doctype = "Sales Invoice"

		invoice_name = invoice.get("name")

		# Get or create invoice
		if not invoice_name or not frappe.db.exists(doctype, invoice_name):
			created = update_invoice(json.dumps(invoice))
			invoice_name = created.get("name")
			invoice_doc = frappe.get_doc(doctype, invoice_name)
		else:
			invoice_doc = frappe.get_doc(doctype, invoice_name)
			invoice_doc.update(invoice)

		# Ensure update_stock is set
		invoice_doc.update_stock = 1

		# Set accounts for all payment methods before saving
		for payment in invoice_doc.payments:
			if payment.mode_of_payment:
				account_info = get_payment_account(payment.mode_of_payment, invoice_doc.company)
				payment.account = account_info['account']

		# Auto-set batch numbers for returns
		_auto_set_return_batches(invoice_doc)

		# Validate stock availability
		_validate_stock_on_invoice(invoice_doc)

		# Save before submit
		invoice_doc.flags.ignore_permissions = True
		frappe.flags.ignore_account_permission = True
		invoice_doc.save()

		# Submit invoice
		invoice_doc.submit()


		# Return complete invoice details
		return {
			"name": invoice_doc.name,
			"status": invoice_doc.docstatus,
			"grand_total": invoice_doc.grand_total,
			"total": invoice_doc.total,
			"net_total": invoice_doc.net_total,
			"outstanding_amount": invoice_doc.outstanding_amount,
			"paid_amount": invoice_doc.paid_amount,
			"change_amount": getattr(invoice_doc, 'change_amount', 0),
		}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Submit Invoice Error")
		raise


# ==========================================
# Draft Invoice Management
# ==========================================

@frappe.whitelist()
def get_draft_invoices(pos_opening_shift, doctype="Sales Invoice"):
	"""Get all draft invoices for a POS opening shift."""
	filters = {
		"docstatus": 0,
	}

	# Add pos_opening_shift filter if the field exists
	if frappe.db.has_column(doctype, "pos_opening_shift"):
		filters["pos_opening_shift"] = pos_opening_shift

	invoices_list = frappe.get_list(
		doctype,
		filters=filters,
		fields=["name"],
		limit_page_length=0,
		order_by="modified desc",
	)

	data = []
	for invoice in invoices_list:
		data.append(frappe.get_cached_doc(doctype, invoice["name"]))

	return data


@frappe.whitelist()
def delete_invoice(invoice):
	"""Delete draft invoice."""
	doctype = "Sales Invoice"

	if not frappe.db.exists(doctype, invoice):
		frappe.throw(_("Invoice {0} does not exist").format(invoice))

	# Check if it's a draft
	if frappe.db.get_value(doctype, invoice, "docstatus") != 0:
		frappe.throw(_("Cannot delete submitted invoice {0}").format(invoice))

	frappe.delete_doc(doctype, invoice, force=1)
	return _("Invoice {0} Deleted").format(invoice)


# ==========================================
# Return Invoice Management
# ==========================================

@frappe.whitelist()
def get_returnable_invoices(limit=50):
	"""Get list of invoices that have items available for return."""
	# Get submitted non-return POS invoices
	invoices = frappe.get_all(
		"Sales Invoice",
		filters={
			"docstatus": 1,
			"is_return": 0,
			"is_pos": 1
		},
		fields=["name", "customer", "customer_name", "posting_date", "grand_total", "status"],
		order_by="posting_date desc, creation desc",
		limit_page_length=cint(limit)
	)

	returnable_invoices = []

	for invoice in invoices:
		# Check if this invoice has any items left to return
		# Get all return invoices against this invoice
		return_invoices = frappe.get_all(
			"Sales Invoice",
			filters={
				"return_against": invoice.name,
				"docstatus": 1,
				"is_return": 1
			},
			fields=["name"]
		)

		# If no returns yet, it's returnable
		if not return_invoices:
			returnable_invoices.append(invoice)
			continue

		# Check if there are any items with remaining qty
		invoice_doc = frappe.get_doc("Sales Invoice", invoice.name)

		# Calculate returned quantities
		returned_qty = {}
		for ret_inv in return_invoices:
			ret_doc = frappe.get_doc("Sales Invoice", ret_inv.name)
			for item in ret_doc.items:
				key = item.sales_invoice_item or item.item_code
				if key:
					returned_qty[key] = returned_qty.get(key, 0) + abs(item.qty)

		# Check if any items have remaining quantity
		has_returnable_items = False
		for item in invoice_doc.items:
			already_returned = returned_qty.get(item.name, 0)
			remaining_qty = item.qty - already_returned
			if remaining_qty > 0:
				has_returnable_items = True
				break

		if has_returnable_items:
			returnable_invoices.append(invoice)

	return returnable_invoices


@frappe.whitelist()
def get_invoice_for_return(invoice_name):
	"""Get invoice with return tracking - calculates remaining qty for each item."""
	if not frappe.db.exists("Sales Invoice", invoice_name):
		frappe.throw(_("Invoice {0} does not exist").format(invoice_name))

	# Get the original invoice
	invoice = frappe.get_doc("Sales Invoice", invoice_name)

	# Get all return invoices against this invoice
	return_invoices = frappe.get_all(
		"Sales Invoice",
		filters={
			"return_against": invoice_name,
			"docstatus": 1,
			"is_return": 1
		},
		fields=["name"]
	)

	# Calculate returned quantities per item
	returned_qty = {}
	for ret_inv in return_invoices:
		ret_doc = frappe.get_doc("Sales Invoice", ret_inv.name)
		for item in ret_doc.items:
			# Match by sales_invoice_item reference or item_code
			key = item.sales_invoice_item or item.item_code
			if key:
				returned_qty[key] = returned_qty.get(key, 0) + abs(item.qty)

	# Calculate remaining quantities
	invoice_dict = invoice.as_dict()
	updated_items = []

	for item in invoice_dict.get("items", []):
		# Check how much has been returned using the item's name (row ID)
		already_returned = returned_qty.get(item.name, 0)
		remaining_qty = item.qty - already_returned

		if remaining_qty > 0:
			item_copy = item.copy()
			item_copy["original_qty"] = item.qty
			item_copy["qty"] = remaining_qty
			item_copy["already_returned"] = already_returned
			updated_items.append(item_copy)

	invoice_dict["items"] = updated_items
	return invoice_dict


@frappe.whitelist()
def search_invoices_for_return(
	invoice_name=None,
	company=None,
	customer_name=None,
	customer_id=None,
	mobile_no=None,
	from_date=None,
	to_date=None,
	min_amount=None,
	max_amount=None,
	page=1,
	doctype="Sales Invoice",
):
	"""Search for invoices that can be returned with pagination."""
	# Start with base filters
	filters = {
		"docstatus": 1,
		"is_return": 0,
	}

	if company:
		filters["company"] = company

	# Convert page to integer
	if page and isinstance(page, str):
		page = int(page)
	else:
		page = 1

	# Items per page
	page_length = 100
	start = (page - 1) * page_length

	# Add invoice name filter
	if invoice_name:
		filters["name"] = ["like", f"%{invoice_name}%"]

	# Add date range filters
	if from_date:
		filters["posting_date"] = [">=", from_date]

	if to_date:
		if "posting_date" in filters:
			filters["posting_date"] = ["between", [from_date, to_date]]
		else:
			filters["posting_date"] = ["<=", to_date]

	# Add amount filters
	if min_amount:
		filters["grand_total"] = [">=", float(min_amount)]

	if max_amount:
		if "grand_total" in filters:
			filters["grand_total"] = ["between", [float(min_amount), float(max_amount)]]
		else:
			filters["grand_total"] = ["<=", float(max_amount)]

	# If any customer search criteria is provided, find matching customers
	customer_ids = []
	if customer_name or customer_id or mobile_no:
		conditions = []
		params = {}

		if customer_name:
			conditions.append("customer_name LIKE %(customer_name)s")
			params["customer_name"] = f"%{customer_name}%"

		if customer_id:
			conditions.append("name LIKE %(customer_id)s")
			params["customer_id"] = f"%{customer_id}%"

		if mobile_no:
			conditions.append("mobile_no LIKE %(mobile_no)s")
			params["mobile_no"] = f"%{mobile_no}%"

		where_clause = " OR ".join(conditions)
		customer_query = f"""
			SELECT name
			FROM `tabCustomer`
			WHERE {where_clause}
			LIMIT 100
		"""

		customers = frappe.db.sql(customer_query, params, as_dict=True)
		customer_ids = [c.name for c in customers]

		if customer_ids:
			filters["customer"] = ["in", customer_ids]
		elif any([customer_name, customer_id, mobile_no]):
			return {"invoices": [], "has_more": False}

	# Count total invoices
	total_count_query = frappe.get_list(
		doctype,
		filters=filters,
		fields=["count(name) as total_count"],
		as_list=False,
	)
	total_count = total_count_query[0].total_count if total_count_query else 0

	# Get invoices with pagination
	invoices_list = frappe.get_list(
		doctype,
		filters=filters,
		fields=["name"],
		limit_start=start,
		limit_page_length=page_length,
		order_by="posting_date desc, name desc",
	)

	# Process and return results
	data = []

	for invoice in invoices_list:
		invoice_doc = frappe.get_doc(doctype, invoice.name)

		# Check if any items have already been returned
		has_returns = frappe.get_all(
			doctype,
			filters={"return_against": invoice.name, "docstatus": 1},
			fields=["name"],
		)

		if has_returns:
			# Calculate returned quantity per item_code
			returned_qty = {}
			for ret_inv in has_returns:
				ret_doc = frappe.get_doc(doctype, ret_inv.name)
				for item in ret_doc.items:
					returned_qty[item.item_code] = returned_qty.get(item.item_code, 0) + abs(item.qty)

			# Filter items with remaining qty
			filtered_items = []
			for item in invoice_doc.items:
				remaining_qty = item.qty - returned_qty.get(item.item_code, 0)
				if remaining_qty > 0:
					new_item = item.as_dict().copy()
					new_item["qty"] = remaining_qty
					new_item["amount"] = remaining_qty * item.rate
					if item.get("stock_qty"):
						new_item["stock_qty"] = (
							item.stock_qty / item.qty * remaining_qty if item.qty else remaining_qty
						)
					filtered_items.append(frappe._dict(new_item))

			if filtered_items:
				filtered_invoice = frappe.get_doc(doctype, invoice.name)
				filtered_invoice.items = filtered_items
				data.append(filtered_invoice)
		else:
			data.append(invoice_doc)

	# Check if there are more results
	has_more = (start + page_length) < total_count

	return {"invoices": data, "has_more": has_more}


# ==========================================
# Legacy/Helper Functions
# ==========================================

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
