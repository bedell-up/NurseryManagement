import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND_GREEN = [34, 70, 45];
const LIGHT_GREEN = [245, 250, 245];

const STATUS_LABELS = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtMoney(val) {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}

export function generateOrderPdf(order) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;

  const items = order.items ?? [];
  const orderTotal = items.reduce((s, i) => s + (parseFloat(i.unit_price) || 0) * (i.quantity || 0), 0);
  const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND_GREEN);
  doc.text('Bloomsday Natives', margin, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${generatedDate}`, margin, 66);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(`Order #${order.order_number}`, pageW - margin, 52, { align: 'right' });

  const statusLabel = STATUS_LABELS[order.status] ?? order.status;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(statusLabel, pageW - margin, 66, { align: 'right' });

  // Divider
  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(1.2);
  doc.line(margin, 76, pageW - margin, 76);

  // ── Order meta ──────────────────────────────────────────────────────────────
  let y = 96;
  const colRight = pageW / 2 + 20;

  const metaLeft = [
    ['Customer', order.customer_name || '—'],
    ['Email',    order.customer_email || '—'],
    ['Phone',    order.customer_phone || '—'],
  ];
  const metaRight = [
    ['Order Date', fmtDate(order.createdAt)],
    ['Status',     statusLabel],
    ...(order.fulfilled_at ? [['Fulfilled', fmtDate(order.fulfilled_at)]] : []),
  ];

  doc.setFontSize(9);
  metaLeft.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30);
    doc.text(value, margin + 70, y);
    y += 14;
  });

  y = 96;
  metaRight.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80);
    doc.text(label, colRight, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30);
    doc.text(value, colRight + 72, y);
    y += 14;
  });

  const metaBottom = Math.max(96 + metaLeft.length * 14, 96 + metaRight.length * 14) + 8;

  // ── Notes ───────────────────────────────────────────────────────────────────
  let tableStartY = metaBottom + 16;
  if (order.notes) {
    doc.setFillColor(245, 248, 245);
    const noteLines = doc.splitTextToSize(order.notes, pageW - margin * 2 - 16);
    const noteH = noteLines.length * 13 + 14;
    doc.roundedRect(margin, metaBottom, pageW - margin * 2, noteH, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(80);
    doc.text('Notes', margin + 8, metaBottom + 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.text(noteLines, margin + 8, metaBottom + 24);
    tableStartY = metaBottom + noteH + 12;
  }

  // ── Line items table ─────────────────────────────────────────────────────────
  const rows = items.map(item => {
    const plant = item.variant?.plant;
    const lineTotal = (parseFloat(item.unit_price) || 0) * (item.quantity || 0);
    return [
      plant?.scientific_name ?? '—',
      plant?.common_name ?? '—',
      item.variant?.container_size ?? '—',
      item.variant?.sku ?? '—',
      String(item.quantity),
      item.location || '—',
      fmtMoney(item.unit_price),
      lineTotal > 0 ? fmtMoney(lineTotal) : '—',
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [['Scientific Name', 'Common Name', 'Size', 'SKU', 'Qty', 'Location', 'Unit Price', 'Total']],
    body: rows,
    headStyles: {
      fillColor: BRAND_GREEN,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_GREEN },
    columnStyles: {
      0: { cellWidth: 110, fontStyle: 'italic' },
      1: { cellWidth: 100 },
      2: { cellWidth: 55 },
      3: { cellWidth: 60, font: 'courier', fontSize: 7.5 },
      4: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 65 },
      6: { cellWidth: 55, halign: 'right' },
      7: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Order #${order.order_number} (continued)`, margin, 30);
      }
    },
  });

  // ── Total row ────────────────────────────────────────────────────────────────
  const finalY = doc.lastAutoTable.finalY + 6;
  const totalBoxW = 160;
  doc.setFillColor(...BRAND_GREEN);
  doc.roundedRect(pageW - margin - totalBoxW, finalY, totalBoxW, 24, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255);
  doc.text('Order Total', pageW - margin - totalBoxW + 10, finalY + 15.5);
  doc.text(orderTotal > 0 ? fmtMoney(orderTotal) : '—', pageW - margin - 10, finalY + 15.5, { align: 'right' });

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(170);
  doc.text('Bloomsday Natives  ·  bloomsday-natives.myshopify.com', pageW / 2, pageH - 24, { align: 'center' });

  const fileName = `order-${order.order_number}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
