const { Op } = require('sequelize');
const { Inventory, InventoryLog, InventoryLocationSplit, PlantVariant, Plant, User, sequelize } = require('../models');

const VALID_STATUSES = ['retail_ready', 'just_potted', 'available_soon', 'on_hold', 'damaged'];

// Push an inventory level to Shopify if the variant is linked and credentials are set.
// Fires-and-forgets — never throws so it can't break local operations.
async function pushToShopify(variant, newQty) {
  try {
    const locationId = process.env.SHOPIFY_LOCATION_ID;
    if (!variant?.shopify_inventory_item_id || !locationId) return;
    await shopifyService.syncInventoryToShopify(
      variant.shopify_inventory_item_id,
      locationId,
      newQty
    );
  } catch (err) {
    console.warn(`[shopify-sync] failed for variant ${variant?.id}: ${err.message}`);
  }
}
const shopifyService = require('../services/shopifyService');

async function list(req, res) {
  const { low_stock, page = 1, limit = 100, location } = req.query;

  const inventoryWhere = {};
  if (low_stock === 'true') {
    inventoryWhere[Op.and] = [
      sequelize.where(
        sequelize.col('quantity_on_hand'),
        Op.lte,
        sequelize.col('reorder_threshold')
      ),
    ];
  }

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  // When filtering by location, join against location_splits
  const splitInclude = location
    ? {
        model: InventoryLocationSplit,
        as: 'location_splits',
        where: { location: { [Op.iLike]: location } },
        required: true,
      }
    : {
        model: InventoryLocationSplit,
        as: 'location_splits',
        attributes: ['id', 'location', 'quantity'],
      };

  const { count, rows } = await Inventory.findAndCountAll({
    where: inventoryWhere,
    include: [
      {
        model: PlantVariant,
        as: 'variant',
        where: { is_active: true },
        required: true,
        include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] }],
      },
      splitInclude,
    ],
    order: [['quantity_on_hand', 'ASC']],
    limit: parseInt(limit, 10),
    offset,
    distinct: true,
  });

  res.json({ total: count, page: parseInt(page, 10), inventory: rows });
}

async function adjust(req, res) {
  const { variant_id, quantity_change, change_type = 'adjustment', notes, location, inventory_status } = req.body;

  const inv = await Inventory.findOne({ where: { variant_id } });
  if (!inv) return res.status(404).json({ error: 'Inventory record not found' });

  const before = inv.quantity_on_hand;
  const after = before + parseInt(quantity_change, 10);
  if (after < 0) return res.status(400).json({ error: 'Cannot reduce below zero' });

  const status = VALID_STATUSES.includes(inventory_status) ? inventory_status : inv.inventory_status;
  const invUpdate = { quantity_on_hand: after };
  if (VALID_STATUSES.includes(inventory_status)) invUpdate.inventory_status = inventory_status;
  await inv.update(invUpdate);

  await InventoryLog.create({
    variant_id,
    user_id: req.user?.id || null,
    change_type,
    quantity_before: before,
    quantity_change: parseInt(quantity_change, 10),
    quantity_after: after,
    notes,
    location: location || null,
    inventory_status: status,
  });

  // Push available qty to Shopify (available = on_hand - reserved)
  const variant = await PlantVariant.findByPk(variant_id);
  const reserved = inv.quantity_reserved ?? 0;
  pushToShopify(variant, Math.max(0, after - reserved));

  // Upsert location split when a location is specified
  if (location) {
    const [split] = await InventoryLocationSplit.findOrCreate({
      where: { inventory_id: inv.id, location },
      defaults: { quantity: 0 },
    });
    const newSplitQty = Math.max(0, split.quantity + parseInt(quantity_change, 10));
    await split.update({ quantity: newSplitQty });
  }

  res.json({ inventory: inv, quantity_before: before, quantity_after: after });
}

