# POS Next

A modern, high-performance Point of Sale (POS) system built for ERPNext with offline-first capabilities, real-time updates, and an intuitive user interface.

POS built on ERPNext that brings together real-time billing, stock management, multi-user access, offline mode, and direct ERP integration. Run your store or restaurant with confidence and control, while staying 100% open source.

## ✨ Features

- 🚀 **Blazing Fast Performance** - Built with Vue 3 and optimized for speed
- 📱 **Modern UI/UX** - Clean, intuitive interface designed for retail environments
- 🔄 **Offline Mode** - Continue working even without internet connectivity with IndexedDB caching
- 💳 **Multiple Payment Methods** - Cash, Card, Mobile Payment, and more
- 🎁 **Coupons & Offers** - Full support for promotional schemes, pricing rules, and gift cards
- 📊 **Real-time Sync** - Socket.io integration for live updates across devices
- 🖨️ **Receipt Printing** - Professional invoice printing
- 👥 **Customer Management** - Quick customer search and inline creation
- 📦 **Stock Management** - Real-time stock updates and reservations
- 💰 **Shift Management** - Track opening and closing shifts with cash reconciliation
- 🔍 **Barcode Scanning** - Fast item lookup via barcode
- 📋 **Draft Invoices** - Save and resume transactions (Hold feature)
- 🔄 **Return Processing** - Handle returns and credit notes seamlessly
- 💱 **Multi-Currency** - Support for multiple currencies with proper symbols (E£, ر.س, د.إ, etc.)
- ⏱️ **Real-time Shift Timer** - Live shift duration and current time display

## 📋 Prerequisites

Before installing POS Next, you need:

1. **Frappe Framework** (version 14 or higher)
2. **ERPNext** (version 14 or higher)
3. **POSAwesome** - **REQUIRED** for POS Offer and POS Coupon functionality

## 🚀 Installation

### Step 1: Install POSAwesome (Required)

⚠️ **IMPORTANT**: POS Next depends on POSAwesome for the POS Offer and POS Coupon doctypes. You **must** install POSAwesome first.

```bash
# Navigate to your bench directory
cd ~/frappe-bench

# Get POSAwesome from GitHub
bench get-app https://github.com/defendicon/POS-Awesome-V15

# Setup Requirements

bench setup requirements

# Install POSAwesome on your site
bench --site [your-site-name] install-app posawesome

# Migrate database
bench --site [your-site-name] migrate
```

### Step 2: Install POS Next

```bash
# Navigate to your bench directory
cd ~/frappe-bench

# Get POS Next app
bench get-app https://github.com/BrainWise-DEV/pos_next.git --branch develop

# Install POS Next on your site
bench --site [your-site-name] install-app pos_next

# Build assets
bench build --app pos_next

# Restart bench
bench restart
```

### Step 3: Initial Setup

1. **Create a POS Profile**
   ```
   Go to: Retail > POS Profile > New
   ```
   Configure:
   - Company
   - Warehouse
   - Price List
   - Currency
   - Payment Methods
   - Print Settings

2. **Setup Opening Entry**
   ```
   Go to: Retail > POS Opening Entry
   ```
   - Set opening cash balance
   - Configure denominations

3. **(Optional) Create POS Offers**
   ```
   Go to: POSAwesome > POS Offer
   ```
   - Define discount rules
   - Set minimum/maximum amounts
   - Configure auto-apply or coupon-based

4. **(Optional) Create Coupons**
   ```
   Go to: POSAwesome > POS Coupon
   ```
   - Generate promotional coupons
   - Create customer-specific gift cards

## 📖 Usage

### Accessing POS

1. Navigate to: **`/app/pos-sale`**
2. Select your POS Profile
3. Open a shift
4. Start selling!

### Key Workflows

#### 🛒 Making a Sale

1. **Search Items**
   - Use barcode scanner (press `F4` to focus)
   - Search by name, item code, or barcode
   - Items are cached for offline access

2. **Add to Cart**
   - Click items to add
   - Adjust quantity with +/- buttons
   - View real-time totals

3. **Select Customer** (Optional)
   - Press `F8` to focus customer search
   - Search by name, phone, or email
   - Create new customer inline

4. **Apply Discounts/Coupons**
   - Click **Coupons** button for gift cards
   - Click **Offers** button for promotional offers
   - Enter coupon code manually
   - Eligible offers show automatically

5. **Checkout**
   - Press `F9` or click Checkout
   - Select payment method(s)
   - Split payments supported
   - Auto-print receipt

#### 🎁 Using Coupons & Offers

**Coupons Button** (Purple):
- View customer-specific gift cards
- Shows available balance
- One-click apply

