# -*- coding: utf-8 -*-
# Copyright (c) 2024, POS Next and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import json
import frappe
from frappe import _, as_json
from frappe.utils import flt, nowdate
from erpnext.stock.doctype.batch.batch import get_batch_qty
from erpnext.stock.get_item_details import get_item_details


def get_stock_availability(item_code, warehouse):
	"""Return total available quantity for an item in the given warehouse."""
	if not warehouse:
		return 0.0

	warehouses = [warehouse]
	if frappe.db.get_value("Warehouse", warehouse, "is_group"):
		# Include all child warehouses when a group warehouse is set
		warehouses = frappe.db.get_descendants("Warehouse", warehouse) or []

	rows = frappe.get_all(
		"Bin",
		fields=["sum(actual_qty) as actual_qty"],
		filters={"item_code": item_code, "warehouse": ["in", warehouses]},
	)

	return flt(rows[0].actual_qty) if rows else 0.0


def get_item_detail(item, doc=None, warehouse=None, price_list=None, company=None):
	"""Get item detail with batch/serial data and pricing"""
	item = json.loads(item) if isinstance(item, str) else item
	today = nowdate()
	item_code = item.get("item_code")
	batch_no_data = []
	serial_no_data = []

	if warehouse and item.get("has_batch_no"):
		batch_list = get_batch_qty(warehouse=warehouse, item_code=item_code)
		if batch_list:
			for batch in batch_list:
				if batch.qty > 0 and batch.batch_no:
					batch_doc = frappe.get_cached_doc("Batch", batch.batch_no)
					if (
						str(batch_doc.expiry_date) > str(today) or batch_doc.expiry_date in ["", None]
					) and batch_doc.disabled == 0:
						batch_no_data.append(
							{
								"batch_no": batch.batch_no,
								"batch_qty": batch.qty,
								"expiry_date": batch_doc.expiry_date,
								"manufacturing_date": batch_doc.manufacturing_date,
							}
						)

	if warehouse and item.get("has_serial_no"):
		serial_no_data = frappe.get_all(
			"Serial No",
			filters={
				"item_code": item_code,
				"status": "Active",
				"warehouse": warehouse,
			},
			fields=["name as serial_no"],
		)

	item["selling_price_list"] = price_list

	# Handle multi-currency
	if company:
		company_currency = frappe.db.get_value("Company", company, "default_currency")
		price_list_currency = company_currency
		if price_list:
			price_list_currency = (
				frappe.db.get_value("Price List", price_list, "currency") or company_currency
			)

		exchange_rate = 1
		if price_list_currency != company_currency:
			from erpnext.setup.utils import get_exchange_rate
			try:
				exchange_rate = get_exchange_rate(price_list_currency, company_currency, today)
			except Exception:
				frappe.log_error(
					f"Missing exchange rate from {price_list_currency} to {company_currency}",
					"POS Next",
				)

		item["price_list_currency"] = price_list_currency
		item["plc_conversion_rate"] = exchange_rate
		item["conversion_rate"] = exchange_rate

		if doc:
			doc.price_list_currency = price_list_currency
			doc.plc_conversion_rate = exchange_rate
			doc.conversion_rate = exchange_rate

	# Add company and doctype to the item args
	if company:
		item["company"] = company

	item["doctype"] = "Sales Invoice"

	# Create a proper doc structure with company
	if not doc and company:
		doc = frappe._dict({"doctype": "Sales Invoice", "company": company})

	max_discount = frappe.get_value("Item", item_code, "max_discount")
	res = get_item_details(
		item,
		doc,
		overwrite_warehouse=False,
	)

	if item.get("is_stock_item") and warehouse:
		res["actual_qty"] = get_stock_availability(item_code, warehouse)

	res["max_discount"] = max_discount
	res["batch_no_data"] = batch_no_data
	res["serial_no_data"] = serial_no_data

	# Add UOMs data
	uoms = frappe.get_all(
		"UOM Conversion Detail",
		filters={"parent": item_code},
		fields=["uom", "conversion_factor"],
	)

	# Add stock UOM if not already in uoms list
	stock_uom = frappe.db.get_value("Item", item_code, "stock_uom")
	if stock_uom:
		stock_uom_exists = False
		for uom_data in uoms:
			if uom_data.get("uom") == stock_uom:
				stock_uom_exists = True
				break

		if not stock_uom_exists:
			uoms.append({"uom": stock_uom, "conversion_factor": 1.0})

	res["item_uoms"] = uoms

	return res


