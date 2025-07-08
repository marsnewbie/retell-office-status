const express = require("express");
const router = express.Router();
const { sendOrderEmail } = require("../services/email");

router.post("/order-confirmed", async (req, res) => {
  try {
    const data = req.body;

    console.log("📥 Received Retell Webhook Payload:");
    console.log(JSON.stringify(data, null, 2));

    // 明确判断是否为确认订单
    if (!data || data.order_confirmed !== true) {
      console.log("⚠️ Skipping email: order not confirmed.");
      return res.status(200).send("Order not confirmed");
    }

    console.log("📨 Triggering email send...");
    await sendOrderEmail(data);

    res.status(200).send("✅ Email sent");
  } catch (err) {
    console.error("❌ Email error:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
