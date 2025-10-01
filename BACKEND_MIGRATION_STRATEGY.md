# Backend Migration Strategy: POS Awesome to POS Next

## Overview
This document outlines the detailed backend migration strategy for transitioning from POS Awesome to POS Next, focusing on maintaining compatibility while improving code structure and maintainability.

## Custom DocTypes Migration

### Priority 1: Core DocTypes (Week 1)
These are essential for basic POS operations:

```python
# 1. POS Opening Shift
{
    "doctype": "POS Opening Shift",
    "fields": [
        {"fieldname": "pos_profile", "fieldtype": "Link", "options": "POS Profile"},
        {"fieldname": "user", "fieldtype": "Link", "options": "User"},
        {"fieldname": "company", "fieldtype": "Link", "options": "Company"},
        {"fieldname": "opening_date", "fieldtype": "Date"},
        {"fieldname": "opening_time", "fieldtype": "Time"},
        {"fieldname": "status", "fieldtype": "Select", "options": "Open\nClosed"},
        {"fieldname": "opening_details", "fieldtype": "Table", "options": "POS Opening Shift Detail"}
    ]
}

# 2. POS Closing Shift
{
    "doctype": "POS Closing Shift",
    "fields": [
        {"fieldname": "pos_opening_shift", "fieldtype": "Link", "options": "POS Opening Shift"},
        {"fieldname": "closing_date", "fieldtype": "Date"},
        {"fieldname": "closing_time", "fieldtype": "Time"},
        {"fieldname": "closing_details", "fieldtype": "Table", "options": "POS Closing Shift Detail"},
        {"fieldname": "taxes", "fieldtype": "Table", "options": "POS Closing Shift Taxes"}
    ]
}
```

### Priority 2: Promotion DocTypes (Week 2)
```python
# 3. POS Offer
{
    "doctype": "POS Offer",
    "fields": [
        {"fieldname": "offer_name", "fieldtype": "Data"},
        {"fieldname": "offer_type", "fieldtype": "Select",
         "options": "Item Price\nGive Product\nGrand Total\nLoyalty Points"},
        {"fieldname": "conditions", "fieldtype": "Table", "options": "POS Offer Detail"},
        {"fieldname": "valid_from", "fieldtype": "Date"},
        {"fieldname": "valid_to", "fieldtype": "Date"},
        {"fieldname": "auto_apply", "fieldtype": "Check"}
    ]
}

# 4. POS Coupon
{
    "doctype": "POS Coupon",
    "fields": [
        {"fieldname": "coupon_code", "fieldtype": "Data", "unique": 1},
        {"fieldname": "coupon_type", "fieldtype": "Select",
         "options": "Promotional\nGift Card"},
        {"fieldname": "discount_percentage", "fieldtype": "Float"},
        {"fieldname": "discount_amount", "fieldtype": "Currency"},
        {"fieldname": "maximum_use", "fieldtype": "Int"},
        {"fieldname": "used", "fieldtype": "Int", "read_only": 1}
    ]
}
```

### Priority 3: Support DocTypes (Week 3)
- Delivery Charges
- Mpesa C2B Register URL
- Mpesa Payment Register
- Referral Code
- POS Payment Entry Reference

## Custom Fields Migration

### Create Fixtures File
```python
# pos_next/fixtures/custom_fields.json
{
    "custom_fields": [
        {
            "dt": "POS Profile",
            "fields": [
                {
                    "fieldname": "posa_pos_awesome_settings",
                    "label": "POS Settings",
                    "fieldtype": "Section Break",
                    "insert_after": "warehouse"
                },
                {
                    "fieldname": "posa_allow_delete",
                    "label": "Allow Delete",
                    "fieldtype": "Check",
                    "insert_after": "posa_pos_awesome_settings"
                },
                {
                    "fieldname": "posa_allow_user_to_edit_rate",
                    "label": "Allow User to Edit Rate",
                    "fieldtype": "Check",
                    "insert_after": "posa_allow_delete"
                },
                // ... continue for all 40+ custom fields
            ]
        },
        {
            "dt": "Sales Invoice",
            "fields": [
                {
                    "fieldname": "posa_pos_opening_shift",
                    "label": "POS Opening Shift",
                    "fieldtype": "Link",
                    "options": "POS Opening Shift"
                }
                // ... other fields
            ]
        }
    ]
}
```