**Offers Button** (Green):
- Auto-applicable promotional offers
- Filters by cart total (min/max amounts)
- Shows discount percentage or amount

**Manual Entry**:
- Enter coupon code in dialog
- Validates against usage limits
- Checks expiration dates
- Verifies customer eligibility

#### 💾 Draft Invoices (Hold Feature)

**Save Draft**:
1. Click **Hold** button
2. Cart saved with unique ID
3. Cart cleared automatically
4. Badge shows draft count

**Load Draft**:
1. Click menu (⋮) > **Draft Invoices**
2. View all saved drafts with totals
3. Click draft to load
4. Draft auto-deleted to prevent duplicates

**Delete Draft**:
- Click trash icon on individual draft
- Confirmation dialog appears
- Or use **Clear All** to remove all drafts

#### 🔄 Processing Returns

1. Click menu (⋮) > **Return Invoice**
2. Search for original invoice
3. Select items to return
4. Adjust quantities
5. Process return (creates credit note)

#### ⏰ Shift Management

**Open Shift**:
- Required before making sales
- Set opening balance
- Record cash denominations

**During Shift**:
- Live shift timer in navbar (green badge)
- Current time display (blue badge)
- Real-time sales tracking

**Close Shift**:
1. Click menu (⋮) > **Close Shift**
2. Count cash denominations
3. Review shift summary
4. Submit closing entry

## ⚙️ Configuration

### POS Profile Settings

Key settings in your POS Profile:

| Setting | Description |
|---------|-------------|
| **Company** | Your company entity |
| **Warehouse** | Default warehouse for stock |
| **Price List** | Selling price list |
| **Currency** | Operating currency (USD, EGP, SAR, etc.) |
| **Payment Methods** | Cash, Card, Mobile, etc. |
| **Print Settings** | Receipt format and printer |
| **Accounting** | Income account, cost center |

### Currency Support

POS Next supports proper currency symbols:

| Currency | Symbol | Display |
|----------|--------|---------|
| EGP | E£ | E£ 1,234.56 |
| SAR | ر.س | ر.س 1,234.56 |
| AED | د.إ | د.إ 1,234.56 |
| USD | $ | $ 1,234.56 |
| EUR | € | € 1,234.56 |
| GBP | £ | £ 1,234.56 |

### Offline Mode

**How It Works**:
- Items cached in IndexedDB
- Customers cached locally
- Invoices queued when offline
- Auto-sync when connection restored

**Configuration**:
- Auto-cache enabled by default
- Manual sync available
- Configurable sync intervals

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F4` | Focus item search |
| `F8` | Focus customer search |
| `F9` | Proceed to checkout |
| `Ctrl + S` | Save draft (Hold) |
| `Esc` | Close active dialog |

## 🔧 Troubleshooting

### Coupons/Offers Not Working

**Error**: "Coupon system not installed"

**Solution**:
1. Install POSAwesome (see Step 1)
2. Run: `bench --site [site] migrate`
3. Restart: `bench restart`
4. Clear browser cache

### Items Not Loading

**Problem**: No items showing in POS

**Solutions**:
1. ✅ Verify items exist in selected warehouse
2. ✅ Check POS Profile warehouse setting
3. ✅ Ensure price list has item prices
4. ✅ Check if items are disabled
5. ✅ Clear cache and reload

### Offline Mode Issues

**Problem**: Data not syncing

**Solutions**:
1. Check browser supports IndexedDB
2. Check browser storage quota
3. Clear browser data
4. Check console for errors
5. Manual sync: Click sync button

### Print Not Working

**Problem**: Receipts not printing

**Solutions**:
1. ✅ Verify printer connection
2. ✅ Check print format in POS Profile
3. ✅ Test with Ctrl+P
4. ✅ Check browser print settings
5. ✅ Verify print server (if using)

### Close Shift Button Not Working

**Problem**: Button doesn't respond

**Solution**: Fixed in latest version. Update to latest code.

### Draft Badge Not Updating

**Problem**: Badge shows wrong count

**Solution**: Fixed in latest version. Badge auto-updates on delete/clear/load.

## 🛠️ Development

### Setup Development Environment

```bash
# Get app in development mode
cd ~/frappe-bench
bench get-app /path/to/pos_next

# Install dependencies
cd apps/pos_next/POS
npm install

# Run dev server (with hot reload)
npm run dev

