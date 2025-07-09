const express = require("express");
const router = express.Router();
const { sendOrderEmail } = require("../services/email");

router.post("/order-confirmed", async (req, res) => {
  try {
    const { event, call } = req.body;
    const fromNumber = call?.from_number || "unknown";

    // ★ 正确路径：call.call_analysis.custom
    const analysis = call?.call_analysis?.custom || {};

    // ───── 调试日志（精简） ─────
    console.log(`✅ Webhook event: ${event}`);
    console.log(`📞 From number: ${fromNumber}`);
    console.log(`📦 Order confirmed: ${analysis.order_confirmed}`);
    console.log(`📋 Items: ${analysis.menu_items}`);

    // 仅处理 call_analyzed
    if (event !== "call_analyzed") {
      console.log("ℹ️ Skipped: Not call_analyzed");
      return res.status(200).send("Skipped – not call_analyzed");
    }

    // 若 order_confirmed 不为 true 则跳过
    if (analysis.order_confirmed !== true) {
      console.log("ℹ️ Skipped: order_confirmed not true");
      return res.status(200).send("Skipped – order not confirmed");
    }

    // 发送邮件
    await sendOrderEmail({
      from_number:     fromNumber,
      delivery_or_collection: analysis.order_type        || "N/A",
      delivery_address:       analysis.delivery_address || "",
      delivery_postcode:      analysis.postcode         || "",
      menu_items:             analysis.menu_items       || "",
      menu_quantities:        analysis.quantities       || "",
      order_note:             analysis.order_note       || "",
      subtotal:               analysis.subtotal_amount  || 0,
      delivery_fee:           analysis.delivery_fee     || 0,
      total_price:            analysis.total_amount     || 0
    });

    console.log("✅ Email sent.");
    res.status(200).send("Email sent");
  } catch (err) {
    console.error("❌ Error in webhook handler:", err);
    res.status(200).send("Error but acknowledged.");
  }
});

module.exports = router;
