const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

async function sendOrderEmail({ config, rawData, from_number }) {
  // 发件人账号信息
  const user = config.email_from.user;
  const pass = process.env[config.email_from.pass_env];

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });

  // 字段映射（field_mapping）
  const mapped = {};
  const map = config.field_mapping || {};
  for (const [key, field] of Object.entries(map)) {
    mapped[key] = rawData[field] || "";
  }

  // 拼接额外字段
  mapped.from_number = from_number;
  mapped.call_summary = rawData.detailed_call_summary || "";

  // 构建 items_array 给模板使用
  const items = (mapped.items || "").split(",").map(i => i.trim());
  const qtys = (mapped.quantities || "").toString().split(",").map(q => q.trim());
  mapped.items_array = items.map((name, i) => ({
    name,
    qty: qtys[i] || "1"
  }));

  // 渲染模板
  const templateFile = config.template || "default_template.hbs";
  const templatePath = path.join(__dirname, "../emailTemplates", templateFile);

  let emailText = "";
  let emailHtml = "";

  if (fs.existsSync(templatePath)) {
    const source = fs.readFileSync(templatePath, "utf-8");
    const template = handlebars.compile(source);
    emailText = template(mapped);
    emailHtml = emailText.replace(/\n/g, "<br>");
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

// fallback 模板（英文格式）
function fallbackTemplate(d) {
  const lines = (d.items_array || []).map(i =>
    `${i.name.padEnd(18)} x${i.qty}`
  ).join("\n");

  return `
🗒 Call Summary: ${d.call_summary || ""}

*** ${d.store_name || "New Order"} ***
Order Type: ${d.order_type || "N/A"}
Customer Name: ${d.first_name || "N/A"}
Phone Number: ${d.phone || "N/A"}
Address: ${d.delivery_address || "N/A"}
-----------------------------
Item              Quantity
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
