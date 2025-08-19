const express = require("express");
const fs = require("fs");
const path = require("path");

const { normalizeUKPostcode, pickBestPatternMatch } = require("../services/postcode");
const { geocodeToCoord, drivingDistanceMiles } = require("../services/mapClient");

const router = express.Router();

function loadStoreConfig(storeId) {
  const p = path.join(process.cwd(), "config", `${storeId}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function round2(n) { return Math.round(Number(n) * 100) / 100; }

router.get("/quote", async (req, res) => {
  try {
    const store = String(req.query.store || "").trim();
    if (!store) return res.status(400).json({ success: false, error: "store is required" });

    const cfg = loadStoreConfig(store);
    if (!cfg || !cfg.delivery) {
      return res.status(404).json({ success: false, error: "store delivery config not found" });
    }

    const dcfg = cfg.delivery;
    const subtotal = Number(req.query.subtotal || 0);

    // ---------- Postcode 规则 ----------
    if ((dcfg.active_rule_type || "postcode") === "postcode") {
      const raw = req.query.postcode || req.query.address || "";
      const normalized = dcfg.postcode_rules?.normalize_uk_postcode ? normalizeUKPostcode(raw) : String(raw).toUpperCase();
      if (!normalized) {
        return res.json({
          success: true,
          delivery_available: false,
          rule_summary: "Postcode required."
        });
      }
      const areas = dcfg.postcode_rules?.areas || [];
      const patterns = areas.map(a => a.pattern);
      const hitKey = pickBestPatternMatch(patterns, normalized);
      if (!hitKey) {
        return res.json({
          success: true,
          delivery_available: false,
          rule_summary: "We currently deliver to selected WF9/WF7/S72/WF4 areas or within 3 miles"
        });
      }
      const hit = areas.find(a => a.pattern === hitKey);
      const feeBase = Number(hit.fee);
      const min = Number(
        hit.min_order_threshold ??
        dcfg.postcode_rules.default_min_order_threshold ??
        0
      );
      const extra = Number(
        hit.extra_fee_if_below_threshold ??
        dcfg.postcode_rules.default_extra_fee_if_below_threshold ??
        0
      );

      const payload = {
        success: true,
        delivery_available: true,
        delivery_fee: round2(feeBase),
        rule_summary: `We deliver to ${hitKey} and nearby postcodes`
      };
      if (min > 0) payload.min_order_threshold = min;
      if (min > 0 && subtotal < min && extra > 0) payload.extra_fee_if_below_threshold = round2(extra);
      return res.json(payload);
    }

    // ---------- Distance 规则 ----------
    // 1) 门店坐标
    const origin = cfg.location || cfg.origin || {};
    if (!origin.lat || !origin.lng) {
      return res.json({ success: true, delivery_available: false, rule_summary: "Store coordinates missing" });
    }
    // 2) 客户坐标
    const query = req.query.address || req.query.postcode;
    if (!query) {
      return res.json({ success: true, delivery_available: false, rule_summary: "Address or postcode required." });
    }
    const dest = await geocodeToCoord(query);
    if (!dest) {
      return res.json({ success: true, delivery_available: false, rule_summary: "Address not recognized." });
    }
    // 3) 计算距离
    const miles = await drivingDistanceMiles(origin, dest);
    if (miles == null) {
      return res.json({ success: true, delivery_available: false, rule_summary: "Distance service unavailable." });
    }

    const rules = dcfg.distance_rules || {};
    const bands = rules.bands || [];
    const noServiceBeyond = Number(rules.no_service_beyond ?? Infinity);
    if (miles > noServiceBeyond) {
      return res.json({
        success: true,
        delivery_available: false,
        rule_summary: `We deliver up to ${noServiceBeyond} miles`
      });
    }

    const matched = bands.find(b => miles <= Number(b.max_distance));
    if (!matched) {
      return res.json({ success: true, delivery_available: false, rule_summary: "Out of delivery distance." });
    }

    // 统一用 postcode 规则里的默认 min/extra（与要求一致：min=10，未达 +1）
    const min = Number(dcfg.postcode_rules?.default_min_order_threshold ?? 0);
    const feeOver = Number(matched.fee_if_subtotal_gte || 0);
    const feeUnder = Number(matched.fee_if_subtotal_lt || feeOver);
    const fee = subtotal >= min ? feeOver : feeUnder;

    const resp = {
      success: true,
      delivery_available: true,
      delivery_fee: round2(fee),
      rule_summary: `Within ${matched.max_distance} miles band (distance ~ ${round2(miles)} mi)`
    };
    if (min > 0) resp.min_order_threshold = min;
    if (subtotal < min && feeUnder > feeOver) {
      resp.extra_fee_if_below_threshold = round2(feeUnder - feeOver);
    }
    return res.json(resp);

  } catch (err) {
    console.error("[delivery/quote]", err);
    return res.status(500).json({
      success: false,
      error: "internal_error",
      rule_summary: "Temporary error. Please try again."
    });
  }
});

module.exports = router;
