const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

const businessHours = {
  0: { open: "17:00", close: "23:30" },
  1: null,
  2: { open: "17:00", close: "22:00" },
  3: { open: "17:00", close: "22:30" },
  4: { open: "17:00", close: "22:30" },
  5: { open: "16:00", close: "23:30" },
  6: { open: "16:00", close: "23:30" },
};

function isOpenNow(ukTime, hoursToday) {
  if (!hoursToday) return false;
  const [openHour, openMinute] = hoursToday.open.split(":").map(Number);
  const [closeHour, closeMinute] = hoursToday.close.split(":").map(Number);
  const open = new Date(ukTime);
  open.setHours(openHour, openMinute, 0);
  const close = new Date(ukTime);
  close.setHours(closeHour, closeMinute, 0);
  return ukTime >= open && ukTime <= close;
}

app.get("/get-office-status", (req, res) => {
  const now = new Date();
  const ukTime = new Date(now.toLocaleString("en-GB", { timeZone: "Europe/London" }));
  const day = ukTime.getDay();
  const hoursToday = businessHours[day];
  const office_status = isOpenNow(ukTime, hoursToday) ? "OPEN" : "CLOSED";

  res.json({
    dynamic_variables: {
      office_status,
    },
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
