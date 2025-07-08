const express = require("express");
const router = express.Router();
const { sendOrderEmail } = require("../services/email");

router.post("/order-confirmed", async (req, res) => {
  try {
    const data = req.body;

    if (!data || !data.total_price) {
      return res.status(200).send("No confirmed order.");
    }

    await sendOrderEmail(data);
    res.status(200).send("Email sent");
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
