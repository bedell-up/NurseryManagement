const { LandscapingProject, LandscapingProjectPlant, PlantVariant, Plant, Inventory, InventoryLog, InventoryLocationSplit } = require('../models');
const { geocodeAddress } = require('../services/geocodingService');

// ---- Projects ----

async function listProjects(req, res) {
  const { type, status } = req.query;
  const where = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const projects = await LandscapingProject.findAll({
    where,
    include: [{
      model: LandscapingProjectPlant,
      as: 'plants',
      attributes: ['id', 'variant_id', 'quantity', 'status'],
    }],
    order: [['created_at', 'DESC']],
  });

  res.json({ projects });
}

async function getProject(req, res) {
  const project = await LandscapingProject.findByPk(req.params.id, {
    include: [{
      model: LandscapingProjectPlant,
      as: 'plants',
      include: [{
        model: PlantVariant,
        as: 'variant',
        include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] }],
      }],
    }],
  });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ project });
}

async function createProject(req, res) {
  const { name, type = 'landscaping_job', client_name, location, description, status, start_date, end_date, notes } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Project name is required' });

  const coords = location ? await geocodeAddress(location) : null;

  const project = await LandscapingProject.create({
    name: name.trim(),
    type,
    client_name: client_name?.trim() || null,
    location: location?.trim() || null,
    description: description?.trim() || null,
    status: status || 'active',
    start_date: start_date || null,
    end_date: end_date || null,
    notes: notes?.trim() || null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  });

  res.status(201).json({ project, geocoded: !!coords });
}

async function updateProject(req, res) {
  const project = await LandscapingProject.findByPk(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const allowed = ['name', 'type', 'client_name', 'location', 'description', 'status', 'start_date', 'end_date', 'notes'];
  const data = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });

  // Re-geocode if location changed
  if (req.body.location !== undefined && req.body.location !== project.location) {
    const coords = req.body.location ? await geocodeAddress(req.body.location) : null;
    data.lat = coords?.lat ?? null;
    data.lng = coords?.lng ?? null;
  }

  await project.update(data);
  res.json({ project, geocoded: data.lat != null });
}

async function geocodeProject(req, res) {
  const project = await LandscapingProject.findByPk(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.location) return res.status(400).json({ error: 'No location set on this project' });

  const coords = await geocodeAddress(project.location);
  if (!coords) return res.status(422).json({ error: 'Could not geocode this address — try a more specific location' });

  await project.update({ lat: coords.lat, lng: coords.lng });
  res.json({ project, lat: coords.lat, lng: coords.lng });
}

async function deleteProject(req, res) {
  const project = await LandscapingProject.findByPk(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  await LandscapingProjectPlant.destroy({ where: { project_id: project.id } });
  await project.destroy();
  res.json({ ok: true });
}

// ---- Project Plants (Inventory Transfer) ----

async function addPlantToProject(req, res) {
  const { id: project_id } = req.params;
  const {
    variant_id,
    quantity,
    install_date,
    status = 'planned',
    location_note,
    notes,
    deduct_inventory = true,
  } = req.body;

  if (!variant_id) return res.status(400).json({ error: 'variant_id is required' });
  const qty = parseInt(quantity, 10);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'quantity must be a positive integer' });

  const project = await LandscapingProject.findByPk(project_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (deduct_inventory) {
    const inv = await Inventory.findOne({ where: { variant_id } });
    if (!inv) return res.status(404).json({ error: 'Inventory record not found for this variant' });

    const available = inv.quantity_on_hand - (inv.quantity_reserved || 0);
    if (available < qty) {
      return res.status(400).json({ error: `Only ${available} available in inventory (${inv.quantity_on_hand} on hand, ${inv.quantity_reserved || 0} reserved)` });
    }

    const newReserved = (inv.quantity_reserved || 0) + qty;
    await inv.update({ quantity_reserved: newReserved });

    await InventoryLog.create({
      variant_id,
      user_id: req.user?.id || null,
      change_type: 'landscaping_transfer',
      quantity_before: inv.quantity_on_hand,
      quantity_change: -qty,
      quantity_after: inv.quantity_on_hand,
      reference_id: project_id,
      notes: notes || `Reserved for ${project.name}`,
      location: location_note || null,
    });

    // Remove from nursery location splits; place in a "Job Site" pending split
    const jobSiteLabel = `Job Site: ${project.name}`;
    await _deductFromNurserySplits(inv.id, jobSiteLabel, qty);
    await _adjustJobSiteSplit(inv.id, jobSiteLabel, qty);
  }

  const plant = await LandscapingProjectPlant.create({
    project_id,
    variant_id,
    quantity: qty,
    install_date: install_date || null,
    status,
    location_note: location_note?.trim() || null,
    notes: notes?.trim() || null,
  });

  const populated = await LandscapingProjectPlant.findByPk(plant.id, {
    include: [{
      model: PlantVariant,
      as: 'variant',
      include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] }],
    }],
  });

  res.status(201).json({ plant: populated });
}

