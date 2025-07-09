const express = require("express");
const router = express.Router();
const { sendOrderEmail } = require("../services/email");

// const crypto = require("crypto"); // 暂时不启用签名校验

// // 如果后续需要启用签名校验，请取消注释：
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
    console.log("✅ Webhook event received:", event);

    // ✅ 支持 call_ended 和 call_analyzed 两种类型
    if (!["call_ended", "call_analyzed"].includes(event)) {
      console.log("ℹ️ Not a relevant event, skipping.");
      return res.status(200).send("Not a relevant event, skipping.");
    }

    const data = call?.custom;
    if (!data) {
      console.warn("⚠️ No custom data in call object.");
      return res.status(200).send("No custom data.");
    }

    if (data.order_confirmed !== true) {
      console.log("ℹ️ Order not confirmed, skipping.");
      return res.status(200).send("Order not confirmed, skipping.");
    }

    // ✅ 日志展示完整订单数据
    console.log("📦 Order Data Received:");
    console.log(JSON.stringify(data, null, 2));

    // ✅ 调用发邮件函数
    console.log("📨 Sending order email...");
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
    console.error("❌ Error during webhook processing:", err);
    res.status(200).send("Error occurred, but acknowledged.");
  }
});

module.exports = router;
