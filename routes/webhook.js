const express = require("express");
const router  = express.Router();
const { sendOrderEmail } = require("../services/email");

router.post("/order-confirmed", async (req, res) => {
  try {
    const { event, call } = req.body;
    const fromNumber = call?.from_number || "unknown";

    // ★ 唯一有效路径：call.call_analysis.custom_analysis_data
    const analysis = call?.call_analysis?.custom_analysis_data || {};
    // 其他旧路径若将来需要可取消注释
    // const analysis = call?.call_analysis?.custom ||
    //                  call?.call_analysis?.custom_analysis_data ||
    //                  call?.custom_analysis_data || {};

    // ── 关键日志 ──
    console.log("✅ Webhook event:", event);
    console.log("📞 From number:", fromNumber);
    console.log("📦 Order confirmed:", analysis.order_confirmed);
    console.log("📋 Items:", analysis.menu_items);

    // 只处理 call_analyzed
    if (event !== "call_analyzed") {
      return res.status(200).send("Skipped – not call_analyzed");
    }

    // 未确认订单则跳过
    if (analysis.order_confirmed !== true) {
      return res.status(200).send("Skipped – order not confirmed");
    }

    // 发送邮件
    await sendOrderEmail({
      from_number:            fromNumber,
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
