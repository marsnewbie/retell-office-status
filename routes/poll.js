
const express = require("express");
const router = express.Router();
const { getOrder } = require("../services/orderCache");

router.get("/api/pending-orders", async (req, res) => {
  const store = req.query.store;
  if (!store) return res.status(400).json({ error: "Missing store parameter" });

  try {
    const order = await getOrder(store);
    if (order) {
      return res.json({ success: true, order });
    } else {
      return res.status(204).send();
    }
  } catch (err) {
    console.error("❌ Failed to get order:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
