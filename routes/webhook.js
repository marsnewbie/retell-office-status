const express = require("express");
const router = express.Router();
const { sendOrderEmail } = require("../services/email");

// 如果以后恢复签名校验，可取消注释以下内容
// const crypto = require("crypto");
// function verifySignature(req, secret) {
//   const signature = req.headers["x-retell-signature"];
//   const payload = req.rawBody;
//   const expectedSignature = crypto
//     .createHmac("sha256", secret)
//     .update(payload)
//     .digest("hex");
//   return signature === expectedSignature;
// }

router.post("/order-confirmed", async (req, res) => {
  try {
    const { event, call } = req.body;

    console.log("📥 Full webhook payload:");
    console.log(JSON.stringify(req.body, null, 2));

    console.log("✅ Webhook event received:", event);

    if (event !== "call_analyzed") {
      console.log("ℹ️ Not a call_analyzed event, skipping.");
      return res.status(200).send("Not a call_analyzed event, skipping.");
    }

    const data = call?.custom;
    if (!data) {
      console.warn("⚠️ No custom data in call object.");
      return res.status(200).send("No custom data.");
    }

    if (data.order_confirmed !== true) {
      console.log("ℹ️ Order not confirmed, skipping.");
      return res.status(200).send("Order not confirmed.");
    }

    console.log("📦 Order Data:");
    console.log(JSON.stringify(data, null, 2));

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

    console.log("✅ Email sent.");
    res.status(200).send("Email sent");
  } catch (err) {
    console.error("❌ Error in webhook handler:", err);
    res.status(200).send("Error but acknowledged.");
  }
});

module.exports = router;
