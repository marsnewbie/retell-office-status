const express = require("express");
const { DateTime } = require("luxon");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const storeHours = {
  lanternhouse: {
    timezone: "Europe/London",
    hours: {
      0: { open: "17:00", close: "23:30" }, // Sunday
      1: null,                              // Monday closed
      2: { open: "11:00", close: "22:00" }, // Tuesday
      3: { open: "17:00", close: "22:30" }, // Wednesday
      4: { open: "17:00", close: "22:30" }, // Thursday
      5: { open: "16:00", close: "23:30" }, // Friday
      6: { open: "16:00", close: "23:30" }  // Saturday
    }
  },
  fuhua: {
    timezone: "Pacific/Auckland",
    hours: {
      0: { open: "11:00", close: "21:00" }, // Sunday
      1: { open: "11:00", close: "21:00" }, // Monday
      2: { open: "16:00", close: "21:00" }, // Tuesday
      3: { open: "11:00", close: "21:00" }, // Wednesday
      4: { open: "11:00", close: "21:00" }, // Thursday
      5: { open: "11:00", close: "21:00" }, // Friday
      6: { open: "11:00", close: "21:00" }  // Saturday
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

  if (!storeData) {
    return res.status(400).json({ error: "Invalid store ID" });
  }

  const now = DateTime.now().setZone(storeData.timezone);
  const dayIndex = now.weekday % 7; // 1 = Monday ... 7 = Sunday → 0 = Sunday
  const todayHours = storeData.hours[dayIndex];
  const office_status = isOpenNow(now, todayHours) ? "OPEN" : "CLOSED";

  res.json({ office_status });
};

app.get("/get-office-status", handler);
app.post("/get-office-status", handler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