### Migration Script
```python
# pos_next/patches/v1_0/migrate_custom_fields.py
import frappe
import json

def execute():
    """Migrate custom fields from POS Awesome to POS Next"""

    # Load fixtures
    with open(frappe.get_app_path('pos_next', 'fixtures', 'custom_fields.json')) as f:
        fixtures = json.load(f)

    for doctype_fields in fixtures['custom_fields']:
        dt = doctype_fields['dt']

        for field in doctype_fields['fields']:
            # Check if field already exists
            if not frappe.db.exists('Custom Field', {'dt': dt, 'fieldname': field['fieldname']}):
                cf = frappe.new_doc('Custom Field')
                cf.dt = dt
                cf.update(field)
                cf.insert()
                print(f"Created custom field {field['fieldname']} for {dt}")

    frappe.db.commit()
```

## API Layer Architecture

### Base API Service
```python
# pos_next/api/base.py
import frappe
from frappe import _
from functools import wraps
import json

def validate_pos_profile(f):
    """Decorator to validate POS Profile access"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        pos_profile = kwargs.get('pos_profile') or frappe.form_dict.get('pos_profile')
        if not pos_profile:
            frappe.throw(_("POS Profile is required"))

        # Check user has access to POS Profile
        if not has_pos_profile_access(pos_profile):
            frappe.throw(_("You don't have access to this POS Profile"))

        return f(*args, **kwargs)
    return wrapper

def handle_errors(f):
    """Decorator for consistent error handling"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            result = f(*args, **kwargs)
            return {
                "success": True,
                "data": result,
                "error": None
            }
        except Exception as e:
            frappe.log_error(frappe.get_traceback(), _("POS API Error"))
            return {
                "success": False,
                "data": None,
                "error": str(e)
            }
    return wrapper

class POSAPIBase:
    """Base class for POS API services"""

    def __init__(self, pos_profile=None):
        self.pos_profile = pos_profile
        self.settings = self.get_pos_settings()

    def get_pos_settings(self):
        """Get POS Profile settings"""
        if not self.pos_profile:
            return {}

        return frappe.get_cached_doc("POS Profile", self.pos_profile)

    def validate_permission(self, doctype, operation="read"):
        """Validate user permissions"""
        if not frappe.has_permission(doctype, operation):
            frappe.throw(_("Insufficient permissions"))
```

