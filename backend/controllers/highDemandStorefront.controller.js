const mongoose = require("mongoose");
const HighDemandStorefront = require("../models/HighDemandStorefront");
const Store = require("../models/Store");
const connectDB = require("../config/mongodb");
const shopifyGraphQL = require("../services/shopifyGraphql");

async function ensureConnected() {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
}

function normalizeShop(shop) {
  if (!shop) return "";
  return String(shop)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function normalizeVariantGid(variantId) {
  if (!variantId) return "";
  const value = String(variantId).trim();
  if (value.startsWith("gid://shopify/ProductVariant/")) {
    return value;
  }
  const cleanNum = value.replace(/\D/g, "");
  return `gid://shopify/ProductVariant/${cleanNum || value}`;
}

// ==================================================
// GET HIGH-DEMAND STOREFRONT STATUS
// GET /api/storefront/high-demand-status
// ==================================================

async function getHighDemandStorefrontStatus(req, res) {
  try {
    await ensureConnected();

    const shop = normalizeShop(
      req.query.shop ||
      req.headers["x-shopify-shop-domain"] ||
      req.headers["x-shop-domain"] ||
      ""
    );

    const rawVariantId = req.query.variantId || req.query.variant_id || "";
    const variantId = normalizeVariantGid(rawVariantId);

    if (!shop || !variantId) {
      return res.status(200).json({
        success: true,
        data: {
          enabled: false,
          urgencyBadgeEnabled: false,
          preOrderEnabled: false,
          currentStock: 0,
        },
      });
    }

    // 1. Fetch Storefront Configuration
    const config = await HighDemandStorefront.findOne({
      shop,
      variantId,
    }).lean();

    // 2. Fetch Real-time Current Inventory from Shopify
    let currentStock = null;

    try {
      const store = await Store.findOne({
        $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      }).lean();

      if (store?.accessToken) {
        const query = `
          query GetVariantStock($id: ID!) {
            node(id: $id) {
              ... on ProductVariant {
                id
                inventoryQuantity
              }
            }
          }
        `;
        const data = await shopifyGraphQL(shop, store.accessToken, query, { id: variantId });
        if (data?.node && data.node.inventoryQuantity !== undefined) {
          currentStock = Number(data.node.inventoryQuantity);
        }
      }
    } catch (stockErr) {
      console.warn("[HighDemandStorefront] Could not fetch real-time inventory:", stockErr.message);
    }

    const LowStockBadgeConfig = require("../models/LowStockBadgeConfig");
    const PreOrderConfig = require("../models/PreOrderConfig");
    const [globalLowStockConfig, globalPreOrderConfig] = await Promise.all([
      LowStockBadgeConfig.findOne({
        $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      }).lean().catch(() => null),
      PreOrderConfig.findOne({
        $or: [{ shop }, { shop: new RegExp(`^${shop}$`, "i") }],
      }).lean().catch(() => null),
    ]);

    const isGlobalLowStockEnabled = globalLowStockConfig ? Boolean(globalLowStockConfig.enabled) : true;
    const isGlobalPreOrderEnabled = globalPreOrderConfig ? Boolean(globalPreOrderConfig.enabled) : true;

    const showUrgencyBadge = isGlobalLowStockEnabled && isUrgencyConfigured;
    const showPreOrder = isGlobalPreOrderEnabled && isPreOrderConfigured && stock <= 0;
    const isOverallEnabled = showUrgencyBadge || showPreOrder;

    const showIcon = globalLowStockConfig?.showIcon !== false;
    const configuredIcon = (globalLowStockConfig?.icon && globalLowStockConfig?.icon !== "none") ? globalLowStockConfig.icon : "";
    const rawBadgeText = globalLowStockConfig?.badgeText || config?.badgeText || "Only {stock} left in stock!";
    const depletedText = globalLowStockConfig?.almostSoldOutText || config?.almostSoldOutText || "High Demand — Almost Sold Out!";
    const baseText = stock > 0
      ? rawBadgeText.replace(/\{stock\}/gi, String(stock))
      : (depletedText || rawBadgeText.replace(/\{stock\}/gi, "0"));

    const cleanBaseText = String(baseText || "")
      .replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D\u2600-\u26FF\u2700-\u27BF]+/u, "")
      .trim();

    let formattedBadgeText = cleanBaseText;
    if (showIcon && configuredIcon) {
      formattedBadgeText = `${configuredIcon} ${cleanBaseText}`;
    }

    return res.status(200).json({
      success: true,
      data: {
        enabled: isOverallEnabled,
        urgencyBadgeEnabled: showUrgencyBadge,
        preOrderEnabled: showPreOrder,
        currentStock: stock,
        badgeText: formattedBadgeText,
        badgeColor: globalLowStockConfig?.textColor || config?.badgeColor || "#991B1B",
        badgeBackgroundColor: globalLowStockConfig?.backgroundColor || config?.badgeBackgroundColor || "#FFF1F2",
        icon: configuredIcon,
        showIcon: showIcon,
        preOrderText: config?.preOrderText || "Pre-Order Now",
        variantId,
        shop,
      },
    });
  } catch (error) {
    console.error("Get High Demand Storefront Status Error:", error);
    return res.status(200).json({
      success: true,
      data: {
        enabled: false,
        urgencyBadgeEnabled: false,
        preOrderEnabled: false,
        currentStock: 0,
      },
    });
  }
}

module.exports = {
  getHighDemandStorefrontStatus,
};
