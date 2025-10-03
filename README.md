# POS Next

A modern, high-performance Point of Sale system for ERPNext with offline capabilities, real-time updates, and intuitive UI.

## ✨ Key Features

- 🚀 **Fast & Modern** - Vue 3 with optimized performance
- 🔄 **Offline Mode** - IndexedDB caching for uninterrupted sales
- 🎁 **Coupons & Offers** - Full promotional schemes and gift cards
- 💱 **Multi-Currency** - Proper symbols (E£, ر.س, د.إ, $, €, £)
- 💾 **Draft Invoices** - Hold and resume transactions
- 🔄 **Returns** - Easy return processing
- 💰 **Shift Management** - Real-time shift tracking
- 🔍 **Barcode Scanning** - Fast item lookup
- 📱 **Responsive UI** - Clean, modern interface

## 📋 Prerequisites

1. **Frappe Framework** (version 15+)
2. **ERPNext** (version 15+)

## 🚀 Installation

### Step 1: Install POS Next

```bash
cd ~/frappe-bench

# Get POS Next
bench get-app https://github.com/BrainWise-DEV/pos_next.git --branch develop

# Install on site
bench --site [your-site-name] install-app pos_next

# Build and restart
bench build --app pos_next
bench restart
```

### Step 2: Access POS

Visit `https://<your-domain>/pos` (or `http://<server-ip>/pos`) replacing the host with your DNS/IP.

### Step 3: Setup

1. **Create POS Profile**: `Retail > POS Profile > New`
   - Set Company, Warehouse, Price List, Currency, Payment Methods

2. **(Optional) Create Offers**: `POS Next > POS Offer`

3. **(Optional) Create Coupons**: `POS Next > POS Coupon`

## 📖 Quick Start

### Making a Sale

1. **Search Items** - Press `F4` or use barcode scanner
2. **Add to Cart** - Click items to add, adjust quantity
3. **Select Customer** - Press `F8` (optional)
4. **Apply Coupons/Offers** - Click purple/green buttons
5. **Checkout** - Press `F9`, select payment method

### Using Drafts (Hold Feature)

- **Save**: Click "Hold" button (saves cart, clears screen)
- **Load**: Menu (⋮) > "Draft Invoices" (auto-deletes on load)
- **Delete**: Click trash icon or "Clear All"

### Processing Returns

1. Menu (⋮) > "Return Invoice"
2. Search invoice, select items to return
3. Process return (creates credit note)

### Shift Management

- **Open**: Required before sales
- **During**: Live timer in navbar (green badge)
- **Close**: Menu (⋮) > "Close Shift"

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F4` | Search items |
| `F8` | Search customers |
| `F9` | Checkout |
| `Ctrl+S` | Save draft |
| `Esc` | Close dialog |

## 💱 Currency Support

Displays proper symbols for: EGP (E£), SAR (ر.س), AED (د.إ), USD ($), EUR (€), GBP (£), and more.

## 🔧 Troubleshooting

### Items Not Loading
- Verify items exist in selected warehouse
- Check POS Profile warehouse setting
- Ensure price list has item prices
- Clear cache and reload

### Close Shift Not Working
**Solution**: Update to latest version (fixed).

### Draft Badge Not Updating
**Solution**: Update to latest version (auto-updates now).

## 🛠️ Development

```bash
# Get app in dev mode
cd ~/frappe-bench
bench get-app /path/to/pos_next

# Install frontend dependencies
cd apps/pos_next/POS
npm install

# Run dev server (hot reload)
npm run dev

# In another terminal
bench start
```

### Build for Production

```bash
cd apps/pos_next/POS
npm run build
bench build --app pos_next
bench restart
```

## 🔌 API Examples

### Get Offers
```javascript
frappe.call({
    method: 'pos_next.api.offers.get_offers',
    args: { pos_profile: 'Main POS' }
})
```

### Validate Coupon
```javascript
frappe.call({
    method: 'pos_next.api.offers.validate_coupon',
    args: {
        coupon_code: 'SUMMER2024',
        customer: 'CUST-00001',
        company: 'My Company'
    }
})
```

### Create Invoice
```javascript
frappe.call({
    method: 'pos_next.api.invoices.create_invoice',
    args: {
        invoice_data: {
            customer: 'CUST-00001',
            items: [{ item_code: 'ITEM-001', qty: 2, rate: 100 }],
            payments: [{ mode_of_payment: 'Cash', amount: 200 }]
        }
    }
})
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Install pre-commit: `cd apps/pos_next && pre-commit install`
4. Make changes and commit
5. Push and open Pull Request

**Code Style**: Uses ruff, eslint, prettier, pyupgrade (via pre-commit)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/BrainWise-DEV/pos_next/issues)
- **Discussions**: [GitHub Discussions](https://github.com/BrainWise-DEV/pos_next/discussions)
- **Forum**: [Frappe Forum](https://discuss.frappe.io/)

## 📄 License

AGPL-3.0 - See [LICENSE](LICENSE) file

## 🙏 Credits

- [Frappe Framework](https://frappeframework.com/) - Full-stack framework
- [ERPNext](https://erpnext.com/) - Open source ERP
- [Vue.js 3](https://vuejs.org/) - Frontend framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## 📝 Recent Updates (v1.0.0)

### Features
- Modern Vue 3 Composition API interface
- Offline-first with IndexedDB
- Real-time Socket.io updates
- Multi-currency with proper symbols
- Draft invoice management (Hold/Resume)
- Comprehensive coupon/offer system
- Return invoice processing
- Live shift duration timer

### Bug Fixes
- Fixed duplicate currency symbols (EGPEGP → EGP)
- Fixed currency showing codes instead of symbols
- Fixed draft duplication on reload (auto-delete)
- Fixed Close Shift button not working
- Fixed badge count not updating after clearing drafts
- Fixed currency in Draft Invoices dialog

## 🎯 Roadmap

- [ ] Table management for restaurants
- [ ] Kitchen display system (KDS)
- [ ] Advanced reporting
- [ ] Mobile app
- [ ] Loyalty points
- [ ] PWA support

---

Made with ❤️ by BrainWise team
