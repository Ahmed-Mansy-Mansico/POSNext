import frappe
import io
import base64

def generate_sales_invoice_barcode(doc, *args, **kwargs):
    """
    Generate barcode for Sales Invoice before print
    
    Args:
        doc: Sales Invoice document
        *args: Variable positional arguments (method, print_settings, etc.)
        **kwargs: Variable keyword arguments
    """
    
    doc.barcode_value = doc.name
    
    try:
        import barcode
        from barcode.writer import SVGWriter
        
        
        # Create CODE128 barcode
        CODE128 = barcode.get_barcode_class('code128')
        barcode_obj = CODE128(doc.name, writer=SVGWriter())
        
        # Generate SVG in memory
        buffer = io.BytesIO()
        barcode_obj.write(buffer, {
            'module_width': 0.4,
            'module_height': 15,
            'quiet_zone': 3,
            'font_size': 0,
            'text_distance': 1,
            'write_text': False
        })
        
        # Convert to base64
        buffer.seek(0)
        svg_data = buffer.read()
        barcode_base64 = base64.b64encode(svg_data).decode('utf-8')
        
        # Set the barcode as data URI
        doc.barcode_svg = f"data:image/svg+xml;base64,{barcode_base64}"
        
        if frappe.conf.get('developer_mode'):
            frappe.logger().info(f"Barcode generated successfully for: {doc.name}")
        
    except ImportError as e:
        frappe.log_error(
            message=f"Barcode library not installed: {str(e)}\nRun: bench pip install python-barcode",
            title="Barcode Import Error"
        )
        doc.barcode_svg = None
        
    except Exception as e:
        frappe.log_error(
            message=f"Barcode generation error for {doc.name}: {str(e)}",
            title="Barcode Generation Error"
        )
        doc.barcode_svg = None