# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Default Customer Auto-Loading**
  - New `get_default_customer` API endpoint in POS Profile
  - Automatically loads default customer when POS opens if configured in POS Profile
  - Customer appears in cart immediately without manual selection
  - Maintains proper customer object structure matching manual selection

### Fixed
- **Original Price Display in Receipts and UI**
  - Fixed discount handling to preserve original `price_list_rate` in both UI and created invoices
  - Receipts now clearly show: quantity × original price = subtotal, then discount line, then final total
  - Backend receives correct net rate for accurate invoice totals
  - Print format updated to 80mm thermal receipt size instead of A4
  - Discount percentages now display with 2 decimal precision (was showing many decimal places)
  - Added comprehensive JSDoc documentation for pricing and discount calculation logic

## [1.4.0] - 2025-01-06

### Fixed
- **Item Query Function Whitelisting**
  - Fixed item search by whitelisting `item_query` function for API access
  - Enabled global item selection across POS profiles
- **Mobile UI Layout**
  - Improved footer positioning for better mobile experience
  - Enhanced list view layout on mobile devices

## [1.3.0] - 2025-01-05

### Added
- **BrainWise Branding API**
  - Implemented secure branding configuration API with validation
  - Centralized branding management system
- **POS Profile Custom Fields**
  - Added "Cash Mode of Payment" field to specify default cash payment method
  - Added "Block Sale Beyond Available Qty" field for stock control
  - Added "Allow Delete Draft Invoices" field for draft management permissions
- **Saudi Riyal Font Support**
  - Updated CSS to properly render Saudi Riyal currency symbol (ر.س)
  - Improved font rendering for Arabic text

## [1.2.0] - 2025-01-04

### Added
- **CSRF Token Synchronization**
  - Implemented CSRF token sync with offline worker for enhanced security
  - Ensures secure API calls from background workers
- **POSNext Workspace Configuration**
  - Added workspace links for enhanced navigation
  - Improved accessibility to POS features

### Changed
- **Project Documentation**
  - Updated project references for clarity and consistency
  - Improved inline documentation across codebase

### Fixed
- **Cart Data Processing**
  - Use `toRaw()` to prevent stale cached quantities in invoice data
  - Ensures fresh data is always used in calculations
- **Header Layout**
  - Removed `overflow-x-hidden` class from POSHeader for improved responsiveness

## [1.1.1] - 2025-10-29

### Added
- **Payment Dialog: Customer Credit/Outstanding Balance Display**
  - Real-time customer balance display with color-coded indicators
  - Green indicator for available credit
  - Red indicator for outstanding balance (amount owed)
  - Gray indicator for zero balance
  - Comprehensive balance information showing total outstanding, total credit, and net position
- **New API Endpoint: `get_customer_balance`**
  - Returns detailed customer balance including total outstanding, total credit, and net balance
  - Calculates from Sales Invoices and Payment Entries
  - Supports company-specific filtering
- **Payment Dialog: Dynamic Button States**
  - "Pay on Account" button automatically disables when payment entries are added
  - Button re-enables when all payments are removed
  - Prevents mixing regular payments with credit sales

### Changed
- **Payment Dialog Layout Reorganization**
  - Information section moved to top (payment summary, customer credit, discount, payment breakdown)
  - All payment action buttons consolidated at bottom
  - Clear visual separation between information and actions
  - "Pay on Account" button matches "Complete Payment" button styling
  - Button color scheme changed to warm orange tones (orange-600 enabled, orange-400 disabled)
- **Customer Credit Display**
  - Now fetches both available credit sources and overall balance
  - Shows comprehensive credit position instead of just available credit
  - Displays appropriate message based on balance status
- Payment action buttons positioned in dialog footer for better UX

### Fixed
- **Critical: Double discount bug** - Discounts were being applied twice (once in item rate, once in total calculation)
  - Frontend now correctly uses `price_list_rate` for subtotal calculations
  - Backend reverse-calculates `price_list_rate` from discounted rate to prevent double application
  - Example: Item with 10% discount now correctly shows 90.00 instead of 81.00
- **Customer credit not displaying correctly** - Credit was only showing available credit, not outstanding balance
- **"Disable Rounded Total" setting not working** - Backend was checking POS Profile instead of POS Settings
- **ReferenceError: couponCode is not defined** - Fixed undefined couponCode error in posCart.js when re-applying offers
  - Changed reference from non-existent `couponCode.value` to `appliedCoupon.value?.name`
- Subtotal calculation now uses original price before discount (fixes display inconsistency)
- "Pay on Account" button styling now matches other action buttons

### Improved
- Improved discount calculation logic with comprehensive documentation
- Added validation to prevent invalid discount percentages (now clamped to 0-100%)
- Enhanced error handling for rounding setting retrieval
- Added data integrity checks (price_list_rate must be >= rate)
- Added detailed inline documentation for discount calculation flow
- Code cleanup with better comments explaining critical logic
- Separated discount calculation into clearly documented sections
- Payment dialog now provides clearer visual feedback for button states

## [1.1.0] - 2025-10-28

### Added
- Real-time settings updates without page reload using Pinia event system
- Event-driven architecture for settings changes (pricing, sales operations, display)
- Missing fields to POS Settings DocType: `allow_user_to_edit_item_discount` and `disable_rounded_total`
- Settings event listeners in POSSale component for immediate UI updates
- Display settings change detection and event emission
- Toast notifications for settings changes to provide user feedback
- Comprehensive CHANGELOG.md following Keep a Changelog format

### Changed
- Settings now update immediately in all components without requiring page refresh
- POS Settings store now includes `reloadSettings()` method for forced refresh
- Event detection system now includes all pricing and display fields

### Fixed
- "Allow Item Discount" setting not persisting to database
- "Disable Rounded Total" setting not persisting to database
- Settings reverting to defaults after page refresh

## [1.0.2] - 2025-10-28

### Added
- App version display in POS header with enhanced styling
- UOM pricing logic with conversion factor support

### Changed
- Enhanced POS header to display current application version
- Updated UOM pricing calculations to account for conversion factors

## [1.0.1] - 2025-10-27

### Added
- Invoice filtering logic and store management
- Partial Payments feature in POS
- Stock validation and event-driven settings management
- Word-order independent search for cached items
- Referral code management with validation and coupon generation
- Fuzzy word-order independent item search
- Periodic stock sync functionality
- Performance optimizations for low-end devices
- Developer tooling for debugging

### Changed
- Improved search functionality with fuzzy matching and relevance scoring
- Enhanced offline mode and UI responsiveness
- Optimized ItemsSelector component for better performance
- Improved list view functionality

### Fixed
- Stock badge synchronization issue
- Stock reservations preservation during refresh
- Warehouse change detection
- Logger.success error in Web Worker context
- High-priority performance and memory issues

## [1.0.0] - Initial Release

### Added
- Core POS functionality
- Offline mode support
- Invoice management
- Customer management
- Item search and selection
- Payment processing
- Shift management
- Stock tracking

[Unreleased]: https://github.com/yourusername/pos_next/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/yourusername/pos_next/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/yourusername/pos_next/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/yourusername/pos_next/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/yourusername/pos_next/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/yourusername/pos_next/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/yourusername/pos_next/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/yourusername/pos_next/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/yourusername/pos_next/releases/tag/v1.0.0
