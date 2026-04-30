import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { inventory, pricing, plants as plantsApi, production, landscaping, deliveries } from '../api/client';

export async function generateWholesalePdf() {
  const [invRes, priceRes, plantRes, prodRes, inGroundRes, delivRes] = await Promise.all([
    inventory.list({ limit: 9999 }),
    pricing.list({ limit: 9999 }),
    plantsApi.list({ limit: 9999 }),
    production.list({ status: 'active' }),
    landscaping.listProjects({ type: 'in_ground' }),
    deliveries.list(),
  ]);

  const inventoryItems    = invRes.data?.inventory ?? [];
  const pricingItems      = priceRes.data?.pricing ?? [];
  const allPlants         = plantRes.data?.plants ?? [];
  const activeBatches     = prodRes.data?.production ?? [];
  const inGroundProjects  = inGroundRes.data?.projects ?? [];
  const deliveryWindows   = Array.isArray(delivRes.data) ? delivRes.data : [];

  const invByVariant   = Object.fromEntries(inventoryItems.map(i => [i.variant_id, i]));
  const priceByVariant = Object.fromEntries(pricingItems.map(p => [p.variant_id, p]));

  // Plants with active production batches
  // variant-specific: batch has a target size set
  const inProductionVariantIds = new Set(activeBatches.filter(b => b.variant_id).map(b => b.variant_id));
  // plant-level only (no target size): tracked separately so we emit a single "Size TBD" row
  const inProductionPlantNoVariant = new Map(); // plant_id → batch (first/most relevant)
  for (const b of activeBatches) {
    if (!b.variant_id && !inProductionPlantNoVariant.has(b.plant_id)) {
      inProductionPlantNoVariant.set(b.plant_id, b);
    }
  }
  // Plant IDs that ARE covered by a variant-specific batch (don't need a TBD row)
  const inProductionVariantPlantIds = new Set(
    activeBatches.filter(b => b.variant_id).map(b => b.plant_id)
  );

  // Variants planted in nursery in-ground beds (status != 'removed')
  const inGroundVariantIds = new Set();
  for (const project of inGroundProjects) {
    for (const p of project.plants ?? []) {
      if (p.status !== 'removed' && p.variant_id) inGroundVariantIds.add(p.variant_id);
    }
  }

  // Variants with a pending delivery window → earliest expected date
  const pendingStatuses = new Set(['planned', 'ordered', 'in_transit']);
  const deliveryDateByVariant = {};
  for (const win of deliveryWindows) {
    if (!pendingStatuses.has(win.status)) continue;
    for (const item of win.items ?? []) {
      const vid = item.variant_id;
      if (!vid) continue;
      if (!deliveryDateByVariant[vid] || win.expected_date < deliveryDateByVariant[vid]) {
        deliveryDateByVariant[vid] = win.expected_date;
      }
    }
  }

  const rows = [];
  for (const plant of allPlants) {
    if (!plant.variants?.length) continue;
    for (const variant of plant.variants) {
      const inv   = invByVariant[variant.id];
      const price = priceByVariant[variant.id];

      const onHand    = Number(inv?.quantity_on_hand  || 0);
      const reserved  = Number(inv?.quantity_reserved || 0);
      const incoming  = Number(inv?.quantity_incoming || 0);
      const available = onHand - reserved;
      const label     = inv?.availability_label?.trim() || '';

      const isInStock      = available > 0;
      const isIncoming     = incoming > 0;
      const isUnavailable  = /unavailable/i.test(label);
      const hasLabel       = !!label && !isUnavailable;
      const hasAvailDate   = !!inv?.availability_date;
      const hasDelivery    = !!deliveryDateByVariant[variant.id];
      const isInGround     = inGroundVariantIds.has(variant.id);
      const isInProduction = inProductionVariantIds.has(variant.id); // variant-specific only

      if (isUnavailable) continue;
      if (!isInStock && !isIncoming && !hasLabel && !hasAvailDate && !hasDelivery && !isInGround && !isInProduction) continue;

      let status;
      if (isInStock)          status = `In Stock (${available})`;
      else if (hasLabel)       status = label;
      else if (isIncoming)     status = `Incoming (${incoming})`;
      else if (hasAvailDate) {
        const d = new Date(inv.availability_date);
        status = `Avail. ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
      }
      else if (hasDelivery) {
        const d = new Date(deliveryDateByVariant[variant.id] + 'T00:00:00');
        status = `Delivery ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
      }
      else if (isInProduction) status = 'In Production';
      else if (isInGround)     status = 'In Ground';
      else                     status = '—';

      const wholesale = price?.wholesale_price ? `$${Number(price.wholesale_price).toFixed(2)}` : '—';
      const retail    = price?.retail_price    ? `$${Number(price.retail_price).toFixed(2)}`    : '—';

      rows.push([
        plant.scientific_name ?? '—',
        plant.common_name     ?? '—',
        variant.container_size ?? '—',
        wholesale,
        retail,
        status,
      ]);
    }
  }

  // Add one "Size TBD" row for each plant that has a non-variant-specific production batch
  // but isn't already represented by a variant-specific batch
  for (const plant of allPlants) {
    if (!inProductionPlantNoVariant.has(plant.id)) continue;
    if (inProductionVariantPlantIds.has(plant.id)) continue; // already has variant rows
    rows.push([
      plant.scientific_name ?? '—',
      plant.common_name     ?? '—',
      'Size TBD',
      '—',
      '—',
      'In Production',
    ]);
  }

  rows.sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const headerHeight = 96;

  const drawPageHeader = () => {
    const pageW = doc.internal.pageSize.getWidth();
    const rightX = pageW - 40;

    // Left: company name, list title, date
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text('Bloomsday Natives', 40, 38);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Wholesale Price List', 40, 54);

    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated ${today}`, 40, 67);
    doc.setTextColor(0);

    // Right: pricing tiers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(34, 70, 45);
    doc.text('RETAIL WHOLESALE 50%: $700 MINIMUM', rightX, 30, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text('Species Min: 2 3/8" x49  |  2 7/8" x36  |  4" x18-25  |  1 gal x6  |  2 gal+ x3', rightX, 41, { align: 'right' });
    doc.text('(4" qty may vary based on existing nursery flats)', rightX, 51, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(34, 70, 45);
    doc.text('BULK / CONTRACTORS 20% OFF: $350 MINIMUM', rightX, 63, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text('RETAIL: No species minimum  |  $50 order minimum (free at Plural Collective)', rightX, 74, { align: 'right' });

    doc.setTextColor(0);
  };

  autoTable(doc, {
    startY: headerHeight,
    head: [['Scientific Name', 'Common Name', 'Size', 'Wholesale', 'Retail', 'Availability']],
    body: rows,
    headStyles: {
      fillColor: [34, 70, 45],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    columnStyles: {
      0: { cellWidth: 150, fontStyle: 'italic' },
      1: { cellWidth: 140 },
      2: { cellWidth: 70 },
      3: { cellWidth: 70, halign: 'right' },
      4: { cellWidth: 70, halign: 'right' },
      5: { cellWidth: 110 },
    },
    margin: { left: 40, right: 40, top: headerHeight },
    willDrawPage: () => drawPageHeader(),
  });

  doc.save(`bloomsday-wholesale-${new Date().toISOString().slice(0, 10)}.pdf`);
}
