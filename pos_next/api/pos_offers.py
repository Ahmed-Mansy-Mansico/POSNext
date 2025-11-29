import frappe

@frappe.whitelist(allow_guest=False)
def get_exception_items():
    """
    Get list of active exception item codes for POS offers.
    Returns a simple list of item codes.
    """
    try:
        items = frappe.get_all(
            'Pos Exception Items',
            filters={'disable': 0},
            fields=['item_code'],
            order_by='item_code asc'
        )
        
        # Return just the item codes as a simple list
        item_codes = [item.get('item_code') for item in items if item.get('item_code')]
        
        frappe.logger().debug(f"Loaded {len(item_codes)} exception items: {item_codes}")
        
        return item_codes
        
    except Exception as e:
        frappe.log_error(
            title="Error loading POS exception items",
            message=f"Error: {str(e)}"
        )
        return []