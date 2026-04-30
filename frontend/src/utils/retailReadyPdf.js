import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateRetailReadyPdf(allItems, priceByVariant) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Retail ready = status is retail_ready AND available quantity > 0
  const items = allItems
    .filter(item => {
      const available = (item.quantity_on_hand || 0) - (item.quantity_reserved || 0);
      return item.inventory_status === 'retail_ready' && available > 0;
    })
    .sort((a, b) => {
      const sciA = a.variant?.plant?.scientific_name || a.variant?.plant?.common_name || '';
      const sciB = b.variant?.plant?.scientific_name || b.variant?.plant?.common_name || '';
      const cmp = sciA.localeCompare(sciB);
      if (cmp !== 0) return cmp;
      return (a.variant?.container_size || '').localeCompare(b.variant?.container_size || '');
    });

  if (items.length === 0) {
    alert('No retail-ready inventory found.');
    return;
  }

  const rows = items.map(item => {
    const plant     = item.variant?.plant;
    const price     = priceByVariant[item.variant_id];
    const available = (item.quantity_on_hand || 0) - (item.quantity_reserved || 0);
    const retail    = price?.retail_price    ? `$${Number(price.retail_price).toFixed(2)}`    : '—';
    const wholesale = price?.wholesale_price ? `$${Number(price.wholesale_price).toFixed(2)}` : '—';

    return [
      plant?.scientific_name ?? '—',
      plant?.common_name     ?? '—',
      item.variant?.container_size ?? '—',
      item.variant?.sku     ?? '—',
      String(available),
      wholesale,
      retail,
    ];
  });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const headerHeight = 80;

  const drawPageHeader = () => {
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Bloomsday Natives', 40, 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Retail Ready Inventory', 40, 50);

    doc.setFontSize(8.5);
    doc.setTextColor(120);
    doc.text(
      `Generated ${today}  ·  ${items.length} variant${items.length !== 1 ? 's' : ''} in stock`,
      40, 64,
    );
    doc.setTextColor(0);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(80);
    doc.text('Available for retail sale', pageW - 40, 34, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
  };

  autoTable(doc, {
    startY: headerHeight,
    head: [['Scientific Name', 'Common Name', 'Size', 'SKU', 'Available', 'Wholesale', 'Retail']],
    body: rows,
    headStyles: {
      fillColor: [26, 26, 26],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 150, fontStyle: 'italic' },
      1: { cellWidth: 130 },
      2: { cellWidth: 70 },
      3: { cellWidth: 90, font: 'courier', fontSize: 7.5 },
      4: { cellWidth: 55, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 65, halign: 'right' },
      6: { cellWidth: 65, halign: 'right' },
    },
    margin: { left: 40, right: 40, top: headerHeight },
    willDrawPage: () => drawPageHeader(),
  });

  doc.save(`retail-ready-${new Date().toISOString().slice(0, 10)}.pdf`);
}
