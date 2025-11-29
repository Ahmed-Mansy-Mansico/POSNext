import frappe

def execute():
    """
    Patch to link existing item images from File doctype to Item doctype
    This will run automatically during bench migrate
    """
    
    try:
        # Get all image files from File doctype
        files = frappe.get_all("File", 
            filters={
                "folder": ["in", ["Home/Attachments", "Home"]]
            },
            fields=["name", "file_name", "file_url"]
        )
        
        # Filter only image files (exclude barcodes, QR codes, etc.)
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
        image_files = []
        
        for f in files:
            if f.file_name:
                ext = f.file_name.rsplit('.', 1)[-1].lower()
                # Only include actual product images
                if f'.{ext}' in image_extensions and \
                   '_barcode' not in f.file_name.lower() and \
                   '_qr' not in f.file_name.lower() and \
                   'preview' not in f.file_name.lower():
                    image_files.append(f)
        
        # Get all items
        items = frappe.get_all("Item", fields=["name", "item_code"])
        item_dict = {item.item_code: item.name for item in items if item.item_code}
        
        success_count = 0
        not_found_count = 0
        
        for f in image_files:
            try:
                # Extract item code from filename
                filename_without_ext = f.file_name.rsplit('.', 1)[0]
                
                # Get first part before space or dash
                # Format: "10015 - PRINTED.jpg" -> "10015"
                if ' - ' in filename_without_ext:
                    item_code = filename_without_ext.split(' - ')[0].strip()
                elif ' ' in filename_without_ext:
                    item_code = filename_without_ext.split(' ')[0].strip()
                elif '-' in filename_without_ext:
                    item_code = filename_without_ext.split('-')[0].strip()
                else:
                    item_code = filename_without_ext
                
                # Check if item exists
                if item_code in item_dict:
                    item_name = item_dict[item_code]
                    
                    # Update item with image (OVERWRITES existing)
                    frappe.db.set_value("Item", item_name, "image", f.file_url, update_modified=False)
                    
                    # Link file to item
                    frappe.db.set_value("File", f.name, {
                        "attached_to_doctype": "Item",
                        "attached_to_name": item_name
                    }, update_modified=False)
                    
                    success_count += 1
                else:
                    not_found_count += 1
                    
            except Exception as e:
                continue
        
        frappe.db.commit()
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Item Image Linking Patch Failed")
        raise