# In another terminal, run Frappe
bench start
```

### Project Structure

```
pos_next/
├── pos_next/                 # Python backend
│   ├── api/                 # API endpoints
│   │   ├── __init__.py
│   │   ├── invoices.py     # Invoice operations
│   │   ├── items.py        # Item operations
│   │   ├── offers.py       # Coupons & offers
│   │   ├── customers.py    # Customer operations
│   │   └── shifts.py       # Shift management
│   ├── pos_next/
│   │   └── doctype/        # Custom doctypes
│   └── hooks.py            # App hooks
├── POS/                     # Vue.js frontend
│   ├── src/
│   │   ├── components/     # Vue components
│   │   │   ├── sale/       # POS components
│   │   │   └── common/     # Shared components
│   │   ├── pages/          # Page components
│   │   │   └── POSSale.vue # Main POS page
│   │   ├── utils/          # Utilities
│   │   │   ├── currency.js # Currency formatting
│   │   │   ├── draftManager.js # Draft management
│   │   │   └── offline/    # Offline utilities
│   │   └── main.js         # Entry point
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── README.md
└── pyproject.toml
```

### Building for Production

```bash
# Build frontend
cd apps/pos_next/POS
npm run build

# Build Frappe assets
bench build --app pos_next

# Clear cache
bench --site [site] clear-cache

# Restart
bench restart
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Install pre-commit hooks
   ```bash
   cd apps/pos_next
   pre-commit install
   ```
4. Make your changes
5. Run linters
   ```bash
   pre-commit run --all-files
   ```
6. Commit your changes
   ```bash
   git commit -m 'Add amazing feature'
   ```
7. Push to the branch
   ```bash
   git push origin feature/amazing-feature
   ```
8. Open a Pull Request

### Code Style

Pre-commit is configured to use:
- **ruff** - Python linting and formatting
- **eslint** - JavaScript/Vue linting
- **prettier** - Code formatting
- **pyupgrade** - Python syntax upgrades

### CI/CD

GitHub Actions workflows:
- **CI**: Unit tests on every push to `develop`
- **Linters**: Semgrep and pip-audit on PRs

## 📞 Support

- **Documentation**: [Wiki](https://github.com/[your-repo]/pos_next/wiki)
- **Issues**: [GitHub Issues](https://github.com/[your-repo]/pos_next/issues)
- **Discussions**: [GitHub Discussions](https://github.com/[your-repo]/pos_next/discussions)
- **Forum**: [Frappe Forum](https://discuss.frappe.io/)

## 📄 License

AGPL-3.0

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Credits

Built with love using:

- [Frappe Framework](https://frappeframework.com/) - Full-stack web framework
- [ERPNext](https://erpnext.com/) - Open source ERP
- [POSAwesome](https://github.com/yrestom/POS-Awesome) - POS Offer and Coupon functionality
- [Vue.js 3](https://vuejs.org/) - Progressive JavaScript framework
- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Frappe UI](https://github.com/frappe/frappe-ui) - Vue components for Frappe

## 📝 Changelog

### Version 1.0.0 (2025)

#### ✨ Features
- Modern Vue 3 Composition API interface
- Offline-first architecture with IndexedDB
- Real-time updates via Socket.io
- Multi-currency support with proper symbols (E£, ر.س, etc.)
- Draft invoice management (Hold/Resume)
- Comprehensive coupon and offer system
- Return invoice processing
- Shift management with live duration timer
- Barcode scanning support
- Inline customer search and creation
- Multiple payment methods
- Item caching for performance
- Badge notifications for drafts
- Professional receipt printing

#### 🎨 UI/UX Improvements
- Clean, modern interface
- Proper Dialog components (no native confirm)
- Toast notifications for all actions
- Real-time shift duration display (HH:mm:ss)
- Current time display in navbar
- Responsive design for tablets and desktops
- Color-coded buttons (Coupons=Purple, Offers=Green)
- Item count badges
- Loading states and skeletons

#### 🐛 Bug Fixes
- Fixed duplicate currency symbols (EGPEGP → EGP)
- Fixed currency display showing code instead of symbol
- Fixed space between currency symbol and amount
- Fixed draft duplication on reload (auto-delete on load)
- Fixed Close Shift button not working (missing parentheses)
- Fixed badge count not updating after clearing drafts
- Fixed currency prop in Draft Invoices dialog

#### 🔧 Technical
- Optimized item search and caching
- Better error handling with try-catch
- Proper event emitters for parent-child communication
- IndexedDB for draft storage
- Real-time watchers for reactive updates
- Debounced search inputs
- Lazy-loaded components

---

**Note**: This is an actively maintained project. Features and APIs are stable but may evolve. Always test in a development environment before deploying to production.

## 🎯 Roadmap

- [ ] Table management for restaurants
- [ ] Kitchen display system (KDS)
- [ ] Advanced reporting and analytics
- [ ] Mobile app (React Native)
- [ ] Receipt customization UI
- [ ] Loyalty points integration
- [ ] Multi-location inventory
- [ ] Advanced offline sync
- [ ] PWA support
- [ ] Webhook integrations

---

Made with ❤️ by the POS Next team
