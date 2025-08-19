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

// 把原有的处理主体提出来
async function handleQuote(params) {
  const { store, subtotal = 0, postcode = "", address = "" } = params;

  const cfg = loadStoreConfig(store);
  if (!cfg || !cfg.delivery) {
    return { success: false, error: "store delivery config not found", rule_summary: "Store not found" };
  }

  const dcfg = cfg.delivery;
  const active = (dcfg.active_rule_type || "postcode").toLowerCase();

  if (active === "postcode") {
    const norm = dcfg.postcode_rules?.normalize_uk_postcode
      ? normalizeUKPostcode(postcode || address || "")
      : String(postcode || address || "").toUpperCase();

    if (!norm) {
      return { success: true, delivery_available: false, rule_summary: "Postcode required." };
    }

    const areas = dcfg.postcode_rules?.areas || [];
    const patterns = areas.map(a => a.pattern);
    const best = pickBestPatternMatch(patterns, norm);
    if (!best) {
      return {
        success: true,
        delivery_available: false,
        rule_summary: "We currently deliver to selected WF9/WF7/S72/WF4 areas or within 3 miles"
      };
    }
    const hit = areas.find(a => a.pattern === best);
    const base = Number(hit.fee);
    const min = Number(hit.min_order_threshold ?? dcfg.postcode_rules.default_min_order_threshold ?? 0);
    const extra = Number(hit.extra_fee_if_below_threshold ?? dcfg.postcode_rules.default_extra_fee_if_below_threshold ?? 0);

    const resp = {
      success: true,
      delivery_available: true,
      delivery_fee: round2(base),
      rule_summary: `We deliver to ${best} and nearby postcodes`
    };
    if (min > 0) resp.min_order_threshold = min;
    if (min > 0 && Number(subtotal) < min && extra > 0) resp.extra_fee_if_below_threshold = round2(extra);
    return resp;
  }

  // distance 规则
  const origin = cfg.location || {};
  if (!origin.lat || !origin.lng) {
    return { success: true, delivery_available: false, rule_summary: "Store coordinates missing" };
  }
  const destQuery = address || postcode;
  if (!destQuery) {
    return { success: true, delivery_available: false, rule_summary: "Address or postcode required." };
  }
  const dest = await geocodeToCoord(destQuery);
  if (!dest) {
    return { success: true, delivery_available: false, rule_summary: "Address not recognized." };
  }
  const miles = await drivingDistanceMiles(origin, dest);
  if (miles == null) {
    return { success: true, delivery_available: false, rule_summary: "Distance service unavailable." };
  }

  const bands = dcfg.distance_rules?.bands || [];
  const beyond = Number(dcfg.distance_rules?.no_service_beyond ?? Infinity);
  if (miles > beyond) {
    return { success: true, delivery_available: false, rule_summary: dcfg.distance_rules?.out_of_range_summary || "We deliver within 3 miles" };
  }
  const band = bands.find(b => miles <= Number(b.max_distance));
  if (!band) {
    return { success: true, delivery_available: false, rule_summary: dcfg.distance_rules?.out_of_range_summary || "Out of delivery distance." };
  }

  const min = Number(dcfg.postcode_rules?.default_min_order_threshold ?? 0);
  const feeOver = Number(band.fee_if_subtotal_gte || 0);
  const feeUnder = Number(band.fee_if_subtotal_lt || feeOver);
  const fee = Number(subtotal) >= min ? feeOver : feeUnder;

  const resp = {
    success: true,
    delivery_available: true,
    delivery_fee: round2(fee),
    rule_summary: dcfg.distance_rules?.summary || `Within ${band.max_distance} miles`
  };
  if (min > 0) resp.min_order_threshold = min;
  if (Number(subtotal) < min && feeUnder > feeOver) {
    resp.extra_fee_if_below_threshold = round2(feeUnder - feeOver);
  }
  return resp;
}

// GET 兼容（你之前已经能用 curl 成功）
router.get("/quote", async (req, res) => {
  try {
    const payload = {
      store: String(req.query.store || "").trim(),
      postcode: req.query.postcode || "",
      address: req.query.address || "",
      subtotal: Number(req.query.subtotal || 0)
    };
    if (!payload.store) return res.status(400).json({ success: false, error: "store is required" });
    const data = await handleQuote(payload);
    return res.json(data);
  } catch (e) {
    console.error("GET /delivery/quote error:", e);
    return res.status(500).json({ success: false, error: "internal_error", rule_summary: "Temporary error" });
  }
});

// POST（给 Retell 用）
router.post("/quote", async (req, res) => {
  try {
    const payload = {
      store: String(req.body.store || "").trim(),
      postcode: req.body.postcode || "",
      address: req.body.address || "",
      subtotal: Number(req.body.subtotal || 0)
    };
    if (!payload.store) return res.status(400).json({ success: false, error: "store is required" });
    const data = await handleQuote(payload);
    return res.json(data);
  } catch (e) {
    console.error("POST /delivery/quote error:", e);
    return res.status(500).json({ success: false, error: "internal_error", rule_summary: "Temporary error" });
  }
});

module.exports = router;
