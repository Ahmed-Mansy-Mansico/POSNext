import frappe
import math
import json
from frappe import _

@frappe.whitelist(allow_guest=False)
def get_exception_items():
    try:
        items = frappe.get_all(
            'Pos Exception Items',
            filters={'disable': 0},
            fields=['item_code'],
            order_by='item_code asc'
        )
        
        item_codes = [item.get('item_code') for item in items if item.get('item_code')]
        
        frappe.logger().debug(f"Loaded {len(item_codes)} exception items: {item_codes}")
        
        return item_codes
        
    except Exception as e:
        frappe.log_error(
            title="Error loading POS exception items",
            message=f"Error: {str(e)}"
        )
        return []


def is_exception_item(item_code, exception_list=None):
    if not item_code:
        return False
    
    if exception_list is None:
        exception_list = get_exception_items()
    
    if not exception_list:
        return False
    
    normalized_item = str(item_code).strip().upper()
    normalized_exceptions = [str(code).strip().upper() for code in exception_list]
    
    if normalized_item in normalized_exceptions:
        frappe.logger().debug(f"Item {item_code} is exception (exact match)")
        return True
    
    for exception_code in normalized_exceptions:
        if normalized_item.startswith(exception_code + '-'):
            frappe.logger().debug(f"Item {item_code} is exception (variant of {exception_code})")
            return True
    
    frappe.logger().debug(f"Item {item_code} is normal item")
    return False


@frappe.whitelist()
def apply_any3for249_to_invoice(doc):
    if isinstance(doc, str):
        doc = frappe.get_doc(json.loads(doc))
    
    if not doc.is_pos:
        frappe.logger().debug("Not a POS transaction, skipping offer")
        return doc
    
    exception_items = get_exception_items()
    frappe.logger().info(f"Loaded {len(exception_items)} exception items")
    
    normal_items = []
    exception_count = 0
    
    for item in doc.items:
        if is_exception_item(item.item_code, exception_items):
            exception_count += 1
        else:
            normal_items.append(item)
    
    total_normal_qty = sum(float(item.qty) for item in normal_items)
    
    frappe.logger().info(
        f"Cart analysis: {len(normal_items)} normal items (qty: {total_normal_qty}), "
        f"{exception_count} exception items"
    )
    
    if total_normal_qty < 3:
        frappe.logger().info("Not enough normal items for offer (need 3+)")
        return doc
    
    sets = math.floor(total_normal_qty / 3)
    price_per_set_with_vat = 249.0
    price_per_set_no_vat = price_per_set_with_vat / 1.15
    
    frappe.logger().info(
        f"Offer calculation: {sets} complete sets, "
        f"price per set: {price_per_set_no_vat:.2f} SAR (excl. VAT)"
    )
    
    sets_total = sets * price_per_set_no_vat
    
    remaining_total = 0
    items_in_sets = 0
    
    for item in normal_items:
        qty = float(item.qty)
        original_rate = float(item.price_list_rate or item.rate)
        
        if items_in_sets + qty <= sets * 3:
            items_in_sets += qty
        elif items_in_sets < sets * 3:
            qty_in_sets = (sets * 3) - items_in_sets
            qty_remaining = qty - qty_in_sets
            remaining_total += qty_remaining * original_rate
            items_in_sets += qty
        else:
            remaining_total += qty * original_rate
            items_in_sets += qty
    
    grand_total = sets_total + remaining_total
    new_rate_per_item = grand_total / total_normal_qty
    
    frappe.logger().info(
        f"New pricing: {new_rate_per_item:.2f} SAR per item "
        f"(sets total: {sets_total:.2f}, remaining: {remaining_total:.2f})"
    )
    
    items_updated = 0
    for item in normal_items:
        original_rate = float(item.price_list_rate or item.rate)
        discount_amount = original_rate - new_rate_per_item
        discount_percentage = (discount_amount / original_rate * 100) if original_rate > 0 else 0
        
        item.rate = new_rate_per_item
        item.price_list_rate = original_rate
        item.discount_amount = discount_amount
        item.discount_percentage = discount_percentage
        
        if hasattr(item, 'custom_offer_applied'):
            item.custom_offer_applied = 'Any 3 for 249 SAR'
        
        item.amount = new_rate_per_item * float(item.qty)
        
        items_updated += 1
        
        frappe.logger().debug(
            f"Updated {item.item_code}: rate {original_rate:.2f} → {new_rate_per_item:.2f} "
            f"(discount: {discount_amount:.2f}, {discount_percentage:.1f}%)"
        )
    
    doc.calculate_taxes_and_totals()
    
    doc.add_comment(
        'Comment',
        f"Promotional Offer Applied: Any 3 items for {price_per_set_with_vat} SAR<br>" +
        f"{sets} set(s) applied to {int(sets * 3)} normal items<br>" +
        f"New rate per item: {new_rate_per_item:.2f} SAR (excl. VAT)<br>" +
        f"{exception_count} exception items unchanged"
    )
    
    frappe.msgprint(
        _("Promotional offer applied: Any 3 items for 249 SAR ({0} sets, {1} items)").format(
            sets, int(sets * 3)
        ),
        indicator='green',
        alert=True
    )
    
    frappe.logger().info(
        f"Offer applied successfully: {items_updated} items updated, "
        f"{exception_count} items excluded"
    )
    
    return doc


def auto_apply_any3for249(doc, method=None):
    try:
        apply_any3for249_to_invoice(doc)
    except Exception as e:
        frappe.log_error(
            title="Error applying Any 3 for 249 offer",
            message=f"Invoice: {doc.name}\nError: {str(e)}\n{frappe.get_traceback()}"
        )
        frappe.msgprint(
            _("Warning: Could not apply promotional offer automatically"),
            indicator='orange',
            alert=True
        )