async function syncToShopify(req, res) {
  const { variant_id } = req.params;
  const inv = await Inventory.findOne({
    where: { variant_id },
    include: [{ model: PlantVariant, as: 'variant' }],
  });
  if (!inv) return res.status(404).json({ error: 'Not found' });

  if (!inv.variant.shopify_variant_id) {
    return res.status(400).json({ error: 'No Shopify variant ID linked' });
  }

  res.json({ message: 'Shopify sync initiated', available: inv.quantity_on_hand - inv.quantity_reserved });
}

// Patch an inventory record (availability label, location, reorder threshold, etc.)
async function update(req, res) {
  const inv = await Inventory.findByPk(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  const allowed = ['availability_label', 'availability_date', 'reorder_threshold', 'location', 'notes', 'quantity_incoming', 'inventory_status'];
  const data = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  await inv.update(data);
  res.json({ inventory: inv });
}

// Directly set location splits for an inventory record (for distributing existing stock).
// Does NOT change quantity_on_hand — purely records where things are stored.
async function setLocationSplits(req, res) {
  const inv = await Inventory.findByPk(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });

  const splits = req.body;
  if (!Array.isArray(splits)) return res.status(400).json({ error: 'Expected an array of { location, quantity }' });

  // Validate
  for (const s of splits) {
    if (!s.location?.trim()) return res.status(400).json({ error: 'Each split must have a location' });
    if (isNaN(s.quantity) || parseInt(s.quantity, 10) < 0) return res.status(400).json({ error: 'Each split must have a non-negative quantity' });
  }

  // Replace all splits for this inventory record
  await InventoryLocationSplit.destroy({ where: { inventory_id: inv.id } });
  const created = await InventoryLocationSplit.bulkCreate(
    splits.filter(s => parseInt(s.quantity, 10) > 0).map(s => ({
      inventory_id: inv.id,
      location: s.location.trim(),
      quantity: parseInt(s.quantity, 10),
    }))
  );

  res.json({ location_splits: created });
}

// Bulk count: accepts [{ sku, quantity }] and sets inventory to absolute counts
async function bulkCount(req, res) {
  const { Op } = require('sequelize');
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Expected a non-empty array of { sku, quantity }' });
  }

  const results = [];
  for (const entry of rows) {
    const { sku, quantity, location, inventory_status } = entry;
    const status = VALID_STATUSES.includes(inventory_status) ? inventory_status : 'retail_ready';
    if (!sku || quantity == null || isNaN(quantity) || parseInt(quantity, 10) < 0) {
      results.push({ sku, error: 'Invalid SKU or quantity' });
      continue;
    }
    const newQty = parseInt(quantity, 10);

    const variant = await PlantVariant.findOne({ where: { sku } });
    if (!variant) {
      results.push({ sku, error: 'SKU not found' });
      continue;
    }

    const [inv] = await Inventory.findOrCreate({
      where: { variant_id: variant.id },
      defaults: { variant_id: variant.id, quantity_on_hand: 0 },
    });

    const before = inv.quantity_on_hand;
    const change = newQty - before;
    const invUpdate = { quantity_on_hand: newQty, inventory_status: status };
    if (location) invUpdate.location = location;
    await inv.update(invUpdate);

    await InventoryLog.create({
      variant_id: variant.id,
      user_id: req.user?.id || null,
      change_type: 'count',
      quantity_before: before,
      quantity_change: change,
      quantity_after: newQty,
      location: location || null,
      inventory_status: status,
      notes: location ? `Bulk count entry — ${location}` : 'Bulk count entry',
    });

    // Upsert location split so the item doesn't appear in "without location"
    if (location) {
      const [split, created] = await InventoryLocationSplit.findOrCreate({
        where: { inventory_id: inv.id, location },
        defaults: { quantity: newQty },
      });
      if (!created) await split.update({ quantity: newQty });
    }

    // Push to Shopify
    const reserved = inv.quantity_reserved ?? 0;
    pushToShopify(variant, Math.max(0, newQty - reserved));

    results.push({ sku, before, after: newQty, change, ok: true });
  }

  res.json({ results });
}

