import React, { useState, useEffect } from "react";
import {
  Modal,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Box,
  Banner,
  ButtonGroup,
  Button,
} from "@shopify/polaris";
import {
  fetchLowStockConfigApi,
  saveLowStockConfigApi,
  resetLowStockConfigApi,
} from "../services/appApi";

const DEFAULT_LOW_STOCK_SETTINGS = {
  enabled: true,
  badgeText: "Only {stock} left in stock!",
  almostSoldOutText: "High Demand — Almost Sold Out!",
  showIcon: true,
  icon: "🔥",
  showSubtext: true,
  subtext: "Selling fast – high demand detected.",
  threshold: 6,
  showDaysRemaining: true,
  backgroundColor: "#FFF1F2",
  borderColor: "#FECDD3",
  textColor: "#991B1B",
  subtextColor: "#B91C1C",
  borderRadius: 8,
  fontSize: 15,
  padding: 12,
  pulseAnimation: true,
};

const ICON_PRESETS = [
  { label: "🔥 Flame", value: "🔥" },
  { label: "⚡ Lightning", value: "⚡" },
  { label: "⚠️ Warning", value: "⚠️" },
  { label: "⏳ Hourglass", value: "⏳" },
  { label: "🏷️ Tag", value: "🏷️" },
  { label: "📦 Box", value: "📦" },
  { label: "Custom Emoji", value: "custom" },
];

function stripEmojiPrefix(text) {
  if (!text) return "";
  return text.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D\u2600-\u26FF\u2700-\u27BF]+/u, "").trim();
}

function ColorPickerField({ label, value, onChange }) {
  const safeHex = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value || "") ? value : "#000000";

  return (
    <BlockStack gap="100">
      <Text variant="bodySm" as="label" fontWeight="medium">
        {label}
      </Text>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "#FFFFFF",
          border: "1px solid #C9CCCF",
          borderRadius: "8px",
          padding: "4px 8px",
          height: "36px",
        }}
      >
        <label
          style={{
            position: "relative",
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            backgroundColor: safeHex,
            border: "1px solid rgba(0,0,0,0.2)",
            cursor: "pointer",
            display: "inline-block",
            flexShrink: 0,
            overflow: "hidden",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
          }}
          title="Click to open color picker"
        >
          <input
            type="color"
            value={safeHex}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              top: "-10px",
              left: "-10px",
              width: "48px",
              height: "48px",
              opacity: 0,
              cursor: "pointer",
              border: "none",
            }}
          />
        </label>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          style={{
            border: "none",
            outline: "none",
            width: "100%",
            fontSize: "13px",
            fontFamily: "monospace",
            color: "#202223",
            background: "transparent",
          }}
        />
      </div>
    </BlockStack>
  );
}