### Items API Migration
```python
# pos_next/api/v1/items.py
import frappe
from frappe import _
from pos_next.api.base import POSAPIBase, handle_errors, validate_pos_profile

class ItemsAPI(POSAPIBase):
    """Items API Service"""

    @frappe.whitelist()
    @handle_errors
    @validate_pos_profile
    def search_items(self, query="", limit=50, offset=0, pos_profile=None):
        """
        Search items with barcode, serial, batch support
        Replaces: posawesome.api.items.search_items
        """
        self.pos_profile = pos_profile

        # Build search conditions
        conditions = self._build_search_conditions(query)

        # Get items from database
        items = frappe.db.sql("""
            SELECT
                i.name, i.item_code, i.item_name, i.description,
                i.image, i.stock_uom, i.has_batch_no, i.has_serial_no,
                i.is_stock_item, i.has_variants, i.variant_of
            FROM `tabItem` i
            WHERE i.disabled = 0
                AND i.has_variants = 0
                AND i.is_sales_item = 1
                AND ({conditions})
            ORDER BY i.item_name
            LIMIT %(offset)s, %(limit)s
        """.format(conditions=conditions), {
            'query': f"%{query}%",
            'offset': offset,
            'limit': limit
        }, as_dict=True)

        # Enrich with prices and stock
        for item in items:
            item['prices'] = self._get_item_prices(item['name'])
            item['stock'] = self._get_item_stock(item['name'])
            item['barcodes'] = self._get_item_barcodes(item['name'])

        return items

    def _build_search_conditions(self, query):
        """Build SQL conditions for search"""
        conditions = []

        # Search by name, code, barcode
        conditions.append("""
            (i.item_code LIKE %(query)s
            OR i.item_name LIKE %(query)s
            OR i.name IN (
                SELECT parent FROM `tabItem Barcode`
                WHERE barcode LIKE %(query)s
            ))
        """)

        # Add POS Profile specific filters
        if self.settings.get('posa_display_items_in_stock'):
            conditions.append("i.name IN (SELECT item_code FROM `tabBin` WHERE actual_qty > 0)")

        return " AND ".join(conditions) if conditions else "1=1"

    def _get_item_prices(self, item_code):
        """Get item prices based on price list"""
        price_list = self.settings.selling_price_list

        return frappe.db.sql("""
            SELECT
                price_list_rate, currency, uom, valid_from, valid_upto
            FROM `tabItem Price`
            WHERE item_code = %s
                AND price_list = %s
                AND (valid_from IS NULL OR valid_from <= CURDATE())
                AND (valid_upto IS NULL OR valid_upto >= CURDATE())
        """, (item_code, price_list), as_dict=True)

    def _get_item_stock(self, item_code):
        """Get item stock for warehouse"""
        warehouse = self.settings.warehouse

        if self.settings.get('warehouse_type') == 'Warehouse Group':
            # Get all child warehouses
            warehouses = get_child_warehouses(warehouse)
        else:
            warehouses = [warehouse]

        stock_data = frappe.db.sql("""
            SELECT
                SUM(actual_qty) as actual_qty,
                SUM(reserved_qty) as reserved_qty
            FROM `tabBin`
            WHERE item_code = %s
                AND warehouse IN %s
        """, (item_code, warehouses), as_dict=True)

        return {
            'actual_qty': stock_data[0].actual_qty or 0,
            'reserved_qty': stock_data[0].reserved_qty or 0,
            'available_qty': (stock_data[0].actual_qty or 0) - (stock_data[0].reserved_qty or 0)
        }

    def _get_item_barcodes(self, item_code):
        """Get item barcodes with UOM"""
        return frappe.db.sql("""
            SELECT barcode, posa_uom as uom, barcode_type
            FROM `tabItem Barcode`
            WHERE parent = %s
        """, item_code, as_dict=True)

# API Endpoints
@frappe.whitelist()
def search_items(**kwargs):
    api = ItemsAPI()
    return api.search_items(**kwargs)

@frappe.whitelist()
def get_item_details(item_code, pos_profile):
    api = ItemsAPI(pos_profile)
    return api.get_item_details(item_code)
```

### Invoice API Migration
```python
# pos_next/api/v1/invoices.py
import frappe
from frappe import _
from frappe.utils import nowdate, nowtime
from pos_next.api.base import POSAPIBase, handle_errors

class InvoiceAPI(POSAPIBase):
    """Invoice API Service"""

    @frappe.whitelist()
    @handle_errors
    def create_invoice(self, invoice_data):
        """Create POS Invoice or Sales Invoice based on settings"""

        # Determine invoice type
        doctype = "POS Invoice" if not self.settings.get('create_pos_invoice_instead_of_sales_invoice') else "Sales Invoice"

        # Create invoice document
        invoice = frappe.new_doc(doctype)

        # Set basic fields
        invoice.update({
            'pos_profile': self.pos_profile,
            'company': self.settings.company,
            'customer': invoice_data.get('customer'),
            'posting_date': invoice_data.get('posting_date', nowdate()),
            'posting_time': invoice_data.get('posting_time', nowtime()),
            'is_pos': 1,
            'posa_pos_opening_shift': invoice_data.get('opening_shift')
        })

        # Add items
        for item_data in invoice_data.get('items', []):
            invoice.append('items', self._prepare_item_row(item_data))

        # Add payments
        if doctype == "POS Invoice":
            for payment_data in invoice_data.get('payments', []):
                invoice.append('payments', self._prepare_payment_row(payment_data))

        # Apply offers and coupons
        if invoice_data.get('offers'):
            self._apply_offers(invoice, invoice_data['offers'])

        if invoice_data.get('coupons'):
            self._apply_coupons(invoice, invoice_data['coupons'])

        # Validate and save
        invoice.flags.ignore_mandatory = True
        invoice.insert()

        # Submit if requested
        if invoice_data.get('submit'):
            if self.settings.get('posa_allow_submissions_in_background_job'):
                frappe.enqueue(
                    'pos_next.api.v1.invoices.submit_invoice',
                    invoice_name=invoice.name,
                    doctype=doctype
                )
            else:
                invoice.submit()

        return {
            'name': invoice.name,
            'doctype': doctype,
            'status': invoice.docstatus
        }

    def _prepare_item_row(self, item_data):
        """Prepare item row for invoice"""
        return {
            'item_code': item_data['item_code'],
            'qty': item_data['qty'],
            'rate': item_data['rate'],
            'discount_percentage': item_data.get('discount_percentage', 0),
            'discount_amount': item_data.get('discount_amount', 0),
            'warehouse': item_data.get('warehouse', self.settings.warehouse),
            'batch_no': item_data.get('batch_no'),
            'serial_no': item_data.get('serial_no'),
            'posa_notes': item_data.get('notes'),
            'posa_delivery_date': item_data.get('delivery_date')
        }

    def _prepare_payment_row(self, payment_data):
        """Prepare payment row for POS Invoice"""
        return {
            'mode_of_payment': payment_data['mode_of_payment'],
            'amount': payment_data['amount'],
            'account': self._get_payment_account(payment_data['mode_of_payment'])
        }

    def _apply_offers(self, invoice, offers):
        """Apply offers to invoice"""
        invoice.posa_offers = json.dumps(offers)
        # Implement offer logic based on offer type

    def _apply_coupons(self, invoice, coupons):
        """Apply coupons to invoice"""
        invoice.posa_coupons = ','.join(coupons)
        # Validate and apply coupon discounts

def submit_invoice(invoice_name, doctype):
    """Background job to submit invoice"""
    invoice = frappe.get_doc(doctype, invoice_name)
    invoice.submit()
    frappe.db.commit()
```