// GET /api/inventory/barcode-sheet?location=X
// Returns all active variants present at a given location (or all locations if omitted),
// with full plant data and barcode — no quantity data included.
async function barcodeSheet(req, res) {
  const { location } = req.query;

  // Build the inventory WHERE clause:
  // a variant is "at" a location if Inventory.location matches OR a location split exists there.
  const inventoryWhere = {};
  const locationSplitWhere = {};

  if (location) {
    inventoryWhere[Op.or] = [
      { location: { [Op.iLike]: location } },
      // handled by the required location_splits include below
    ];
    locationSplitWhere.location = { [Op.iLike]: location };
  }

  // Fetch all inventory rows, filtering by location via OR (main location OR split location)
  let rows;
  if (location) {
    // Use two queries and union to handle both Inventory.location and location splits
    const byMainLocation = await Inventory.findAll({
      where: { location: { [Op.iLike]: location } },
      include: [
        {
          model: PlantVariant,
          as: 'variant',
          where: { is_active: true },
          required: true,
          include: [{
            model: Plant,
            as: 'plant',
            where: { is_active: true },
            required: true,
            attributes: ['id', 'common_name', 'scientific_name', 'plant_type',
                         'sun_requirements', 'water_requirements', 'native_region'],
          }],
        },
        { model: InventoryLocationSplit, as: 'location_splits' },
      ],
    });

    const bySplit = await Inventory.findAll({
      include: [
        {
          model: PlantVariant,
          as: 'variant',
          where: { is_active: true },
          required: true,
          include: [{
            model: Plant,
            as: 'plant',
            where: { is_active: true },
            required: true,
            attributes: ['id', 'common_name', 'scientific_name', 'plant_type',
                         'sun_requirements', 'water_requirements', 'native_region'],
          }],
        },
        {
          model: InventoryLocationSplit,
          as: 'location_splits',
          where: { location: { [Op.iLike]: location } },
          required: true,
        },
      ],
    });

    // Deduplicate by inventory id
    const seen = new Set();
    rows = [];
    for (const r of [...byMainLocation, ...bySplit]) {
      if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
    }
  } else {
    rows = await Inventory.findAll({
      include: [
        {
          model: PlantVariant,
          as: 'variant',
          where: { is_active: true },
          required: true,
          include: [{
            model: Plant,
            as: 'plant',
            where: { is_active: true },
            required: true,
            attributes: ['id', 'common_name', 'scientific_name', 'plant_type',
                         'sun_requirements', 'water_requirements', 'native_region'],
          }],
        },
        { model: InventoryLocationSplit, as: 'location_splits' },
      ],
    });
  }

  // Strip quantities — only return identification data
  const items = rows.map(inv => ({
    inventory_id: inv.id,
    location:     inv.location,
    variant: {
      id:             inv.variant.id,
      sku:            inv.variant.sku,
      barcode:        inv.variant.barcode,
      container_size: inv.variant.container_size,
    },
    plant: inv.variant.plant,
    location_splits: inv.location_splits.map(s => s.location),
  }));

  // Sort by scientific name then container size
  items.sort((a, b) => {
    const name = (a.plant.scientific_name || a.plant.common_name)
      .localeCompare(b.plant.scientific_name || b.plant.common_name);
    if (name !== 0) return name;
    return (a.variant.container_size || '').localeCompare(b.variant.container_size || '');
  });

  res.json({ location: location || null, count: items.length, items });
}

// GET /api/inventory/count-report?from=&to=&status=&location=&user_id=
async function countReport(req, res) {
  const { from, to, status, location, user_id } = req.query;

  const where = { change_type: 'count' };

  if (from || to) {
    where.created_at = {};
    if (from) where.created_at[Op.gte] = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = end;
    }
  }
  if (status && VALID_STATUSES.includes(status)) where.inventory_status = status;
  if (location) where.location = { [Op.iLike]: location };
  if (user_id) where.user_id = user_id;

  const logs = await InventoryLog.findAll({
    where,
    include: [
      {
        model: PlantVariant,
        as: 'variant',
        include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] }],
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email'],
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
    limit: 2000,
  });

  res.json({ count: logs.length, entries: logs });
}

