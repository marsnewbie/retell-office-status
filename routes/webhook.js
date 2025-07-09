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
    const fromNumber = call?.from_number || "unknown";
    const data = call?.call_analysis?.custom;

    console.log("✅ Webhook event:", event);
    console.log("📞 From number:", fromNumber);
    console.log("📝 Order confirmed:", data?.order_confirmed);
    console.log("📦 Items:", data?.menu_items);

    if (event !== "call_analyzed") {
      console.log("ℹ️ Skipped: Not call_analyzed");
      return res.status(200).send("Skipped: Not call_analyzed");
    }

    if (!data) {
      console.warn("⚠️ Skipped: No custom data.");
      return res.status(200).send("Skipped: No custom data.");
    }

    if (data.order_confirmed !== true) {
      console.log("ℹ️ Skipped: Order not confirmed.");
      return res.status(200).send("Skipped: Order not confirmed.");
    }

    await sendOrderEmail({
      from_number: fromNumber,
      delivery_or_collection: data.order_type || "N/A",
      delivery_address: data.delivery_address || "",
      delivery_postcode: data.postcode || "",
      menu_items: data.menu_items || "",
      menu_quantities: data.quantities || "",
      order_note: data.order_note || "",
      subtotal: data.subtotal_amount || 0,
      delivery_fee: data.delivery_fee || 0,
      total_price: data.total_amount || 0
    });

    console.log("✅ Email sent.");
    res.status(200).send("Email sent");
  } catch (err) {
    console.error("❌ Error in webhook handler:", err);
    res.status(200).send("Error but acknowledged.");
  }
});

module.exports = router;
