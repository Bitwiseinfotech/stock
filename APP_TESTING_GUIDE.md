# Smart Stock - End-to-End Application Testing Guide

Comprehensive testing guide and validation checklist for the **Smart Stock** Shopify Application, covering Admin Portal (React Router + Polaris), Backend Services (Express + MongoDB), Webhooks, and Storefront Theme App Extensions.

---

## Table of Contents
1. [Prerequisites & Test Environment Setup](#1-prerequisites--test-environment-setup)
2. [Architecture & Data Flow Overview](#2-architecture--data-flow-overview)
3. [Module-by-Module Test Plans](#3-module-by-module-test-plans)
   - [3.1 Dashboard & Health Metrics](#31-dashboard--health-metrics)
   - [3.2 Dead Stock Management](#32-dead-stock-management)
   - [3.3 High Demand & Stockout Alerts](#33-high-demand--stockout-alerts)
   - [3.4 Pre-Orders System](#34-pre-orders-system)
   - [3.5 Product Bundles](#35-product-bundles)
   - [3.6 Smart Badges & Automation](#36-smart-badges--automation)
   - [3.7 Storefront Widget Customization](#37-storefront-widget-customization)
   - [3.8 Reports & Analytics](#38-reports--analytics)
   - [3.9 Settings & Notifications](#39-settings--notifications)
4. [Storefront Theme App Extensions Verification](#4-storefront-theme-app-extensions-verification)
5. [Shopify Function (Payment Customization - Hide COD)](#5-shopify-function-payment-customization---hide-cod)
6. [Backend API & Webhook Testing](#6-backend-api--webhook-testing)
7. [Edge Cases & Error Handling Checklist](#7-edge-cases--error-handling-checklist)
8. [End-to-End Regression Test Matrix](#8-end-to-end-regression-test-matrix)

---

## 1. Prerequisites & Test Environment Setup

### Local Services
Ensure both the frontend and backend servers are running:
```bash
# Terminal 1: Backend Server (Node / Express on port 5000) 
cd backend
npm run dev

# Terminal 2: Shopify CLI Development Tunnel
shopify app dev --store <your-development-store>.myshopify.com
```

### Verification Checklist Before Testing:
- [ ] MongoDB connection string is healthy (`Connected to MongoDB` in backend console).
- [ ] Development store has sample products:
  - At least 2 products with 0 recent sales & high inventory (for Dead Stock testing).
  - At least 2 products with multiple recent orders or low inventory (for High Demand testing).
  - At least 1 product with 0 inventory or unreleased draft (for Pre-Orders testing).
- [ ] App is installed with required scopes (`read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_orders`).
- [ ] Theme App Extension is activated in Shopify Theme Customizer (`Online Store > Customize > App embeds / Theme blocks`).

---

## 2. Architecture & Data Flow Overview

```
               ┌────────────────────────────────────────┐
               │    Shopify Admin UI (React + Polaris)  │
               └───────────────────┬────────────────────┘
                                   │ Authenticated fetch
                                   ▼
               ┌────────────────────────────────────────┐
               │     Express Backend API (Port 5000)     │
               └─────────┬────────────────────┬─────────┘
                         │                    │
            Read / Write │                    │ Webhook ingestion
                         ▼                    ▼
               ┌──────────────────┐  ┌──────────────────┐
               │     MongoDB      │  │  Shopify Admin   │
               │  (Store Data,    │  │    GraphQL &     │
               │   Configs, Rules)│  │   REST APIs      │
               └──────────────────┘  └──────────────────┘
                         ▲
                         │ Storefront Proxy / API
                         │
               ┌─────────┴──────────────────────────────┐
               │ Storefront Theme App Extensions         │
               │ (Clearance, High Demand, Pre-Order, etc)│
               └────────────────────────────────────────┘
```

---

## 3. Module-by-Module Test Plans

### 3.1 Dashboard & Health Metrics
**Route:** `/app`  
**Key Components:** `src/pages/Dashboard/Dashboard.jsx`

| Test ID | Test Scenario | Steps to Execute | Expected Result |
| :--- | :--- | :--- | :--- |
| **DB-01** | Initial Dashboard Load | Navigate to app root. | Metric cards display: Total Inventory Value, Dead Stock Value, High Demand Risk, and Store Health Score without loader hang. |
| **DB-02** | Health Score Computation | Review Health Score breakdown gauge. | Score accurately reflects weighted average of dead stock ratio and stockout risk. |
| **DB-03** | Urgent Action Cards | Click any action CTA ("Apply Clearance", "Reorder Now"). | Correctly navigates to the respective module with filtered query parameters. |
| **DB-04** | Inventory Sync Trigger | Click "Sync Store Inventory" button. | Dispatches `/api/dead-stock/sync` call; toast notification confirms sync initiated; data refreshes. |

---

### 3.2 Dead Stock Management
**Routes:** `/app/dead-stock`, `/app/dead-stock/:variantId`  
**Key Components:** `DeadStock.jsx`, `DeadStockProduct.jsx`, `DeadStockRow.jsx`

| Test ID | Test Scenario | Steps to Execute | Expected Result |
| :--- | :--- | :--- | :--- |
| **DS-01** | Dead Stock Identification | Open `/app/dead-stock`. Filter by threshold (e.g., > 30, 60, 90 days with 0 sales). | Only variants meeting the criteria are displayed with days dormant, current stock, and tied-up capital. |
| **DS-02** | Product Detail & Strategy Selection | Click a dead stock product row to open detail view (`/app/dead-stock/:variantId`). | Details page loads showing sales history chart, days dormant, and strategies: Clearance Sale, Progressive Markdown, or Bundle. |
| **DS-03** | Launch Clearance Sale | 1. Select "Clearance Sale" tab.<br>2. Set discount percentage (e.g., 25%) and start/end dates.<br>3. Click "Apply Clearance Sale". | - Shopify product price updates / compare_at_price set.<br>- Tag `dead-stock` or `clearance` added.<br>- Offer stored in MongoDB.<br>- Status reflects "Active Clearance". |
| **DS-04** | Progressive Markdown Setup | 1. Choose "Progressive Markdown".<br>2. Define tiers: Day 1: 15%, Day 15: 30%, Day 30: 50%.<br>3. Save schedule. | Rule persisted in database; backend cron job registers schedule for automatic price reduction. |
| **DS-05** | Collection Bulk Clearance Sale | 1. Use the Bulk Sale modal on Dead Stock listing.<br>2. Pick a collection and discount %.<br>3. Submit. | Bulk operation executes via Shopify GraphQL; all collection variants discounted without timeout. |
| **DS-06** | Clearance Reversion / Removal | In Dead Stock detail view, click "End Clearance Sale". | Original prices restored from backup; clearance tags removed. |

---

### 3.3 High Demand & Stockout Alerts
**Routes:** `/app/high-demand`, `/app/high-demand/:variantId`  
**Key Components:** `HighDemand.jsx`, `HighDemandProduct.jsx`, `HighDemandReorders.jsx`

| Test ID | Test Scenario | Steps to Execute | Expected Result |
| :--- | :--- | :--- | :--- |
| **HD-01** | High Velocity Detection | Navigate to `/app/high-demand`. | Lists products with high sales velocity (units/day) and low estimated days of inventory remaining. |
| **HD-02** | Days to Stockout Calculation | Check the "Days Until Stockout" indicator on a fast-moving item. | Formula: `Current Inventory / Average Daily Velocity`. Verify numbers match recent order quantities. |
| **HD-03** | Urgency & Scarcity Badging | Enable "Low Stock Alert Badge" for a product with < 5 units left. | Storefront widget displays "Only X left in stock - order soon!" badge on the product page. |
| **HD-04** | Supplier Reorder Recommendation | 1. Open `/app/high-demand/:variantId`.<br>2. Check recommended reorder quantity.<br>3. Click "Generate PO / Reorder Request". | Creates reorder record in `HighDemandReorders`; allows exporting or emailing draft PO to vendor. |

---

### 3.4 Pre-Orders System
**Route:** `/app/pre-orders`  
**Key Components:** `src/pages/PreOrders/PreOrders.jsx`

| Test ID | Test Scenario | Steps to Execute | Expected Result |
| :--- | :--- | :--- | :--- |
| **PO-01** | Out-of-Stock Pre-Order | 1. Select a product with 0 inventory.<br>2. Enable "Allow Pre-Order when OOS".<br>3. Set estimated delivery message (e.g., "Ships in 2 weeks"). | - Shopify inventory policy set to `continue` selling when out of stock.<br>- Product tagged with `smart-preorder`. |
| **PO-02** | Launch Pre-Order (Upcoming Product) | 1. Create a Pre-Order campaign for a new/unreleased product.<br>2. Set campaign launch date and maximum pre-order cap (e.g., 50 units). | Campaign saved; storefront shows pre-order countdown and "Pre-Order Now" CTA instead of "Add to Cart". |
| **PO-03** | Order Placement & Tagging | Place a test pre-order checkout in the storefront. | - Order processed successfully.<br>- Order receives `pre-order` note / tag.<br>- Order appears in Pre-Orders tracking table in admin. |
| **PO-04** | Inventory Restock Auto-Fulfillment | Update inventory above 0 for the pre-ordered variant. | System detects restock; alerts merchant that pre-orders can now be fulfilled. |

---

### 3.5 Product Bundles
**Route:** `/app/bundles`  
**Key Components:** `src/pages/Bundles/Bundles.jsx`

| Test ID | Test Scenario | Steps to Execute | Expected Result |
| :--- | :--- | :--- | :--- |
| **BD-01** | Bundle Creation (Dead Stock + High Demand) | 1. Click "Create Bundle".<br>2. Select Item A (Dead Stock) + Item B (Popular item).<br>3. Set bundle discount (e.g., 20% off Item A).<br>4. Save Bundle. | Bundle record created; bundle block on Item B's product page offers Item A as an add-on. |
| **BD-02** | Storefront Bundle Add-to-Cart | On storefront, check the bundle box and click "Add Bundle to Cart". | Both items added to cart with the bundle discount applied correctly in line item properties or cart discount. |
| **BD-03** | Bundle Stock Depletion | Manually set stock of Item A to 0. | Bundle widget on storefront automatically hides or shows "Item Out of Stock" without breaking the main product buy box. |

---

### 3.6 Smart Badges & Automation
**Route:** `/app/smart-badges`  
**Key Components:** `src/pages/SmartBadges/SmartBadgeRecommendations.jsx`

| Test ID | Test Scenario | Steps to Execute | Expected Result |
| :--- | :--- | :--- | :--- |
| **SB-01** | Rule-Based Badge Assignment | Set rule: Tag `clearance` gets "Clearance - Up to 50% Off" red badge. | Storefront displays the badge on collection grid & product page. |
| **SB-02** | Stock-Level Dynamic Badges | Set rule: Inventory < 3 gets "Almost Gone" orange badge. | Automatically appears for qualifying items; disappears when inventory exceeds threshold. |
| **SB-03** | Badge Position & Styling | Change badge position from "Top-Left" to "Bottom-Right" in Admin. | Storefront reflects updated placement immediately after cache refresh. |

---

### 3.7 Storefront Widget Customization
**Route:** `/app/customization/clearance-sale`  
**Key Components:** `ClearanceSaleCustomization.jsx`

| Test ID | Test Scenario | Steps to Execute | Expected Result |
| :--- | :--- | :--- | :--- |
| **CU-01** | Admin Live Preview | Change Typography (Font Family, Size, Weight) and Colors (Background, Text, Border). | The in-admin live preview updates instantaneously without page reload. |
| **CU-02** | Save Configuration | Click "Save Settings". | Toast confirmation appears; MongoDB document updated for current `shop`. |
| **CU-03** | Storefront Style Reflection | Refresh the storefront product page with active clearance. | Widget styling matches saved settings (CSS variables / inline styles applied). |
| **CU-04** | Reset to Defaults | Click "Reset to Defaults" in Admin. | Settings reset to standard factory styling and sync to storefront. |

---

### 3.8 Reports & Analytics
**Route:** `/app/reports`  
**Key Components:** `src/pages/Reports/Reports.jsx`

| Test ID | Test Scenario | Steps to Execute | Expected Result |
| :--- | :--- | :--- | :--- |
| **RP-01** | Dead Stock Capital Recovery | View "Recovered Revenue" chart. | Displays sales revenue generated specifically from discounted dead stock items. |
| **RP-02** | Pre-Order Revenue Breakdown | View Pre-order conversion analytics. | Displays total pre-order sales, pending orders, and average fulfillment timeline. |
| **RP-03** | Date Range Filter | Switch date range between "Last 7 Days", "Last 30 Days", "Year to Date". | Charts and KPI cards update dynamically to reflect the selected window. |

---

### 3.9 Settings & Notifications
**Route:** `/app/settings`  
**Key Components:** `src/pages/Settings/Settings.jsx`

| Test ID | Test Scenario | Steps to Execute | Expected Result |
| :--- | :--- | :--- | :--- |
| **ST-01** | Threshold Configuration | Update Dead Stock dormant days threshold from 60 to 45 days. | Dead stock list recalculates and immediately reflects items dormant for 45+ days. |
| **ST-02** | Email Notification Setup | Configure merchant email for low-stock and dead-stock summary alerts. | Trigger test email; merchant receives formatted notification digest. |

---

## 4. Storefront Theme App Extensions Verification

**Extension Path:** `extensions/smart-stock-theme-ext/blocks/`

### 1. Clearance Sale Block (`clearance_sale.liquid`)
- [ ] Add block to Product Details template in Shopify Theme Editor.
- [ ] Verify widget only displays when the product has active clearance or `dead-stock` status.
- [ ] Verify countdown timer (if end date specified) counts down accurately.
- [ ] Verify original price shows strike-through and discounted price displays highlighted.

### 2. High Demand Embed (`high-demand-embed.liquid` & `high-demand-stockout.liquid`)
- [ ] Test on product with high sales velocity: verify "🔥 High Demand: Selling fast" banner renders.
- [ ] Test on product with low stock: verify "Only X left!" progress bar / text renders.

### 3. Pre-Order Block (`launch-preorder.liquid`)
- [ ] Add block to Product page.
- [ ] Verify standard "Add to Cart" button is replaced or augmented with "Pre-Order Now".
- [ ] Verify delivery timeline badge renders cleanly above or below CTA.

### 4. Smart Stock Bundle (`smart-stock-bundle.liquid`)
- [ ] Add block below the main product buy box.
- [ ] Verify bundle discount calculation matches admin settings.
- [ ] Test single-click "Add Both to Cart" on mobile and desktop viewports.

---

## 5. Shopify Function (Payment Customization - Hide COD)

**Extension Path:** `extensions/hide-cod-preorder/`

### Purpose:
Prevent Cash on Delivery (COD) payment method when a cart contains pre-order items to mitigate non-delivery risks.

### Test Cases:
| Test ID | Cart Contents | Expected Checkout Behavior |
| :--- | :--- | :--- |
| **COD-01** | Regular in-stock items only | Cash on Delivery (COD) is **available** in payment options. |
| **COD-02** | 1 Regular item + 1 Pre-Order item | Cash on Delivery (COD) is **hidden / disabled**; credit card / prepaid required. |
| **COD-03** | Pre-Order item only | Cash on Delivery (COD) is **hidden / disabled**. |

---

## 6. Backend API & Webhook Testing

### Core REST Endpoints:
| Method | Endpoint | Expected Status | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dead-stock?shop=...` | `200 OK` | Fetch dead stock products list. |
| `POST` | `/api/dead-stock/sync` | `200 OK` | Trigger inventory re-indexing. |
| `GET` | `/api/high-demand?shop=...` | `200 OK` | Fetch velocity and stockout risks. |
| `GET` | `/api/customization/clearance-sale?shop=...` | `200 OK` | Fetch storefront styling config. |
| `POST` | `/api/customization/clearance-sale` | `200 OK` | Save widget styling settings. |
| `GET` | `/api/storefront/product-widget?shop=...&productId=...` | `200 OK` | Storefront public widget data. |

### Webhook Handlers (`app/routes/webhooks.*` & `backend/webhooks/`):
- **`inventory_levels/update`**:
  - Decrement stock in Shopify -> Verify backend updates stockout estimate and reorder triggers.
- **`orders/create`**:
  - New order placed -> Verify sales velocity recalculated; if pre-order, order record logged.
- **`products/delete`**:
  - Product deleted in Shopify -> Verify dead stock / bundle associations purged from MongoDB.
- **`app/uninstalled`**:
  - App uninstalled -> Verify session revoked and cleanup jobs initiated.

---

## 7. Edge Cases & Error Handling Checklist

- [ ] **Zero Inventory & Negative Inventory:** Ensure products with 0 or negative inventory (inventory tracking disabled) don't cause infinite calculations in velocity formulas.
- [ ] **Multi-Variant Products:** Ensure discounts or pre-order settings applied to Variant A do not unintentionally alter Variant B.
- [ ] **Multi-Currency:** Check if clearance discount prices and bundle savings display correctly in the customer's localized currency.
- [ ] **Concurrent Rate Limits:** Verify GraphQL API client uses automatic backoff / retry when throttling (`THROTTLED` error).
- [ ] **Theme Compatibility:** Test storefront widgets on default Shopify themes (Dawn, Refresh, Sense) across mobile, tablet, and desktop viewports.

---

## 8. End-to-End Regression Test Matrix

Use this quick scorecard during each release cycle:

| Area | Feature | Tester | Date | Status (Pass/Fail/Block) | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Admin | Dashboard & Metrics | | | | |
| Admin | Dead Stock Listing & Filters | | | | |
| Admin | Apply Clearance Discount | | | | |
| Admin | Progressive Markdown Schedule | | | | |
| Admin | High Demand Alerts & PO Draft | | | | |
| Admin | Pre-Order Creation & Toggling | | | | |
| Admin | Bundle Configurator | | | | |
| Admin | Widget Customization Preview & Save | | | | |
| Theme | Clearance Widget Rendering | | | | |
| Theme | High Demand Badge Rendering | | | | |
| Theme | Pre-Order Button & Delivery Note | | | | |
| Theme | Bundle Add-to-Cart Functionality | | | | |
| Checkout | Hide COD for Pre-Orders Function | | | | |
| Backend | Webhook Processing (`inventory`, `orders`) | | | | |
| Backend | Database Persistence & Recovery | | | | |

---
*Generated for Smart Stock Shopify Application.*
