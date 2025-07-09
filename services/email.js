const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

function formatOrderEmail(data) {
  const items = (data.menu_items || "").split(",").map(i => i.trim());
  const qtys = (data.quantities || "").toString().split(",").map(q => q.trim());

  const formattedItems = items.map((item, i) => {
    return `${item} x ${qtys[i] || "1"}`;
  }).join("\n");

  return `
📞 New Order from ${data.first_name || "Customer"} (${data.phone_number || "unknown"})

📦 Order Type: ${data.order_type || "N/A"}
📍 Address: ${data.delivery_address || "N/A"} (${data.postcode || ""})
🧾 Items:
${formattedItems || "None"}

📝 Note: ${data.order_note || "None"}

💰 Subtotal: £${data.subtotal_amount || "0.00"}
🚚 Delivery Fee: £${data.delivery_fee || "0.00"}
💳 Total: £${data.total_amount || "0.00"}
`.trim();
}

async function sendOrderEmail(data) {
  const mailOptions = {
    from: '"AI Order Bot" <marsnewbie@gmail.com>',
    to: "marsnewbie6655@gmail.com", // ✅ 可换成门店邮箱
    subject: "📦 New Order Received",
    text: formatOrderEmail(data)
  };

  console.log("📨 Attempting to send email...");
  console.log("📨 Email preview:\n", mailOptions.text);

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.response);
  } catch (err) {
    console.error("❌ Failed to send email:", err);
  }
}

module.exports = { sendOrderEmail };