// GET /api/inventory/count-report/users — users who have submitted at least one count entry
async function countReportUsers(req, res) {
  const logs = await InventoryLog.findAll({
    where: { change_type: 'count', user_id: { [Op.ne]: null } },
    attributes: ['user_id'],
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    group: ['user_id', 'user.id', 'user.name', 'user.email'],
  });
  const users = logs
    .filter(l => l.user)
    .map(l => ({ id: l.user.id, name: l.user.name, email: l.user.email }));
  res.json({ users });
}

// POST /inventory/transfer — move qty from one location split to another without changing total on-hand
async function transfer(req, res) {
  const { from_location, to_location, items } = req.body;
  if (!from_location?.trim()) return res.status(400).json({ error: 'from_location is required' });
  if (!to_location?.trim())   return res.status(400).json({ error: 'to_location is required' });
  if (from_location.trim().toLowerCase() === to_location.trim().toLowerCase()) {
    return res.status(400).json({ error: 'From and to locations must be different' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const results = [];
  await sequelize.transaction(async (t) => {
    for (const item of items) {
      const { variant_id, quantity } = item;
      const qty = parseInt(quantity, 10);
      if (!variant_id || isNaN(qty) || qty <= 0) {
        results.push({ variant_id, error: 'Invalid quantity' }); continue;
      }

      const inv = await Inventory.findOne({
        where: { variant_id },
        include: [{ model: InventoryLocationSplit, as: 'location_splits' }],
        transaction: t,
      });
      if (!inv) { results.push({ variant_id, error: 'Inventory record not found' }); continue; }

      const fromSplit = inv.location_splits.find(
        s => s.location.toLowerCase() === from_location.trim().toLowerCase()
      );
      const available = fromSplit?.quantity ?? 0;
      if (available < qty) {
        results.push({ variant_id, error: `Only ${available} available at ${from_location}` }); continue;
      }

      // Decrement / remove source split
      if (available === qty) {
        await fromSplit.destroy({ transaction: t });
      } else {
        await fromSplit.update({ quantity: available - qty }, { transaction: t });
      }

      // Upsert destination split
      const [toSplit] = await InventoryLocationSplit.findOrCreate({
        where: { inventory_id: inv.id, location: to_location.trim() },
        defaults: { quantity: 0 },
        transaction: t,
      });
      await toSplit.update({ quantity: toSplit.quantity + qty }, { transaction: t });

      // Audit log — qty_change is 0 because total on-hand doesn't change
      await InventoryLog.create({
        variant_id,
        user_id: req.user?.id || null,
        change_type: 'location_transfer',
        quantity_before: inv.quantity_on_hand,
        quantity_change: 0,
        quantity_after:  inv.quantity_on_hand,
        location: to_location.trim(),
        notes: `Transferred ${qty} from "${from_location.trim()}" to "${to_location.trim()}"`,
      }, { transaction: t });

      results.push({ variant_id, transferred: qty, ok: true });
    }
  });

  const failed = results.filter(r => r.error);
  res.status(failed.length > 0 && failed.length === items.length ? 400 : 200)
     .json({ results });
}

// GET /inventory/without-location — items with qty > 0 but no location split assigned
async function withoutLocation(req, res) {
  const rows = await Inventory.findAll({
    where: { quantity_on_hand: { [Op.gt]: 0 } },
    include: [
      {
        model: PlantVariant,
        as: 'variant',
        where: { is_active: true },
        required: true,
        include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] }],
      },
      { model: InventoryLocationSplit, as: 'location_splits', required: false },
    ],
    order: [[{ model: PlantVariant, as: 'variant' }, { model: Plant, as: 'plant' }, 'common_name', 'ASC']],
  });

  const unlocated = rows.filter(r => !r.location_splits || r.location_splits.length === 0);
  res.json({ count: unlocated.length, inventory: unlocated });
}

module.exports = { list, adjust, update, syncToShopify, bulkCount, setLocationSplits, barcodeSheet, countReport, countReportUsers, transfer, withoutLocation };
