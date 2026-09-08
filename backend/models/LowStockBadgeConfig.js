const mongoose = require("mongoose");

const LowStockBadgeConfigSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    badgeText: { type: String, default: "🔥 Only {stock} left in stock!" },
    almostSoldOutText: { type: String, default: "🔥 High Demand — Almost Sold Out!" },
    showIcon: { type: Boolean, default: true },
    icon: { type: String, default: "🔥" },
    showSubtext: { type: Boolean, default: true },
    subtext: { type: String, default: "Selling fast – high demand detected." },
    threshold: { type: Number, default: 5, min: 1, max: 100 },
    showDaysRemaining: { type: Boolean, default: true },
    backgroundColor: { type: String, default: "#FFF1F2" },
    borderColor: { type: String, default: "#FECDD3" },
    textColor: { type: String, default: "#991B1B" },
    subtextColor: { type: String, default: "#B91C1C" },
    borderRadius: { type: Number, default: 8 },
    fontSize: { type: Number, default: 15 },
    padding: { type: Number, default: 12 },
    pulseAnimation: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.LowStockBadgeConfig ||
  mongoose.model(
    "LowStockBadgeConfig",
    LowStockBadgeConfigSchema,
    "tbl_lowstockbadgeconfigs"
  );
