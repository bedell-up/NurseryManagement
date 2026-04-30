import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Returns the quantity of an inventory item physically at a given location.
 * If the item has location splits, use the matching split quantity.
 * Otherwise, if the item's main location matches, return quantity_on_hand.
 */
function qtyAtLocation(item, locationName) {
  const loc = locationName.toLowerCase();
  const splits = item.location_splits ?? [];
  if (splits.length > 0) {
    const split = splits.find(s => (s.location || '').toLowerCase() === loc);
    return split?.quantity ?? 0;
  }
  if ((item.location || '').toLowerCase() === loc) {
    return item.quantity_on_hand ?? 0;
  }
  return 0;
}

export function generateLocationPdf(locationName, allItems, priceByVariant) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Filter to items that have quantity at this location
  const items = allItems
    .filter(item => qtyAtLocation(item, locationName) > 0)
    .sort((a, b) => {
      const plantA = a.variant?.plant?.scientific_name || a.variant?.plant?.common_name || '';
      const plantB = b.variant?.plant?.scientific_name || b.variant?.plant?.common_name || '';
      const cmp = plantA.localeCompare(plantB);
      if (cmp !== 0) return cmp;
      return (a.variant?.container_size || '').localeCompare(b.variant?.container_size || '');
    });

  if (items.length === 0) {
    alert(`No inventory found at location "${locationName}".`);
    return;
  }

  const rows = items.map(item => {
    const plant   = item.variant?.plant;
    const price   = priceByVariant[item.variant_id];
    const qtyHere = qtyAtLocation(item, locationName);
    const qtyTotal = item.quantity_on_hand ?? 0;
    const retail    = price?.retail_price    ? `$${Number(price.retail_price).toFixed(2)}`    : '—';
    const wholesale = price?.wholesale_price ? `$${Number(price.wholesale_price).toFixed(2)}` : '—';

    return [
      plant?.scientific_name ?? '—',
      plant?.common_name     ?? '—',
      item.variant?.container_size ?? '—',
      item.variant?.sku ?? '—',
      String(qtyHere),
      String(qtyTotal),
      wholesale,
      retail,
    ];
  });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const headerHeight = 72;

  const drawPageHeader = () => {
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Bloomsday Natives', 40, 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Location Inventory: ${locationName}`, 40, 50);

    doc.setFontSize(8.5);
    doc.setTextColor(120);
    doc.text(`Generated ${today}  ·  ${items.length} variant${items.length !== 1 ? 's' : ''}`, 40, 63);
    doc.setTextColor(0);

    doc.setFontSize(8.5);
    doc.setTextColor(80);
    doc.text(`${locationName}`, pageW - 40, 34, { align: 'right' });
    doc.setTextColor(0);
  };

  autoTable(doc, {
    startY: headerHeight,
    head: [['Scientific Name', 'Common Name', 'Size', 'SKU', `Qty @ ${locationName}`, 'Total On Hand', 'Wholesale', 'Retail']],
    body: rows,
    headStyles: {
      fillColor: [34, 70, 45],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    columnStyles: {
      0: { cellWidth: 130, fontStyle: 'italic' },
      1: { cellWidth: 130 },
      2: { cellWidth: 70 },
      3: { cellWidth: 80, font: 'courier' },
      4: { cellWidth: 65, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 65, halign: 'center' },
      6: { cellWidth: 60, halign: 'right' },
      7: { cellWidth: 60, halign: 'right' },
    },
    margin: { left: 40, right: 40, top: headerHeight },
    willDrawPage: () => drawPageHeader(),
  });

  const safeLocation = locationName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  doc.save(`inventory-${safeLocation}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
