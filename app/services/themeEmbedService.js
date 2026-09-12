/**
 * themeEmbedService.js
 * Auto-enables the smart-stock-embed block in the merchant's active theme.
 * Called on every app load — fully idempotent (safe to call repeatedly).
 *
 * Shopify App Embed blocks (target: "head") are stored in
 * config/settings_data.json under the theme. We read, patch, and write back.
 */

const SHOPIFY_API_VERSION = "2024-10";
const APP_EMBED_BLOCK_NAME = "smart-stock-embed";

/**
 * Get all themes for a shop
 */
async function getThemes(shop, accessToken) {
  const res = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/themes.json`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to get themes: ${res.status}`);
  }
  const data = await res.json();
  return data.themes || [];
}

/**
 * Get a theme asset value
 */
async function getThemeAsset(shop, accessToken, themeId, assetKey) {
  const res = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to get asset ${assetKey}: ${res.status}`);
  }
  const data = await res.json();
  return data.asset;
}

/**
 * Update (PUT) a theme asset
 */
async function putThemeAsset(shop, accessToken, themeId, assetKey, value) {
  const res = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/themes/${themeId}/assets.json`,
    {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset: {
          key: assetKey,
          value,
        },
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update asset: ${res.status} — ${errText}`);
  }
  return res.json();
}

/**
 * Main function: Enable smart-stock-embed in the merchant's active theme.
 *
 * App embed blocks (target: head) live in settings_data.json under
 * "current.blocks" map. The type is:
 *   "shopify://apps/{app-handle}/blocks/{block-name}"
 *
 * @param {string} shop - e.g. "store.myshopify.com"
 * @param {string} accessToken - offline access token
 * @param {string} appHandle - e.g. "smart-stock"
 * @returns {Promise<{success: boolean, reason: string}>}
 */
async function enableSmartStockEmbed(shop, accessToken, appHandle = "smart-stock") {
  try {
    const cleanShop = String(shop).trim().replace(/^https?:\/\//, "");

    // 1. Find active (main) theme
    const themes = await getThemes(cleanShop, accessToken);
    const mainTheme = themes.find((t) => t.role === "main");
    if (!mainTheme) {
      return { success: false, reason: "No active theme found" };
    }

    const themeId = mainTheme.id;

    // 2. Load settings_data.json
    let settingsJson = {};
    try {
      const asset = await getThemeAsset(cleanShop, accessToken, themeId, "config/settings_data.json");
      settingsJson = JSON.parse(asset?.value || "{}");
    } catch (parseErr) {
      return { success: false, reason: `Could not read settings_data.json: ${parseErr.message}` };
    }

    // 3. Ensure "current" exists
    if (!settingsJson.current) {
      settingsJson.current = {};
    }

    // 4. App embed blocks live under "current.blocks"
    if (!settingsJson.current.blocks || typeof settingsJson.current.blocks !== "object") {
      settingsJson.current.blocks = {};
    }

    const blockType = `shopify://apps/${appHandle}/blocks/${APP_EMBED_BLOCK_NAME}`;

    // 5. Check if already enabled — skip unnecessary write
    const existingKey = Object.keys(settingsJson.current.blocks).find(
      (k) => settingsJson.current.blocks[k]?.type === blockType
    );

    if (existingKey && settingsJson.current.blocks[existingKey].disabled === false) {
      return { success: true, reason: "Already enabled" };
    }

    // 6. Enable (or re-enable if disabled)
    const blockKey = existingKey || `smart-stock-embed-block`;
    settingsJson.current.blocks[blockKey] = {
      type: blockType,
      disabled: false,
      settings: {},
    };

    // 7. Write back updated settings_data.json
    const updatedValue = JSON.stringify(settingsJson, null, 2);
    await putThemeAsset(cleanShop, accessToken, themeId, "config/settings_data.json", updatedValue);

    console.log(`[ThemeEmbed] ✅ Enabled for ${cleanShop} (theme: ${mainTheme.name})`);
    return { success: true, reason: "Enabled successfully" };

  } catch (err) {
    console.warn(`[ThemeEmbed] Could not auto-enable embed for ${shop}:`, err.message);
    return { success: false, reason: err.message };
  }
}

module.exports = { enableSmartStockEmbed };