### Shift Management API
```python
# pos_next/api/v1/shifts.py
import frappe
from frappe import _
from frappe.utils import nowdate, nowtime, flt
from pos_next.api.base import POSAPIBase, handle_errors

class ShiftAPI(POSAPIBase):
    """Shift Management API"""

    @frappe.whitelist()
    @handle_errors
    def open_shift(self, opening_details):
        """Open new POS shift"""

        # Check for existing open shift
        existing = frappe.db.get_value(
            "POS Opening Shift",
            {
                "user": frappe.session.user,
                "pos_profile": self.pos_profile,
                "status": "Open"
            }
        )

        if existing:
            frappe.throw(_("You already have an open shift"))

        # Create opening shift
        shift = frappe.new_doc("POS Opening Shift")
        shift.update({
            'pos_profile': self.pos_profile,
            'user': frappe.session.user,
            'company': self.settings.company,
            'opening_date': nowdate(),
            'opening_time': nowtime(),
            'status': 'Open'
        })

        # Add opening amounts
        for mode, amount in opening_details.items():
            shift.append('opening_details', {
                'mode_of_payment': mode,
                'opening_amount': flt(amount)
            })

        shift.insert()
        frappe.db.commit()

        return shift.name

    @frappe.whitelist()
    @handle_errors
    def close_shift(self, shift_id, closing_details):
        """Close POS shift with reconciliation"""

        opening_shift = frappe.get_doc("POS Opening Shift", shift_id)

        if opening_shift.status == "Closed":
            frappe.throw(_("Shift is already closed"))

        # Get invoices for this shift
        invoices = self._get_shift_invoices(shift_id)

        # Calculate expected amounts
        expected_amounts = self._calculate_expected_amounts(invoices)

        # Create closing shift
        closing = frappe.new_doc("POS Closing Shift")
        closing.update({
            'pos_opening_shift': shift_id,
            'closing_date': nowdate(),
            'closing_time': nowtime(),
            'total_quantity': sum(inv['total_qty'] for inv in invoices),
            'total_amount': sum(inv['grand_total'] for inv in invoices)
        })

        # Add closing details
        for mode, details in closing_details.items():
            closing.append('closing_details', {
                'mode_of_payment': mode,
                'expected_amount': expected_amounts.get(mode, 0),
                'closing_amount': flt(details.get('amount', 0)),
                'difference': flt(details.get('amount', 0)) - expected_amounts.get(mode, 0)
            })

        # Add tax details
        taxes = self._calculate_taxes(invoices)
        for tax_account, tax_amount in taxes.items():
            closing.append('taxes', {
                'tax_account': tax_account,
                'tax_amount': tax_amount
            })

        closing.insert()

        # Update opening shift status
        opening_shift.status = "Closed"
        opening_shift.save()

        frappe.db.commit()

        return closing.name

    def _get_shift_invoices(self, shift_id):
        """Get all invoices for a shift"""
        return frappe.db.sql("""
            SELECT
                name, posting_date, customer,
                total_qty, grand_total, outstanding_amount
            FROM `tabSales Invoice`
            WHERE posa_pos_opening_shift = %s
                AND docstatus = 1
            UNION ALL
            SELECT
                name, posting_date, customer,
                total_qty, grand_total, outstanding_amount
            FROM `tabPOS Invoice`
            WHERE posa_pos_opening_shift = %s
                AND docstatus = 1
        """, (shift_id, shift_id), as_dict=True)

    def _calculate_expected_amounts(self, invoices):
        """Calculate expected amounts by payment mode"""
        amounts = {}

        for invoice in invoices:
            # Get payment details for each invoice
            payments = self._get_invoice_payments(invoice['name'])
            for payment in payments:
                mode = payment['mode_of_payment']
                amounts[mode] = amounts.get(mode, 0) + payment['amount']

        return amounts
```

