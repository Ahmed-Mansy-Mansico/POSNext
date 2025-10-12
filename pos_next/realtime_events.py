# -*- coding: utf-8 -*-
# Copyright (c) 2024, POS Next and contributors
# For license information, please see license.txt

"""
Real-time event handlers for POS Next.
Emits Socket.IO events when stock-affecting transactions occur.
"""

import frappe
from frappe import _


def emit_stock_update_event(doc, method=None):
	"""
	Emit real-time stock update event when Sales Invoice is submitted.

	This event notifies all connected POS terminals about stock changes,
	allowing them to update their cached item quantities in real-time.

	Args:
		doc: Sales Invoice document
		method: Hook method name (on_submit, on_cancel, etc.)
	"""
	if not doc.update_stock:
		return

	# Skip if not a POS invoice (check if field exists first)
	if hasattr(doc, 'is_pos') and not doc.is_pos:
		return

	try:
		# Collect item-warehouse combinations directly from invoice items
		# This is much faster than querying Bin individually
		item_warehouse_pairs = []
		for item in doc.items:
			if item.warehouse and item.item_code:
				item_warehouse_pairs.append({
					"item_code": item.item_code,
					"warehouse": item.warehouse
				})

		if not item_warehouse_pairs:
			return

		# PERFORMANCE: Single bulk query instead of multiple individual queries
		# Use SQL with IN clause to fetch all stock levels at once
		conditions = " OR ".join([
			f"(item_code = {frappe.db.escape(pair['item_code'])} AND warehouse = {frappe.db.escape(pair['warehouse'])})"
			for pair in item_warehouse_pairs
		])

		stock_data = frappe.db.sql(f"""
			SELECT item_code, warehouse, actual_qty
			FROM `tabBin`
			WHERE {conditions}
		""", as_dict=1)

		# Convert to lookup dict for O(1) access
		stock_lookup = {
			f"{row['item_code']}|{row['warehouse']}": row['actual_qty']
			for row in stock_data
		}

		# Build stock updates with current quantities
		stock_updates = []
		warehouses = set()
		for pair in item_warehouse_pairs:
			key = f"{pair['item_code']}|{pair['warehouse']}"
			actual_qty = stock_lookup.get(key, 0)  # Default to 0 if Bin doesn't exist

			stock_updates.append({
				"item_code": pair['item_code'],
				"warehouse": pair['warehouse'],
				"actual_qty": actual_qty,
				"stock_qty": actual_qty,
			})
			warehouses.add(pair['warehouse'])

		if not stock_updates:
			return

		# Prepare event data
		event_data = {
			"invoice_name": doc.name,
			"warehouses": list(warehouses),
			"stock_updates": stock_updates,
			"timestamp": frappe.utils.now(),
			"event_type": "cancel" if method == "on_cancel" else "submit"
		}

		# Emit event to all connected clients
		# Event name: pos_stock_update
		# Clients can subscribe to this event and filter by warehouse
		frappe.publish_realtime(
			event="pos_stock_update",
			message=event_data,
			user=None,  # Broadcast to all users
			after_commit=True  # Only emit after successful DB commit
		)

	except Exception as e:
		# Log error but don't fail the transaction
		frappe.log_error(
			title=_("Real-time Stock Update Event Error"),
			message=f"Failed to emit stock update event for {doc.name}: {str(e)}"
		)


def emit_invoice_created_event(doc, method=None):
	"""
	Emit real-time event when invoice is created.

	This can be used to notify other terminals about new sales,
	update dashboards, or trigger other real-time UI updates.

	Args:
		doc: Sales Invoice document
		method: Hook method name
	"""
	if not doc.is_pos:
		return

	try:
		event_data = {
			"invoice_name": doc.name,
			"grand_total": doc.grand_total,
			"customer": doc.customer,
			"pos_profile": doc.pos_profile,
			"timestamp": frappe.utils.now(),
		}

		frappe.publish_realtime(
			event="pos_invoice_created",
			message=event_data,
			user=None,
			after_commit=True
		)

	except Exception as e:
		frappe.log_error(
			title=_("Real-time Invoice Created Event Error"),
			message=f"Failed to emit invoice created event for {doc.name}: {str(e)}"
		)
