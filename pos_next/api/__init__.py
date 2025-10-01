# -*- coding: utf-8 -*-
# API module for POS Next

import frappe

@frappe.whitelist(allow_guest=True)
def ping():
    """Simple ping endpoint for connectivity checks"""
    return "pong"