### Offer Engine Migration
```python
# pos_next/services/offer_engine.py
import frappe
from frappe import _
from frappe.utils import flt, cint, nowdate

class OfferEngine:
    """POS Offer Engine for promotions and discounts"""

    def __init__(self, pos_profile):
        self.pos_profile = pos_profile
        self.offers = self._load_active_offers()

    def _load_active_offers(self):
        """Load active offers for POS Profile"""
        return frappe.db.sql("""
            SELECT * FROM `tabPOS Offer`
            WHERE disabled = 0
                AND (valid_from IS NULL OR valid_from <= %(today)s)
                AND (valid_to IS NULL OR valid_to >= %(today)s)
                AND (pos_profile = %(pos_profile)s OR pos_profile IS NULL)
                AND auto_apply = 1
            ORDER BY priority DESC
        """, {
            'today': nowdate(),
            'pos_profile': self.pos_profile
        }, as_dict=True)

    def apply_offers(self, invoice_data):
        """Apply offers to invoice"""
        applied_offers = []

        for offer in self.offers:
            if self._check_offer_conditions(offer, invoice_data):
                result = self._apply_offer(offer, invoice_data)
                if result:
                    applied_offers.append(result)

        return applied_offers

    def _check_offer_conditions(self, offer, invoice_data):
        """Check if offer conditions are met"""
        conditions = frappe.get_all(
            "POS Offer Detail",
            filters={'parent': offer['name']},
            fields=['*']
        )

        for condition in conditions:
            if not self._evaluate_condition(condition, invoice_data):
                return False

        return True

    def _evaluate_condition(self, condition, invoice_data):
        """Evaluate single offer condition"""
        if condition.get('condition_type') == 'Item Code':
            return self._check_item_condition(condition, invoice_data['items'])
        elif condition.get('condition_type') == 'Item Group':
            return self._check_item_group_condition(condition, invoice_data['items'])
        elif condition.get('condition_type') == 'Brand':
            return self._check_brand_condition(condition, invoice_data['items'])
        elif condition.get('condition_type') == 'Transaction':
            return self._check_transaction_condition(condition, invoice_data)

        return False

    def _apply_offer(self, offer, invoice_data):
        """Apply offer based on type"""
        if offer['offer_type'] == 'Item Price':
            return self._apply_item_price_offer(offer, invoice_data)
        elif offer['offer_type'] == 'Give Product':
            return self._apply_give_product_offer(offer, invoice_data)
        elif offer['offer_type'] == 'Grand Total':
            return self._apply_grand_total_offer(offer, invoice_data)
        elif offer['offer_type'] == 'Loyalty Points':
            return self._apply_loyalty_points_offer(offer, invoice_data)

        return None
```

