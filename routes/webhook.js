const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { sendOrderEmail } = require("../services/email");

router.post("/order-confirmed", async (req, res) => {
  try {
    const { event, call } = req.body;
    const fromNumber = call?.from_number || "unknown";
    const agentId = call?.agent_id || "";

    // ★ 只处理 call_analyzed 类型
    if (event !== "call_analyzed") {
      return res.status(200).send("Skipped – not call_analyzed");
    }

    // ★ 结构化分析数据路径
    const analysis = call?.call_analysis?.custom_analysis_data || {};
    if (!analysis || typeof analysis !== "object") {
      console.log("❌ Missing call_analysis.custom_analysis_data");
      return res.status(400).send("Missing analysis data");
    }

    if (analysis.order_confirmed !== true) {
      console.log("ℹ️ Skipped – order not confirmed");
      return res.status(200).send("Skipped – order not confirmed");
    }

    // ───────────── 加载商家 config 列表并匹配 agent_id ─────────────
    const configDir = path.join(__dirname, "../config");
    const configFiles = fs.readdirSync(configDir).filter(f => f.endsWith(".json"));

    let matchedConfig = null;
    for (const file of configFiles) {
      const fullPath = path.join(configDir, file);
      const config = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      if (config.agent_id === agentId) {
        matchedConfig = config;
        break;
      }
    }

    if (!matchedConfig) {
      console.log(`❌ No config matched agent_id: ${agentId}`);
      return res.status(404).send("No matching store config");
    }

    // ───────────── 发邮件 ─────────────
    await sendOrderEmail({
      config: matchedConfig,
      rawData: analysis,
      from_number: fromNumber,
    });

    console.log(`✅ Email sent for store: ${matchedConfig.store_name}`);
    res.status(200).send("Email sent");
  } catch (err) {
    console.error("❌ Error in webhook handler:", err);
    res.status(200).send("Error but acknowledged.");
  }
});

module.exports = router;
