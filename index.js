const express = require("express");
const bodyParser = require("body-parser");
const { DateTime } = require("luxon");
const app = express();
const port = process.env.PORT || 8080;

// ✅ 捕获 rawBody 用于 Retell 签名验证
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// ✅ 店铺营业时间配置
const storeHours = {
  lanternhouse: {
    timezone: "Europe/London",
    hours: {
      0: { open: "17:00", close: "23:30" },
      1: null,
      2: { open: "11:00", close: "22:00" },
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

// ✅ 判断当前时间是否在营业时段内
function isOpenNow(currentTime, todayHours) {
  if (!todayHours) return false;
  const [oh, om] = todayHours.open.split(":").map(Number);
  const [ch, cm] = todayHours.close.split(":").map(Number);
  const openMinutes = oh * 60 + om;
  const closeMinutes = ch * 60 + cm;
  const nowMinutes = currentTime.hour * 60 + currentTime.minute;
  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
}

// ✅ 主接口
const handler = (req, res) => {
  const store = (req.query.store || "").toLowerCase();
  const storeData = storeHours[store];

  if (!storeData) {
    console.warn("⛔ 无效门店请求:", store);
    return res.status(400).json({ error: "Invalid store ID" });
  }

  const now = DateTime.now().setZone(storeData.timezone);
  const dayIndex = now.weekday % 7;
  const todayHours = storeData.hours[dayIndex];
  const office_status = isOpenNow(now, todayHours) ? "OPEN" : "CLOSED";

  console.log(`[Status Check] Store: ${store}, Time: ${now.toISO()}, Status: ${office_status}`);
  res.json({ office_status });
};

// ✅ Debug 接口
const debugHandler = (req, res) => {
  const store = (req.query.store || "").toLowerCase();
  const storeData = storeHours[store];

  if (!storeData) {
    return res.status(400).json({ error: "Invalid store ID" });
  }

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

// ✅ 启动服务
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
