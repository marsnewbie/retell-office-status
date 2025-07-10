const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { sendOrderEmail } = require("../services/email");

router.post("/order-confirmed", async (req, res) => {
  try {
    const { event, call } = req.body;
    const fromNumber = call?.from_number || "unknown";
    const analysis = call?.call_analysis?.custom_analysis_data || {};

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

    // ───────────── 发邮件 ─────────────
    await sendOrderEmail({
      config: matchedConfig,
      rawData: analysis,
      from_number: fromNumber,
    });

    console.log(`✅ Email sent for store: ${matchedConfig.store_name}`);
    res.status(200).send("Email sent");
  } catch (err) {
    console.error("❌ Error in webhook handler:", err);
    res.status(200).send("Error but acknowledged.");
  }
});

module.exports = router;
