const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function fmtMoney(val) {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildOrderHtml(order) {
  const items = order.items ?? [];
  const orderTotal = items.reduce((s, i) => s + (parseFloat(i.unit_price) || 0) * (i.quantity || 0), 0);

  const itemRows = items.map(item => {
    const plant     = item.variant?.plant;
    const lineTotal = (parseFloat(item.unit_price) || 0) * (item.quantity || 0);
    const name      = plant?.scientific_name
      ? `<em>${plant.scientific_name}</em><br><span style="color:#6b7280;font-size:12px">${plant.common_name ?? ''}</span>`
      : (plant?.common_name ?? '—');
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5ede5">${name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5ede5;color:#374151">${item.variant?.container_size ?? '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5ede5;text-align:center;font-weight:600">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5ede5;color:#6b7280">${item.location || '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5ede5;text-align:right">${fmtMoney(item.unit_price)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5ede5;text-align:right;font-weight:600">${lineTotal > 0 ? fmtMoney(lineTotal) : '—'}</td>
      </tr>`;
  }).join('');

  const statusColors = {
    draft:     '#e0f0e0;color:#166534',
    confirmed: '#fef3c7;color:#92400e',
    fulfilled: '#d1fae5;color:#065f46',
    cancelled: '#fee2e2;color:#991b1b',
  };
  const statusStyle = statusColors[order.status] ?? '#f3f4f6;color:#374151';
  const [bg, fg] = statusStyle.split(';');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:#22462d;padding:24px 32px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="color:#fff;font-size:20px;font-weight:700">Bloomsday Natives</div>
            <div style="color:#a7c4a7;font-size:13px;margin-top:2px">Order Confirmation</div>
          </td>
          <td style="text-align:right">
            <div style="color:#fff;font-size:22px;font-weight:700">#${order.order_number}</div>
            <div style="display:inline-block;margin-top:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${bg};${fg}">${(order.status ?? '').charAt(0).toUpperCase() + (order.status ?? '').slice(1)}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Customer info -->
    <div style="padding:24px 32px;border-bottom:1px solid #e5ede5">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50%;vertical-align:top">
            <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Customer</div>
            ${order.customer_name ? `<div style="font-size:14px;font-weight:600;color:#111">${order.customer_name}</div>` : ''}
            ${order.customer_email ? `<div style="font-size:13px;color:#374151;margin-top:2px">${order.customer_email}</div>` : ''}
            ${order.customer_phone ? `<div style="font-size:13px;color:#374151;margin-top:2px">${order.customer_phone}</div>` : ''}
          </td>
          <td style="width:50%;vertical-align:top;text-align:right">
            <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Details</div>
            <div style="font-size:13px;color:#374151">Order Date: ${fmtDate(order.createdAt)}</div>
            ${order.fulfilled_at ? `<div style="font-size:13px;color:#374151;margin-top:2px">Fulfilled: ${fmtDate(order.fulfilled_at)}</div>` : ''}
          </td>
        </tr>
      </table>
    </div>

    ${order.notes ? `
    <!-- Notes -->
    <div style="padding:12px 32px;background:#f0f7f0;border-bottom:1px solid #e5ede5">
      <span style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Notes: </span>
      <span style="font-size:13px;color:#374151">${order.notes}</span>
    </div>` : ''}

    <!-- Items table -->
    <div style="padding:24px 32px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <thead>
          <tr style="background:#22462d">
            <th style="padding:10px 12px;text-align:left;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;border-radius:4px 0 0 0">Plant</th>
            <th style="padding:10px 12px;text-align:left;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Size</th>
            <th style="padding:10px 12px;text-align:center;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Qty</th>
            <th style="padding:10px 12px;text-align:left;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Location</th>
            <th style="padding:10px 12px;text-align:right;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;border-radius:0 4px 0 0">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
        ${orderTotal > 0 ? `
        <tfoot>
          <tr style="background:#f0f7f0">
            <td colspan="5" style="padding:12px;text-align:right;font-size:13px;font-weight:600;color:#374151">Order Total</td>
            <td style="padding:12px;text-align:right;font-size:15px;font-weight:700;color:#22462d">${fmtMoney(orderTotal)}</td>
          </tr>
        </tfoot>` : ''}
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5ede5;text-align:center">
      <div style="font-size:11px;color:#9ca3af">Bloomsday Natives &nbsp;·&nbsp; bloomsday-natives.myshopify.com</div>
    </div>

  </div>
</body>
</html>`;
}

async function sendOrderEmail(order, toEmail) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error('Email not configured — set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env');
  }

  const transport = createTransport();
  const from = process.env.SMTP_FROM || `Bloomsday Natives <${process.env.SMTP_USER}>`;

  await transport.sendMail({
    from,
    to: toEmail,
    subject: `Bloomsday Natives — Order #${order.order_number}`,
    html: buildOrderHtml(order),
  });
}

module.exports = { sendOrderEmail };
