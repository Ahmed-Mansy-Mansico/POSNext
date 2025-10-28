# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/yourusername/pos_next/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/yourusername/pos_next/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/yourusername/pos_next/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/yourusername/pos_next/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/yourusername/pos_next/releases/tag/v1.0.0
