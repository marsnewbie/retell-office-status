const express = require("express");
const bodyParser = require("body-parser");
const { DateTime } = require("luxon");
const app = express();
const port = process.env.PORT || 3000;

// ✅ 单独保留 webhook 的 raw body 给签名验证
app.use(
  "/webhook/order-confirmed",
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);

// ✅ 其他请求走标准 JSON 中间件
app.use(bodyParser.json());

// ✅ 门店营业时间配置
const storeHours = {
  lanternhouse: {
    timezone: "Europe/London",
    hours: {
      0: { open: "17:00", close: "23:30" }, // Sunday
      1: null,
      2: { open: "11:00", close: "22:00" }, // Tuesday
      3: { open: "17:00", close: "22:30" },
      4: { open: "17:00", close: "22:30" },
      5: { open: "16:00", close: "23:30" },
      6: { open: "16:00", close: "23:30" }
    }
  },
  fuhua: {
    timezone: "Pacific/Auckland",
    hours: {
      0: { open: "11:00", close: "21:00" },
      1: { open: "11:00", close: "21:00" },
      2: { open: "16:00", close: "21:00" },
      3: { open: "11:00", close: "21:00" },
      4: { open: "11:00", close: "21:00" },
      5: { open: "11:00", close: "21:00" },
      6: { open: "11:00", close: "21:00" }
    }
  }
};

function isOpenNow(currentTime, todayHours) {
  if (!todayHours) return false;
  const [oh, om] = todayHours.open.split(":").map(Number);
  const [ch, cm] = todayHours.close.split(":").map(Number);
  const openMinutes = oh * 60 + om;
  const closeMinutes = ch * 60 + cm;
  const nowMinutes = currentTime.hour * 60 + currentTime.minute;
  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
}

const handler = (req, res) => {
  const store = (req.query.store || "").toLowerCase();
  const storeData = storeHours[store];
  if (!storeData) return res.status(400).json({ error: "Invalid store ID" });

  const now = DateTime.now().setZone(storeData.timezone);
  const dayIndex = now.weekday % 7;
  const todayHours = storeData.hours[dayIndex];
  const office_status = isOpenNow(now, todayHours) ? "OPEN" : "CLOSED";

  res.json({ office_status });
};

const debugHandler = (req, res) => {
  const store = (req.query.store || "").toLowerCase();
  const storeData = storeHours[store];
  if (!storeData) return res.status(400).json({ error: "Invalid store ID" });

  const now = DateTime.now().setZone(storeData.timezone);
  const dayIndex = now.weekday % 7;
  const todayHours = storeData.hours[dayIndex];
  const isOpen = isOpenNow(now, todayHours);

  res.json({
    store,
    timezone: storeData.timezone,
    current_time: now.toISO(),
    weekday: dayIndex,
    today_hours: todayHours || "Closed",
    is_open: isOpen,
    office_status: isOpen ? "OPEN" : "CLOSED"
  });
};

// ✅ 路由注册
app.get("/get-office-status", handler);
app.post("/get-office-status", handler);
app.get("/debug", debugHandler);

// ✅ 注册 webhook 路由
const webhookRoutes = require("./routes/webhook");
app.use("/webhook", webhookRoutes);

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
