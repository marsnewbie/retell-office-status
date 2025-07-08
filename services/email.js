const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

function formatOrderEmail(data) {
  const items = data.menu_items?.split(",") || [];
  const qtys = data.menu_quantities?.split(",") || [];

  const formattedItems = items.map((item, i) => {
    return `${item.trim()} x ${qtys[i]?.trim() || "1"}`;
  }).join("\n");

  return `
📞 New Order from ${data.customer_first_name || "Customer"} (${data.customer_phone || "unknown"})

📦 Order Type: ${data.delivery_or_collection}
📍 Address: ${data.delivery_address || "N/A"} (${data.delivery_postcode || ""})
🧾 Items:
${formattedItems}

📝 Note: ${data.order_note || "None"}

💰 Subtotal: £${data.subtotal}
🚚 Total: £${data.total_price}
  `;
}

async function sendOrderEmail(data) {
  const mailOptions = {
    from: '"AI Order Bot" <yourbot@gmail.com>',
    to: "store@example.com",  // ✅ 改为商家接单邮箱
    subject: "📦 New Order Received",
    text: formatOrderEmail(data)
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendOrderEmail };
