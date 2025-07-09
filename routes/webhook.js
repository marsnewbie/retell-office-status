const express = require("express");
const router = express.Router();
const { sendOrderEmail } = require("../services/email");

router.post("/order-confirmed", async (req, res) => {
  try {
    const { event, call } = req.body;
    const fromNumber = call?.from_number || "unknown";

    console.log(`✅ Webhook event: ${event}`);
    console.log(`📞 From number: ${fromNumber}`);
    console.log(`📦 Order confirmed: ${call?.order_confirmed}`);
    console.log(`📋 Items: ${call?.menu_items}`);

    if (event !== "call_analyzed") {
      console.log("ℹ️ Skipped: Not call_analyzed");
      return res.status(200).send("Skipped non-call_analyzed");
    }

    if (call?.order_confirmed !== true) {
      console.log("ℹ️ Skipped: order_confirmed not true");
      return res.status(200).send("Order not confirmed");
    }

    await sendOrderEmail({
      from_number: fromNumber,
      delivery_or_collection: call.order_type || "N/A",
      delivery_address: call.delivery_address || "",
      delivery_postcode: call.postcode || "",
      menu_items: call.menu_items || "",
      menu_quantities: call.quantities || "",
      order_note: call.order_note || "",
      subtotal: call.subtotal_amount || 0,
      delivery_fee: call.delivery_fee || 0,
      total_price: call.total_amount || 0
    });

    console.log("✅ Email sent.");
    res.status(200).send("Email sent");
  } catch (err) {
    console.error("❌ Error in webhook handler:", err);
    res.status(200).send("Error but acknowledged.");
  }
});

module.exports = router;
