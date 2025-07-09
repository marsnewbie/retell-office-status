const express = require("express");
const router = express.Router();
const { sendOrderEmail } = require("../services/email");

router.post("/order-confirmed", async (req, res) => {
  try {
    const { event_type, call_analysis } = req.body;
    console.log("✅ Webhook event received:", event_type);

    if (event_type !== "call_analysis") {
      console.log("ℹ️ Not a call_analysis event, skipping.");
      return res.status(200).send("Not a call_analysis event, skipping.");
    }

    const data = call_analysis?.custom;
    if (!data) {
      console.warn("⚠️ No custom data found in call_analysis object.");
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
