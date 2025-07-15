const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

// 对齐 helper：<pad str 30>
handlebars.registerHelper("pad", function (str, len) {
  str = str || "";
  return str.padEnd(len, " ");
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
  mapped.store_name   = config.store_name || "";
  mapped.call_summary = rawData.detailed_call_summary || "";
  mapped.from_number  = from_number;

  /* ─────────── 3. 构建 items_array ─────────── */
  const rawItems = (mapped.items_with_notes || mapped.items || "").trim();

  // 分割：换行 / 分号 / “括号外”的逗号
  const items = rawItems
    .split(/\n|;(?![^()]*\))|,(?![^()]*\))/)  // 逗号在括号内不会被切
    .map(i => i.trim())
    .filter(Boolean);

  const qtys   = (mapped.quantities || "").split(",").map(q => q.trim());
  const prices = (rawData.item_prices   || "").split(",").map(p => p.trim());

  // 补齐长度，防止索引错位
  const maxLen = Math.max(items.length, qtys.length, prices.length);
  while (items.length   < maxLen) items.push(items[items.length-1]   || "");
  while (qtys.length    < maxLen) qtys.push(qtys[qtys.length-1]     || "1");
  while (prices.length  < maxLen) prices.push(prices[prices.length-1] || "");

  mapped.items_array = items.map((raw, i) => {
    // 拆：主菜名 + 备注
    const m    = raw.match(/\(([^)]+)\)$/);      // 捕获最后一对括号
    const name = m ? raw.replace(/\s*\([^)]+\)$/, "").trim() : raw;
    const note = m ? `(${m[1]})` : "";
    return {
      name,
      note,                    // 备注行（可能为空）
      qty:   qtys[i]   || "1",
      price: prices[i] || ""
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
    const line2 = i.note ? `\n${i.note}` : "";
    return line1 + line2;
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
${d.note ? "📝 Note: " + d.note : ""}
📞 Incoming Call: ${d.from_number || "N/A"}
`.trim();
}

module.exports = { sendOrderEmail };
