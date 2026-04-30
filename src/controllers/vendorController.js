const { Vendor } = require('../models');

async function list(req, res) {
  const rows = await Vendor.findAll({ order: [['name', 'ASC']] });
  res.json(rows);
}

async function create(req, res) {
  const { name, code, contact_person, phone, notes } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code are required' });
  const vendor = await Vendor.create({
    name,
    code: code.toUpperCase().replace(/\s+/g, ''),
    contact_person: contact_person || null,
    phone: phone || null,
    notes: notes || null,
  });
  res.status(201).json(vendor);
}

async function update(req, res) {
  const vendor = await Vendor.findByPk(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });
  const { name, code, contact_person, phone, notes } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (code !== undefined) data.code = code.toUpperCase().replace(/\s+/g, '');
  if (contact_person !== undefined) data.contact_person = contact_person || null;
  if (phone !== undefined) data.phone = phone || null;
  if (notes !== undefined) data.notes = notes || null;
  await vendor.update(data);
  res.json(vendor);
}

async function remove(req, res) {
  const vendor = await Vendor.findByPk(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });
  await vendor.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