async function updateProjectPlant(req, res) {
  const plant = await LandscapingProjectPlant.findByPk(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Record not found' });

  const allowed = ['quantity', 'install_date', 'status', 'location_note', 'notes'];
  const data = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });

  const newStatus = req.body.status;
  const newQty = req.body.quantity !== undefined ? parseInt(req.body.quantity, 10) : plant.quantity;
  const statusChangingToInstalled = newStatus === 'installed' && plant.status !== 'installed';
  const qtyDiff = newQty - plant.quantity;

  if (statusChangingToInstalled) {
    // Plants are in the ground — fully remove from inventory
    const inv = await Inventory.findOne({ where: { variant_id: plant.variant_id } });
    if (inv) {
      const project = await LandscapingProject.findByPk(plant.project_id);
      const newOnHand = Math.max(0, inv.quantity_on_hand - newQty);
      const newReserved = Math.max(0, (inv.quantity_reserved || 0) - newQty);
      await inv.update({ quantity_on_hand: newOnHand, quantity_reserved: newReserved });

      if (project) {
        await _adjustJobSiteSplit(inv.id, `Job Site: ${project.name}`, -newQty);
      }

      await InventoryLog.create({
        variant_id: plant.variant_id,
        user_id: req.user?.id || null,
        change_type: 'landscaping_transfer',
        quantity_before: inv.quantity_on_hand,
        quantity_change: -newQty,
        quantity_after: newOnHand,
        reference_id: plant.project_id,
        notes: `Planted/installed`,
      });
    }
  } else if (plant.status === 'planned' && qtyDiff !== 0) {
    // Quantity change while still planned — adjust reservation and location splits
    const inv = await Inventory.findOne({ where: { variant_id: plant.variant_id } });
    if (inv) {
      if (qtyDiff > 0) {
        const available = inv.quantity_on_hand - (inv.quantity_reserved || 0);
        if (available < qtyDiff) {
          return res.status(400).json({ error: `Only ${available} additional units available` });
        }
        const project = await LandscapingProject.findByPk(plant.project_id);
        if (project) {
          await _deductFromNurserySplits(inv.id, `Job Site: ${project.name}`, qtyDiff);
          await _adjustJobSiteSplit(inv.id, `Job Site: ${project.name}`, qtyDiff);
        }
      } else {
        // Reducing — shrink the job-site split
        const project = await LandscapingProject.findByPk(plant.project_id);
        if (project) {
          await _adjustJobSiteSplit(inv.id, `Job Site: ${project.name}`, qtyDiff);
        }
      }
      const newReserved = Math.max(0, (inv.quantity_reserved || 0) + qtyDiff);
      await inv.update({ quantity_reserved: newReserved });
    }
  } else if (req.body.quantity !== undefined && qtyDiff !== 0 && plant.status !== 'installed') {
    // Quantity change in 'removed' or other non-installed status — just sync reservation
    const inv = await Inventory.findOne({ where: { variant_id: plant.variant_id } });
    if (inv) {
      const newReserved = Math.max(0, (inv.quantity_reserved || 0) + qtyDiff);
      await inv.update({ quantity_reserved: newReserved });
    }
  }

  await plant.update(data);
  res.json({ plant });
}

async function removeProjectPlant(req, res) {
  const plant = await LandscapingProjectPlant.findByPk(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Record not found' });

  const { return_to_inventory = true } = req.body;

  const inv = await Inventory.findOne({ where: { variant_id: plant.variant_id } });
  if (inv) {
    // Clean up the job-site split if this plant was still in planned state
    if (plant.status === 'planned') {
      const project = await LandscapingProject.findByPk(plant.project_id);
      if (project) {
        await _adjustJobSiteSplit(inv.id, `Job Site: ${project.name}`, -plant.quantity);
      }
    }

    if (return_to_inventory) {
      // Return the physical plants back to on-hand count
      const newOnHand = inv.quantity_on_hand + plant.quantity;
      const newReserved = Math.max(0, (inv.quantity_reserved || 0) - plant.quantity);
      await inv.update({ quantity_on_hand: newOnHand, quantity_reserved: newReserved });
      await InventoryLog.create({
        variant_id: plant.variant_id,
        user_id: req.user?.id || null,
        change_type: 'return',
        quantity_before: inv.quantity_on_hand,
        quantity_change: plant.quantity,
        quantity_after: newOnHand,
        notes: 'Returned from landscaping / in-ground planting',
      });
    } else {
      // Plants were installed/lost — release the reservation only (on_hand stays reduced)
      const newReserved = Math.max(0, (inv.quantity_reserved || 0) - plant.quantity);
      await inv.update({ quantity_reserved: newReserved });
    }
  }

  await plant.destroy();
  res.json({ ok: true });
}

// ---- Location split helpers ----

async function _deductFromNurserySplits(inventoryId, skipLabel, qty) {
  const splits = await InventoryLocationSplit.findAll({
    where: { inventory_id: inventoryId },
    order: [['quantity', 'DESC']],
  });
  let toDeduct = qty;
  for (const split of splits) {
    if (toDeduct <= 0) break;
    if (split.location === skipLabel) continue;
    const deduct = Math.min(split.quantity, toDeduct);
    const remaining = split.quantity - deduct;
    if (remaining <= 0) {
      await split.destroy();
    } else {
      await split.update({ quantity: remaining });
    }
    toDeduct -= deduct;
  }
}

async function _adjustJobSiteSplit(inventoryId, label, delta) {
  const split = await InventoryLocationSplit.findOne({
    where: { inventory_id: inventoryId, location: label },
  });
  if (split) {
    const newQty = split.quantity + delta;
    if (newQty <= 0) {
      await split.destroy();
    } else {
      await split.update({ quantity: newQty });
    }
  } else if (delta > 0) {
    await InventoryLocationSplit.create({ inventory_id: inventoryId, location: label, quantity: delta });
  }
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  geocodeProject,
  deleteProject,
  addPlantToProject,
  updateProjectPlant,
  removeProjectPlant,
};