### Cache Service
```python
# pos_next/services/cache_service.py
import frappe
import redis
import json
from datetime import datetime, timedelta

class CacheService:
    """Redis-based cache service for POS"""

    def __init__(self, pos_profile):
        self.pos_profile = pos_profile
        self.redis_client = frappe.cache()
        self.settings = frappe.get_cached_doc("POS Profile", pos_profile)
        self.cache_duration = self.settings.get('posa_server_cache_duration', 3600)

    def get_cache_key(self, key_type, identifier):
        """Generate cache key"""
        return f"pos_next:{self.pos_profile}:{key_type}:{identifier}"

    def get(self, key_type, identifier):
        """Get from cache"""
        if not self.settings.get('posa_use_server_cache'):
            return None

        key = self.get_cache_key(key_type, identifier)
        cached = self.redis_client.get(key)

        if cached:
            return json.loads(cached)
        return None

    def set(self, key_type, identifier, data):
        """Set in cache with TTL"""
        if not self.settings.get('posa_use_server_cache'):
            return

        key = self.get_cache_key(key_type, identifier)
        self.redis_client.setex(
            key,
            self.cache_duration,
            json.dumps(data, default=str)
        )

    def invalidate(self, key_type, identifier=None):
        """Invalidate cache"""
        if identifier:
            key = self.get_cache_key(key_type, identifier)
            self.redis_client.delete(key)
        else:
            # Invalidate all keys of this type
            pattern = f"pos_next:{self.pos_profile}:{key_type}:*"
            for key in self.redis_client.keys(pattern):
                self.redis_client.delete(key)

    def get_items_cache(self):
        """Get cached items data"""
        cached = self.get('items', 'all')
        if cached:
            return cached

        # Load from database
        items = self._load_items_from_db()
        self.set('items', 'all', items)
        return items

    def _load_items_from_db(self):
        """Load items from database"""
        # Implementation here
        pass
```

## Background Job Processing

### Queue Configuration
```python
# pos_next/services/background_jobs.py
import frappe
from frappe.utils.background_jobs import enqueue
from rq import Queue
from redis import Redis

class BackgroundProcessor:
    """Handle background job processing for POS"""

    @staticmethod
    def submit_invoice(invoice_name, doctype):
        """Submit invoice in background"""
        enqueue(
            'pos_next.services.background_jobs.process_invoice_submission',
            queue='short',
            timeout=300,
            invoice_name=invoice_name,
            doctype=doctype
        )

    @staticmethod
    def sync_offline_data(sync_data):
        """Sync offline data in background"""
        enqueue(
            'pos_next.services.background_jobs.process_offline_sync',
            queue='long',
            timeout=1800,
            sync_data=sync_data
        )

def process_invoice_submission(invoice_name, doctype):
    """Process invoice submission"""
    try:
        invoice = frappe.get_doc(doctype, invoice_name)
        invoice.submit()
        frappe.db.commit()

        # Send notification
        frappe.publish_realtime(
            'invoice_submitted',
            {'invoice': invoice_name, 'status': 'success'},
            user=invoice.owner
        )
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Invoice Submission Failed: {invoice_name}")

        # Send error notification
        frappe.publish_realtime(
            'invoice_submission_failed',
            {'invoice': invoice_name, 'error': str(e)},
            user=invoice.owner
        )

def process_offline_sync(sync_data):
    """Process offline sync data"""
    results = {
        'success': [],
        'failed': []
    }

    for item in sync_data:
        try:
            if item['type'] == 'invoice':
                process_offline_invoice(item['data'])
                results['success'].append(item['id'])
            elif item['type'] == 'customer':
                process_offline_customer(item['data'])
                results['success'].append(item['id'])
        except Exception as e:
            results['failed'].append({
                'id': item['id'],
                'error': str(e)
            })

    return results
```

## Database Optimization

### Indexes
```sql
-- Add indexes for better performance
CREATE INDEX idx_pos_invoice_shift ON `tabSales Invoice` (posa_pos_opening_shift);
CREATE INDEX idx_pos_invoice_date ON `tabSales Invoice` (posting_date, posa_pos_opening_shift);
CREATE INDEX idx_item_barcode_lookup ON `tabItem Barcode` (barcode, parent);
CREATE INDEX idx_batch_price ON `tabBatch` (posa_batch_price, item);
CREATE INDEX idx_pos_offer_validity ON `tabPOS Offer` (valid_from, valid_to, disabled);
```

