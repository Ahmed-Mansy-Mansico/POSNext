# -*- coding: utf-8 -*-
# Copyright (c) 2024, POS Next and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _


def validate_item(doc, method):
	"""
	Validate Item doctype
	- Make company field mandatory for new items only
	- Allow existing items with empty company (global items)
	"""
	# Only enforce company for new items
	if doc.is_new():
		if not doc.get("custom_company"):
			frappe.throw(_("Company is mandatory for new items. Leave empty only for global items that were created before this validation."))


def item_query(doctype, txt, searchfield, start, page_len, filters):
	"""
	Custom query to filter items by company
	- If company is specified in filters, show:
	  1. Items belonging to that company
	  2. Global items (where posa_company is empty)
	- If no company specified, show all items
	"""
	conditions = ["disabled = 0"]
	values = []

	if txt:
		conditions.append(f"({searchfield} LIKE %s OR item_name LIKE %s)")
		values.extend([f"%{txt}%", f"%{txt}%"])

	company = filters.get("company") if filters else None

	if company:
		# Show items for specific company + global items
		conditions.append("(custom_company = %s OR custom_company IS NULL OR custom_company = '')")
		values.append(company)

	query = f"""
		SELECT name, item_name, item_group
		FROM `tabItem`
		WHERE {' AND '.join(conditions)}
		ORDER BY
			CASE WHEN name LIKE %s THEN 0 ELSE 1 END,
			item_name
		LIMIT %s, %s
	"""

	values.extend([f"{txt}%", start, page_len])

	return frappe.db.sql(query, values)
