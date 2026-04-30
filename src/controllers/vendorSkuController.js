const { VendorSku, PlantVariant } = require('../models');

function buildSku(variantSku, vendorCode) {
  const code = (vendorCode || '').toUpperCase().replace(/\s+/g, '');
  if (!variantSku) return code || null;
  return `${variantSku}-${code}`;
}

async function list(req, res) {
  const rows = await VendorSku.findAll({
    where: { variant_id: req.params.variant_id },
    order: [['vendor_name', 'ASC']],
  });
  res.json(rows);
}

async function create(req, res) {
  const { variant_id } = req.params;
  const { vendor_name, vendor_code, cost, notes } = req.body;
  if (!vendor_name || !vendor_code) {
    return res.status(400).json({ error: 'vendor_name and vendor_code are required' });
  }

  const variant = await PlantVariant.findByPk(variant_id);
  if (!variant) return res.status(404).json({ error: 'Variant not found' });

  const sku = buildSku(variant.sku, vendor_code);
  const row = await VendorSku.create({ variant_id, vendor_name, vendor_code: vendor_code.toUpperCase(), sku, cost: cost || null, notes: notes || null });
  res.status(201).json(row);
}

async function update(req, res) {
  const row = await VendorSku.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { vendor_name, vendor_code, cost, notes } = req.body;
  const updates = {};
  if (vendor_name !== undefined) updates.vendor_name = vendor_name;
  if (vendor_code !== undefined) {
    updates.vendor_code = vendor_code.toUpperCase();
    const variant = await PlantVariant.findByPk(row.variant_id);
    updates.sku = buildSku(variant?.sku, vendor_code);
  }
  if (cost !== undefined) updates.cost = cost;
  if (notes !== undefined) updates.notes = notes;

  await row.update(updates);
  res.json(row);
}

async function remove(req, res) {
  const row = await VendorSku.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  await row.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