export default function LowStockCustomizeModal({
  open,
  onClose,
  shop = "",
  onSaved = () => {},
}) {
  const [settings, setSettings] = useState(DEFAULT_LOW_STOCK_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [previewState, setPreviewState] = useState("in_stock"); // 'in_stock' | 'depleted'
  const [iconMode, setIconMode] = useState("🔥");

  useEffect(() => {
    if (open && shop) {
      setLoading(true);
      fetchLowStockConfigApi(shop)
        .then((data) => {
          if (data) {
            const merged = {
              ...DEFAULT_LOW_STOCK_SETTINGS,
              ...data,
            };
            setSettings(merged);
            const foundPreset = ICON_PRESETS.find((p) => p.value === merged.icon);
            setIconMode(foundPreset ? foundPreset.value : "custom");
          }
        })
        .catch((err) => {
          console.error("Failed to load low stock settings:", err);
        })
        .finally(() => setLoading(false));
    }
  }, [open, shop]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanBadgeText = stripEmojiPrefix(settings.badgeText);
      const cleanAlmostSoldOutText = stripEmojiPrefix(settings.almostSoldOutText);
      const payloadToSave = {
        ...settings,
        badgeText: cleanBadgeText || "Only {stock} left in stock!",
        almostSoldOutText: cleanAlmostSoldOutText || "High Demand — Almost Sold Out!",
      };
      const res = await saveLowStockConfigApi(shop, payloadToSave);
      setToastMessage({ tone: "success", text: "Low Stock Badge customization saved!" });
      onSaved(res.data || payloadToSave);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setToastMessage({
        tone: "critical",
        text: err.message || "Failed to save low stock settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetLowStockConfigApi(shop);
      setSettings(DEFAULT_LOW_STOCK_SETTINGS);
      setIconMode("🔥");
      setToastMessage({
        tone: "success",
        text: "Reset to default settings!",
      });
      onSaved(DEFAULT_LOW_STOCK_SETTINGS);
    } catch (err) {
      setToastMessage({
        tone: "critical",
        text: err.message || "Failed to reset settings.",
      });
    } finally {
      setResetting(false);
    }
  };

  if (!open) return null;

  // Compute preview message
  let baseMsg = "";
  if (previewState === "in_stock") {
    baseMsg = (settings.badgeText || "Only {stock} left in stock!").replace(/\{stock\}/gi, "4");
  } else {
    baseMsg = (settings.almostSoldOutText || "High Demand — Almost Sold Out!").replace(/\{stock\}/gi, "0");
  }

  // Strip leading emoji if showIcon is false, or prepend icon if configured
  const cleanBaseMsg = stripEmojiPrefix(baseMsg);
  let previewDisplay = cleanBaseMsg;
  if (settings.showIcon && settings.icon && settings.icon !== "none") {
    previewDisplay = `${settings.icon} ${cleanBaseMsg}`;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Customize Low Stock Badge Storefront Component"
      primaryAction={{
        content: "Save changes",
        onAction: handleSave,
        loading: saving,
        disabled: loading || resetting,
      }}
      secondaryActions={[
        {
          content: "Reset Defaults",
          onAction: handleReset,
          loading: resetting,
          disabled: loading || saving,
        },
        {
          content: "Cancel",
          onAction: onClose,
          disabled: saving || resetting,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {toastMessage && (
            <Banner
              tone={toastMessage.tone}
              onDismiss={() => setToastMessage(null)}
            >
              <p>{toastMessage.text}</p>
            </Banner>
          )}

          {/* LIVE PREVIEW BOX WITH STATE SWITCHER */}
          <Box
            padding="400"
            borderWidth="025"
            borderColor="border"
            borderRadius="300"
            background="bg-surface-secondary"
          >
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="050">
                  <Text variant="headingSm" as="h4">
                    Storefront Live Preview
                  </Text>
                  <Text variant="bodyXs" tone="subdued">
                    {previewState === "in_stock" ? "Simulating product with 4 units in stock" : "Simulating product with 0 / depleted units"}
                  </Text>
                </BlockStack>
                <ButtonGroup segmented>
                  <Button
                    size="slim"
                    pressed={previewState === "in_stock"}
                    onClick={() => setPreviewState("in_stock")}
                  >
                    In-Stock (4)
                  </Button>
                  <Button
                    size="slim"
                    pressed={previewState === "depleted"}
                    onClick={() => setPreviewState("depleted")}
                  >
                    Depleted / Sold Out (0)
                  </Button>
                </ButtonGroup>
              </InlineStack>

              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    padding: `${settings.padding ?? 12}px 16px`,
                    borderRadius: `${settings.borderRadius ?? 8}px`,
                    backgroundColor: settings.backgroundColor || "#FFF1F2",
                    border: `1px solid ${settings.borderColor || "#FECDD3"}`,
                    color: settings.textColor || "#991B1B",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: `${settings.fontSize ?? 15}px`,
                      fontWeight: "700",
                      lineHeight: "1.3",
                      color: settings.textColor || "#991B1B",
                    }}
                  >
                    <span>{previewDisplay}</span>
                  </div>
                  {settings.showSubtext && settings.subtext ? (
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: settings.subtextColor || "#B91C1C",
                        marginLeft: settings.showIcon ? "24px" : "0px",
                        marginTop: "2px",
                      }}
                    >
                      {settings.subtext}
                    </div>
                  ) : null}
                </div>
              </div>
            </BlockStack>
          </Box>

          <Divider />

          {/* BADGE CONTENT CONTROLS */}
          <FormLayout>
            <Checkbox
              label="Enable Low Stock Badge on storefront"
              helpText="When disabled, the low stock urgency badge is completely hidden on your storefront."
              checked={settings.enabled !== false}
              onChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />

            <Text variant="headingSm" as="h4">
              Badge Content & Messages
            </Text>

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <Checkbox
                  label="Show urgency icon / emoji"
                  checked={Boolean(settings.showIcon)}
                  onChange={(checked) => setSettings({ ...settings, showIcon: checked })}
                />
              </div>
              {settings.showIcon && (
                <div style={{ flex: 1 }}>
                  <Select
                    label="Badge Icon"
                    options={ICON_PRESETS}
                    value={iconMode}
                    onChange={(val) => {
                      setIconMode(val);
                      if (val !== "custom") {
                        setSettings({ ...settings, icon: val });
                      }
                    }}
                  />
                </div>
              )}
            </InlineStack>

            {settings.showIcon && iconMode === "custom" && (
              <TextField
                label="Custom Emoji / Icon"
                value={settings.icon}
                onChange={(val) => setSettings({ ...settings, icon: val })}
                helpText="Paste any emoji (e.g. 🚨, ⏳, 💥) or leave blank for none"
                autoComplete="off"
              />
            )}

            <TextField
              label="In-Stock Badge Message"
              value={settings.badgeText}
              onChange={(val) => setSettings({ ...settings, badgeText: val })}
              helpText="Message when inventory is available. Use {stock} placeholder for quantity (e.g. Only {stock} items left!)"
              autoComplete="off"
            />

            <TextField
              label="Depleted / Almost Sold Out Message"
              value={settings.almostSoldOutText}
              onChange={(val) => setSettings({ ...settings, almostSoldOutText: val })}
              helpText="Message shown when inventory is 0, negative, or depleted on storefront (e.g. High Demand — Almost Sold Out!)"
              autoComplete="off"
            />

            <Checkbox
              label="Show supporting subtext"
              checked={Boolean(settings.showSubtext)}
              onChange={(checked) => setSettings({ ...settings, showSubtext: checked })}
            />

            {settings.showSubtext && (
              <TextField
                label="Supporting Urgency Subtext"
                value={settings.subtext}
                onChange={(val) => setSettings({ ...settings, subtext: val })}
                helpText="Additional demand notice displayed below the main heading"
                autoComplete="off"
              />
            )}

            <Checkbox
              label="Show estimated days remaining when sales velocity is active"
              checked={Boolean(settings.showDaysRemaining)}
              onChange={(checked) =>
                setSettings({ ...settings, showDaysRemaining: checked })
              }
              helpText="When recent orders exist, replaces subtext with dynamic estimate (e.g. Selling fast — estimated 2 days remaining)"
            />

            <Divider />

            <Text variant="headingSm" as="h4">
              Threshold & Sizing
            </Text>

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <TextField
                  label="Low Stock Threshold (Units)"
                  type="number"
                  value={String(settings.threshold ?? 6)}
                  onChange={(val) =>
                    setSettings({
                      ...settings,
                      threshold: Math.max(1, Math.min(100, Number(val) || 1)),
                    })
                  }
                  helpText="Badge appears when inventory is at or below this number"
                  autoComplete="off"
                />
              </div>
              <div style={{ flex: 1 }}>
                <TextField
                  label="Badge Corner Radius (px)"
                  type="number"
                  value={String(settings.borderRadius ?? 8)}
                  onChange={(val) =>
                    setSettings({
                      ...settings,
                      borderRadius: Math.max(0, Math.min(50, Number(val) || 0)),
                    })
                  }
                  autoComplete="off"
                />
              </div>
            </InlineStack>

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <TextField
                  label="Main Text Font Size (px)"
                  type="number"
                  value={String(settings.fontSize ?? 15)}
                  onChange={(val) =>
                    setSettings({
                      ...settings,
                      fontSize: Math.max(11, Math.min(24, Number(val) || 15)),
                    })
                  }
                  helpText="Standard storefront text size (default: 15px)"
                  autoComplete="off"
                />
              </div>
              <div style={{ flex: 1 }}>
                <Checkbox
                  label="Enable pulse animation effect on storefront"
                  checked={Boolean(settings.pulseAnimation)}
                  onChange={(checked) =>
                    setSettings({ ...settings, pulseAnimation: checked })
                  }
                />
              </div>
            </InlineStack>

            <Divider />

            <Text variant="headingSm" as="h4">
              Colors & Styling
            </Text>

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Background Color"
                  value={settings.backgroundColor}
                  onChange={(val) =>
                    setSettings({ ...settings, backgroundColor: val })
                  }
                />
              </div>
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Border Color"
                  value={settings.borderColor}
                  onChange={(val) =>
                    setSettings({ ...settings, borderColor: val })
                  }
                />
              </div>
            </InlineStack>

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Main Text Color"
                  value={settings.textColor}
                  onChange={(val) =>
                    setSettings({ ...settings, textColor: val })
                  }
                />
              </div>
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Subtext Color"
                  value={settings.subtextColor}
                  onChange={(val) =>
                    setSettings({ ...settings, subtextColor: val })
                  }
                />
              </div>
            </InlineStack>
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