### Views
```sql
-- Create view for fast item lookup
CREATE VIEW pos_item_view AS
SELECT
    i.name,
    i.item_code,
    i.item_name,
    i.stock_uom,
    i.has_batch_no,
    i.has_serial_no,
    ip.price_list_rate,
    b.actual_qty
FROM `tabItem` i
LEFT JOIN `tabItem Price` ip ON ip.item_code = i.name
LEFT JOIN `tabBin` b ON b.item_code = i.name
WHERE i.disabled = 0
    AND i.is_sales_item = 1;
```

## Testing Strategy

### Unit Tests
```python
# pos_next/tests/test_invoice_api.py
import frappe
import unittest
from pos_next.api.v1.invoices import InvoiceAPI

class TestInvoiceAPI(unittest.TestCase):

    def setUp(self):
        self.api = InvoiceAPI('Test POS Profile')

    def test_create_invoice(self):
        invoice_data = {
            'customer': 'Test Customer',
            'items': [{
                'item_code': 'Test Item',
                'qty': 1,
                'rate': 100
            }],
            'payments': [{
                'mode_of_payment': 'Cash',
                'amount': 100
            }]
        }

        result = self.api.create_invoice(invoice_data)

        self.assertTrue(result['success'])
        self.assertIsNotNone(result['data']['name'])

    def test_apply_discount(self):
        # Test discount application
        pass

    def test_stock_validation(self):
        # Test stock validation
        pass
```

### Integration Tests
```python
# pos_next/tests/test_integration.py
import frappe
import unittest

class TestPOSIntegration(unittest.TestCase):

    def test_complete_pos_flow(self):
        """Test complete POS transaction flow"""

        # 1. Open shift
        shift = self.open_test_shift()

        # 2. Create invoice
        invoice = self.create_test_invoice(shift)

        # 3. Apply offer
        self.apply_test_offer(invoice)

        # 4. Process payment
        self.process_test_payment(invoice)

        # 5. Close shift
        self.close_test_shift(shift)

        # Verify all steps completed successfully
        self.assertEqual(invoice.docstatus, 1)
```

## Deployment Strategy

### Rollout Plan
1. **Phase 1: Development Environment**
   - Deploy to development server
   - Run automated tests
   - Performance benchmarking

2. **Phase 2: Staging Environment**
   - Deploy to staging with production-like data
   - User acceptance testing
   - Load testing

3. **Phase 3: Production Pilot**
   - Deploy to selected POS terminals
   - Monitor performance and errors
   - Gather user feedback

4. **Phase 4: Full Production**
   - Gradual rollout to all terminals
   - Maintain parallel running for 2 weeks
   - Full cutover after validation

### Migration Checklist
- [ ] All custom DocTypes created
- [ ] All custom fields migrated
- [ ] API endpoints tested
- [ ] Background jobs configured
- [ ] Database indexes created
- [ ] Cache service operational
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] User training completed

## Monitoring and Maintenance

### Logging
```python
# pos_next/utils/logger.py
import frappe
from frappe.utils import nowdate

def log_pos_activity(activity_type, data):
    """Log POS activities for monitoring"""
    frappe.get_doc({
        'doctype': 'POS Activity Log',
        'activity_type': activity_type,
        'data': json.dumps(data),
        'timestamp': frappe.utils.now(),
        'user': frappe.session.user
    }).insert(ignore_permissions=True)

def log_error(error_type, error_data):
    """Log POS errors"""
    frappe.log_error(
        title=f"POS Error: {error_type}",
        message=json.dumps(error_data, indent=2)
    )
```

### Performance Monitoring
```python
# pos_next/utils/monitoring.py
import time
from functools import wraps

def monitor_performance(f):
    """Decorator to monitor API performance"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = f(*args, **kwargs)
        duration = time.time() - start

        if duration > 1.0:  # Log slow queries
            frappe.log_error(
                title=f"Slow POS API: {f.__name__}",
                message=f"Duration: {duration:.2f}s"
            )

        return result
    return wrapper
```

## Conclusion

This backend migration strategy provides:

1. **Complete feature parity** with POS Awesome
2. **Improved code organization** using service layers
3. **Better performance** through caching and optimization
4. **Enhanced maintainability** with clear separation of concerns
5. **Robust error handling** and monitoring
6. **Comprehensive testing** coverage
7. **Smooth deployment** strategy

The migration can be executed incrementally while maintaining backward compatibility with existing POS Awesome installations.