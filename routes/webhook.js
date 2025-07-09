const express = require("express");
const router = express.Router();

// ✅ 引入发送邮件逻辑
const { sendOrderEmail } = require("../services/email");

// const crypto = require("crypto"); // 如果未来要启用签名校验再打开

// // ✅ 签名校验函数（预留）
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
    // const RETELL_API_KEY = process.env.RETELL_API_KEY;
    // if (!verifySignature(req, RETELL_API_KEY)) {
    //   console.error("❌ Invalid Retell signature");
    //   return res.status(403).send("Invalid signature");
    // }

    const { event, call } = req.body;

    if (!event || !call) {
      console.warn("⚠️ Missing 'event' or 'call' in request body.");
      return res.status(400).send("Missing data.");
    }

    console.log("✅ Webhook event received:", event);

    if (event !== "call_ended") {
      console.log("ℹ️ Not a call_ended event, skipping.");
      return res.status(200).send("Not a call_ended event.");
    }

    const data = call.custom;
    if (!data) {
      console.warn("⚠️ No custom data in call object.");
      return res.status(200).send("No custom data.");
    }

    if (data.order_confirmed !== true) {
      console.log("ℹ️ Order not confirmed, skipping.");
      return res.status(200).send("Order not confirmed.");
    }

    // ✅ 打印所有字段以便调试
    console.log("📦 Order Data Received:");
    console.log(JSON.stringify(data, null, 2));

    // ✅ 构建邮件内容并发送
    console.log("📨 Sending email...");
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

    console.log("✅ Email sent successfully.");
    res.status(200).send("Email sent.");
  } catch (err) {
    console.error("❌ Error in webhook:", err);
    res.status(500).send("Internal error, but acknowledged.");
  }
});

module.exports = router;
