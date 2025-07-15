const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

// 注册格式对齐 helper
handlebars.registerHelper("pad", function (str, len) {
  str = str || "";
  return str.padEnd(len, " ");
});

async function sendOrderEmail({ config, rawData, from_number }) {
  const user = config.email_from.user;
  const pass = process.env[config.email_from.pass_env];

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });

  const mapped = {};
  const map = config.field_mapping || {};
  for (const [key, field] of Object.entries(map)) {
    mapped[key] = rawData[field] || "";
  }

  // ✅ 补充字段
  mapped.store_name = config.store_name || "";
  mapped.call_summary = rawData.detailed_call_summary || "";
  mapped.from_number = from_number;

  // ✅ 构建 items_array（含价格）—— 优先用 menu_items_with_notes
  const rawItems = mapped.items_with_notes || mapped.items || "";
  const items = rawItems
    .split(/[,;\n]/)       // 逗号 / 分号 / 换行都可分割
    .map(i => i.trim())
    .filter(Boolean);
  const qtys = (mapped.quantities || "").split(",").map(q => q.trim());
  const prices = (rawData.item_prices || "").split(",").map(p => p.trim());

  mapped.items_array = items.map((name, i) => ({
    name,
    qty: qtys[i] || "1",
    price: prices[i] ? `${prices[i]}` : ""
  }));

  const templateFile = config.template || "default_template.hbs";
  const templatePath = path.join(__dirname, "../emailTemplates", templateFile);

  let emailText = "";
  let emailHtml = "";

  if (fs.existsSync(templatePath)) {
    const source = fs.readFileSync(templatePath, "utf-8");
    const template = handlebars.compile(source);
    emailText = template(mapped);
    emailHtml = `<div style="font-family:monospace; font-size:16px; white-space:pre;">${emailText}</div>`;
  } else {
    emailText = fallbackTemplate(mapped);
    emailHtml = emailText.replace(/\n/g, "<br>");
  }

  const mailOptions = {
    from: `"AI Order Bot" <${user}>`,
    to: config.email_to,
    subject: `📦 New Order from ${config.store_name}`,
    text: emailText,
    html: emailHtml
  };

  console.log("📨 Sending email for store:", config.store_name);
  console.log("📨 Preview:\n", emailText);

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.response);
  } catch (err) {
    console.error("❌ Failed to send email:", err);
  }
}

function fallbackTemplate(d) {
  const lines = (d.items_array || []).map(i =>
    `${i.name.padEnd(22)} x${i.qty}  ${i.price || ""}`
  ).join("\n");

  return `
🗒 Call Summary: ${d.call_summary || ""}

*** ${d.store_name || "New Order"} ***
Order Type: ${d.order_type || "N/A"}
Customer Name: ${d.first_name || "N/A"}
Phone Number: ${d.phone || "N/A"}
Address: ${d.delivery_address || "N/A"}
-----------------------------
Item                   Qty   Price
${lines || "No items"}
-----------------------------
Subtotal: £${d.subtotal || "0.00"}
Delivery Fee: £${d.delivery_fee || "0.00"}
Total: £${d.total || "0.00"}
-----------------------------
Thank you!
${d.note ? "📝 Note: " + d.note : ""}
📞 Incoming Call: ${d.from_number || "N/A"}
`.trim();
}

module.exports = { sendOrderEmail };