@frappe.whitelist()
def search_by_barcode(barcode, pos_profile):
	"""Search item by barcode"""
	try:
		# Search for item by barcode
		item_code = frappe.db.get_value("Item Barcode", {"barcode": barcode}, "parent")

		if not item_code:
			# Try searching in item code field directly
			item_code = frappe.db.get_value("Item", {"name": barcode})

		if not item_code:
			frappe.throw(_("Item with barcode {0} not found").format(barcode))

		# Get POS Profile details
		pos_profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)

		# Get item doc
		item_doc = frappe.get_cached_doc("Item", item_code)

		# Prepare item dict for get_item_detail
		item = {
			"item_code": item_code,
			"has_batch_no": item_doc.has_batch_no,
			"has_serial_no": item_doc.has_serial_no,
			"is_stock_item": item_doc.is_stock_item,
			"pos_profile": pos_profile
		}

		# Get item details
		item_details = get_item_detail(
			item=json.dumps(item),
			warehouse=pos_profile_doc.warehouse,
			price_list=pos_profile_doc.selling_price_list,
			company=pos_profile_doc.company
		)

		return item_details
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Search by Barcode Error")
		frappe.throw(_("Error searching by barcode: {0}").format(str(e)))


@frappe.whitelist()
def get_item_stock(item_code, warehouse):
	"""Get real-time stock for item"""
	try:
		from frappe.utils import flt

		# Get actual stock quantity
		stock_qty = frappe.db.get_value(
			"Bin",
			{"item_code": item_code, "warehouse": warehouse},
			"actual_qty"
		) or 0

		# Get reserved quantity
		reserved_qty = frappe.db.get_value(
			"Bin",
			{"item_code": item_code, "warehouse": warehouse},
			"reserved_qty"
		) or 0

		available_qty = flt(stock_qty) - flt(reserved_qty)

		return {
			"item_code": item_code,
			"warehouse": warehouse,
			"stock_qty": flt(stock_qty),
			"reserved_qty": flt(reserved_qty),
			"available_qty": available_qty
		}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Item Stock Error")
		frappe.throw(_("Error fetching item stock: {0}").format(str(e)))


@frappe.whitelist()
def get_batch_serial_details(item_code, warehouse):
	"""Get batch/serial number details"""
	try:
		# Check if item has batch
		has_batch_no = frappe.db.get_value("Item", item_code, "has_batch_no")
		# Check if item has serial
		has_serial_no = frappe.db.get_value("Item", item_code, "has_serial_no")

		result = {
			"item_code": item_code,
			"has_batch_no": has_batch_no,
			"has_serial_no": has_serial_no,
			"batches": [],
			"serial_nos": []
		}

		if has_batch_no:
			# Get available batches
			batches = frappe.db.sql(
				"""
				SELECT batch_no, batch_qty as qty, expiry_date
				FROM `tabBatch`
				WHERE item = %s AND batch_qty > 0
				ORDER BY expiry_date ASC, creation ASC
				""",
				item_code,
				as_dict=1
			)
			result["batches"] = batches

		if has_serial_no:
			# Get available serial numbers
			serial_nos = frappe.db.sql(
				"""
				SELECT name as serial_no, warehouse
				FROM `tabSerial No`
				WHERE item_code = %s AND warehouse = %s AND status = 'Active'
				ORDER BY creation ASC
				""",
				(item_code, warehouse),
				as_dict=1
			)
			result["serial_nos"] = serial_nos

		return result
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Batch/Serial Details Error")
		frappe.throw(_("Error fetching batch/serial details: {0}").format(str(e)))
