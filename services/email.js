const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

// 对齐 helper：<pad str 30>
handlebars.registerHelper("pad", function (str, len) {
  str = str || "";
  return str.padEnd(len, " ");
});

// 拼接 helper：{{concat a b}} => ab
handlebars.registerHelper("concat", function (...args) {
  args.pop();
  return args.join("");
});

async function sendOrderEmail({ config, rawData, from_number }) {
  /* ─────────── 1. 邮件账号 ─────────── */
  const user = config.email_from.user;
  const pass = process.env[config.email_from.pass_env];

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });

  /* ─────────── 2. 字段映射 ─────────── */
  const mapped = {};
  const map = config.field_mapping || {};
  for (const [key, field] of Object.entries(map)) {
    mapped[key] = rawData[field] || "";
  }

  /* 额外字段 */
  mapped.store_name    = config.store_name || "";
  mapped.call_summary  = rawData.detailed_call_summary || "";
  mapped.from_number   = from_number;
  mapped.item_options  = rawData.item_options || "";
  mapped.item_options_price = rawData.item_options_price || "";

  /* ─────────── 3. 构建 items_array ─────────── */
  const rawItems = (mapped.items || "").trim();

  const items  = rawItems.split(",").map(s => s.trim()).filter(Boolean);
  const qtys   = (mapped.quantities   || "").split(",").map(s => s.trim());
  const prices = (rawData.item_prices || "").split(",").map(s => s.trim());
  const extras = (mapped.item_options || "").split(";").map(s => s.trim());
  const extrasPrices = (mapped.item_options_price || "").split(";").map(s => s.trim());

  mapped.items_array = items.map((name, i) => {
    return {
      name,
      qty: qtys[i] || "1",
      price: prices[i] || "",
      extras: extras[i] || "",
      extras_price: extrasPrices[i] || ""
    };
  });

  /* ─────────── 4. 渲染模板 ─────────── */
  const templateFile = config.template || "default_template.hbs";
  const templatePath = path.join(__dirname, "../emailTemplates", templateFile);

  let emailText = "";
  let emailHtml = "";

  if (fs.existsSync(templatePath)) {
    const source   = fs.readFileSync(templatePath, "utf-8");
    const template = handlebars.compile(source);
    emailText      = template(mapped);
    emailHtml      = `<div style="font-family:monospace; font-size:16px; white-space:pre;">${emailText}</div>`;
  } else {
    emailText = fallbackTemplate(mapped);
    emailHtml = emailText.replace(/\n/g, "<br>");
  }

  /* ─────────── 5. 发送邮件 ─────────── */
  const mailOptions = {
    from:    `"AI Order Bot" <${user}>`,
    to:      config.email_to,
    subject: `📦 New Order from ${config.store_name}`,
    text:    emailText,
    html:    emailHtml
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

/* ─────────── 备用纯文本模板 ─────────── */
function fallbackTemplate(d) {
  const lines = (d.items_array || []).map(i => {
    const line1 = `${i.name.padEnd(30)} x${i.qty}  $${i.price}`;
    const line2 = i.extras ? `(${i.extras})`.padEnd(30) + ` $${i.extras_price}` : "";
    return line1 + (line2 ? `\n${line2}` : "");
  }).join("\n");

  return `
🗒 Call Summary: ${d.call_summary || ""}

*** ${d.store_name || "New Order"} ***
Order Type: ${d.order_type || "N/A"}
Customer Name: ${d.first_name || "N/A"}
Phone Number: ${d.phone || "N/A"}
Address: ${d.delivery_address || "N/A"}
-----------------------------
Item                          Qty   Price
${lines || "No items"}
-----------------------------
Subtotal: $${d.subtotal || "0.00"}
Delivery Fee: $${d.delivery_fee || "0.00"}
Total: $${d.total || "0.00"}
-----------------------------
Thank you!
📞 Incoming Call: ${d.from_number || "N/A"}
`.trim();
}

module.exports = { sendOrderEmail };
