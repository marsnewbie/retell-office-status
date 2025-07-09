const express = require("express");
const router = express.Router();
const { sendOrderEmail } = require("../services/email");
const crypto = require("crypto");

// 校验 Retell 的签名
function verifySignature(req, secret) {
  const signature = req.headers["x-retell-signature"];
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return signature === expectedSignature;
}

router.post("/order-confirmed", async (req, res) => {
  try {
    const RETELL_API_KEY = process.env.RETELL_API_KEY;

    if (!verifySignature(req, RETELL_API_KEY)) {
      console.error("❌ Invalid Retell signature");
      return res.status(403).send("Invalid signature");
    }

    const { event, call } = req.body;
    console.log("✅ Webhook event:", event);

    if (event !== "call_ended") {
      return res.status(200).send("Not a call_ended event, skipping.");
    }

    const data = call?.custom;
    if (!data || data.order_confirmed !== true) {
      return res.status(200).send("Order not confirmed, skipping.");
    }

    console.log("📦 Order confirmed! Sending email...");
    await sendOrderEmail({
      customer_first_name: data.first_name,
      customer_phone: data.phone_number,
      delivery_or_collection: data.order_type,
      delivery_address: data.delivery_address,
      delivery_postcode: data.postcode,
      menu_items: data.menu_items,
      menu_quantities: data.quantities,
      order_note: data.order_note,
      subtotal: data.subtotal_amount,
      total_price: data.total_amount
    });

    res.status(200).send("Email sent");
  } catch (err) {
    console.error("❌ Email error:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
