const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { sendOrderEmail } = require("../services/email");
const { setOrder } = require("../services/orderCache");

router.post("/order-confirmed", async (req, res) => {
  try {
    const { event, call } = req.body;
    const fromNumber = call?.from_number || "unknown";
    const analysis = call?.call_analysis?.custom_analysis_data || {};

    // ✅ 新增：补充 summary 字段（来自 call.summary）
    if (call.summary) {
      analysis.summary = call.summary;
    }

    // ★ 只处理 call_analyzed 类型
    if (event !== "call_analyzed") {
      return res.status(200).send("Skipped – not call_analyzed");
    }

    if (!analysis || typeof analysis !== "object") {
      console.log("❌ Missing call_analysis.custom_analysis_data");
      return res.status(400).send("Missing analysis data");
    }

    if (analysis.order_confirmed !== true) {
      console.log("ℹ️ Skipped – order not confirmed");
      return res.status(200).send("Skipped – order not confirmed");
    }

    // ───────────── 根据 URL 参数加载 config ─────────────
    const store = (req.query.store || "").toLowerCase();
    const configPath = path.join(__dirname, `../config/${store}.json`);

    if (!store || !fs.existsSync(configPath)) {
      console.log("❌ Invalid or missing store param:", store);
      return res.status(400).send("Invalid or missing store");
    }

    const matchedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const map = matchedConfig.field_mapping || {};

    // ───────────── 发邮件 ─────────────
    await sendOrderEmail({
      config: matchedConfig,
      rawData: analysis,
      from_number: fromNumber,
    });

    console.log(`✅ Email sent for store: ${matchedConfig.store_name}`);

    // ───────────── 保存订单到缓存 ─────────────
    const mapped = {};
    for (const [key, field] of Object.entries(map)) {
      mapped[key] = analysis[field] || "";
    }

    await setOrder(store, {
      store_name: matchedConfig.store_name,
      order_type: mapped.order_type,
      first_name: mapped.first_name,
      delivery_address: analysis.delivery_address || "",
      menu_items: mapped.items,
      menu_items_with_notes: mapped.items_with_notes,
      item_options: mapped.item_options,
      item_options_price: mapped.item_options_price,
      quantities: mapped.quantities,
      subtotal: mapped.subtotal,
      delivery_fee: analysis.delivery_fee || "0.00",
      total: mapped.total,
      note: mapped.note,
      from_number: fromNumber,
      call_summary: analysis.summary || analysis.detailed_call_summary || ""
    });

    console.log(`🧾 Order cached for store: ${store}`);

    res.status(200).send("Email + cache success");
  } catch (err) {
    console.error("❌ Error in webhook handler:", err);
    res.status(200).send("Error but acknowledged.");
  }
});

module.exports = router;
