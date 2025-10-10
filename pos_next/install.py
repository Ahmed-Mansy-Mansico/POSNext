"""
Installation and Migration hooks for POS Next
"""
import frappe
from frappe import _
from frappe.utils import cint


def after_install():
	"""Hook that runs after app installation"""
	try:
		print("Installing POS Next fixtures...")
		install_fixtures()
		setup_default_print_format()
		frappe.db.commit()
		print("POS Next installation completed successfully!")
	except Exception as e:
		frappe.log_error(
			title="POS Next Installation Error",
			message=frappe.get_traceback()
		)
		print(f"Error during POS Next installation: {str(e)}")


def after_migrate():
	"""Hook that runs after bench migrate"""
	try:
		print("Updating POS Next fixtures after migration...")
		install_fixtures()
		setup_default_print_format()
		frappe.db.commit()
		print("POS Next migration completed successfully!")
	except Exception as e:
		frappe.log_error(
			title="POS Next Migration Error",
			message=frappe.get_traceback()
		)
		print(f"Error during POS Next migration: {str(e)}")


def install_fixtures():
	"""
	Install or update fixtures from JSON files
	This includes custom fields, print formats, etc.
	"""
	import os
	import json
	from frappe.core.doctype.data_import.data_import import import_doc

	fixtures_path = frappe.get_app_path("pos_next", "fixtures")

	if not os.path.exists(fixtures_path):
		print(f"Fixtures directory not found: {fixtures_path}")
		return

	# Install print format fixture
	print_format_file = os.path.join(fixtures_path, "print_format.json")
	if os.path.exists(print_format_file):
		try:
			with open(print_format_file, 'r') as f:
				print_formats = json.load(f)

			for pf in print_formats:
				install_print_format(pf)

			print(f"✓ Installed print formats from {print_format_file}")
		except Exception as e:
			print(f"✗ Error installing print formats: {str(e)}")
			frappe.log_error(
				title="Print Format Installation Error",
				message=frappe.get_traceback()
			)

	# Install custom field fixture (if exists)
	custom_field_file = os.path.join(fixtures_path, "custom_field.json")
	if os.path.exists(custom_field_file):
		try:
			with open(custom_field_file, 'r') as f:
				custom_fields = json.load(f)

			for cf in custom_fields:
				install_custom_field(cf)

			print(f"✓ Installed custom fields from {custom_field_file}")
		except Exception as e:
			print(f"✗ Error installing custom fields: {str(e)}")


def install_print_format(doc_dict):
	"""
	Install or update a print format from dict
	Clean solution: Delete and recreate if exists
	"""
	try:
		name = doc_dict.get("name")

		if frappe.db.exists("Print Format", name):
			# Delete existing print format
			frappe.delete_doc("Print Format", name, force=True, ignore_permissions=True)
			print(f"  − Deleted existing Print Format: {name}")

		# Create fresh print format
		doc = frappe.get_doc(doc_dict)
		doc.flags.ignore_permissions = True
		doc.flags.ignore_mandatory = True
		doc.insert()
		print(f"  + Created Print Format: {doc.name}")

		return doc
	except Exception as e:
		print(f"  ✗ Error installing print format {doc_dict.get('name')}: {str(e)}")
		frappe.log_error(
			title=f"Print Format Installation Error: {doc_dict.get('name')}",
			message=frappe.get_traceback()
		)


def install_custom_field(doc_dict):
	"""
	Install or update a custom field from dict
	Clean solution: Delete and recreate if exists
	"""
	try:
		name = doc_dict.get("name")

		if frappe.db.exists("Custom Field", name):
			# Delete existing custom field
			frappe.delete_doc("Custom Field", name, force=True, ignore_permissions=True)
			print(f"  − Deleted existing Custom Field: {name}")

		# Create fresh custom field
		doc = frappe.get_doc(doc_dict)
		doc.flags.ignore_permissions = True
		doc.flags.ignore_mandatory = True
		doc.insert()
		print(f"  + Created Custom Field: {doc.name}")

		return doc
	except Exception as e:
		print(f"  ✗ Error installing custom field {doc_dict.get('name')}: {str(e)}")


def setup_default_print_format():
	"""
	Set POS Next Receipt as default print format for POS Profiles if not already set
	"""
	try:
		# Check if the print format exists
		if not frappe.db.exists("Print Format", "POS Next Receipt"):
			print("POS Next Receipt print format not found, skipping default setup")
			return

		# Get all POS Profiles without a print format
		pos_profiles = frappe.get_all(
			"POS Profile",
			filters={"print_format": ["in", ["", None]]},
			fields=["name"]
		)

		if pos_profiles:
			for profile in pos_profiles:
				try:
					doc = frappe.get_doc("POS Profile", profile.name)
					doc.print_format = "POS Next Receipt"
					doc.flags.ignore_permissions = True
					doc.flags.ignore_mandatory = True
					doc.save()
					print(f"  ↻ Set default print format for POS Profile: {profile.name}")
				except Exception as e:
					print(f"  ✗ Error updating POS Profile {profile.name}: {str(e)}")
		else:
			print("  ℹ All POS Profiles already have a print format set")

	except Exception as e:
		print(f"✗ Error setting up default print format: {str(e)}")
		frappe.log_error(
			title="Default Print Format Setup Error",
			message=frappe.get_traceback()
		)
