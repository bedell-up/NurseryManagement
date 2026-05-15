const { ProductionBatchStage, Production, TrayType } = require('../models');

const VALID_STAGES = ['potted', 'tray', 'loss'];

function computeTotals(stages) {
  const totals = { potted: 0, tray: 0, loss: 0 };
  for (const s of stages) totals[s.stage] = (totals[s.stage] || 0) + s.quantity;
  return totals;
}

// GET /production/:id/stages
async function list(req, res) {
  const batch = await Production.findByPk(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const stages = await ProductionBatchStage.findAll({
    where: { batch_id: req.params.id },
    order: [['date', 'DESC'], ['created_at', 'DESC']],
  });

  // quantity_started records the number of trays/containers planted, not individual seeds.
  // Multiply by the tray's cell_count to get the actual seed count.
  let cellCount = 1;
  if (batch.tray_type) {
    const tray = await TrayType.findOne({ where: { name: batch.tray_type } });
    cellCount = tray?.cell_count ?? 1;
  }
  const seedCount = (batch.quantity_started || 0) * cellCount;

  const totals = computeTotals(stages);
  const in_tray = Math.max(0, seedCount - totals.potted - totals.loss);

  res.json({ stages, totals: { ...totals, in_tray }, seed_count: seedCount, cell_count: cellCount });
}

// POST /production/:id/stages
async function create(req, res) {
  const { stage, quantity, date, notes } = req.body;

  if (!VALID_STAGES.includes(stage)) {
    return res.status(400).json({ error: `stage must be one of: ${VALID_STAGES.join(', ')}` });
  }
  const qty = parseInt(quantity, 10);
  if (!qty || qty < 1) return res.status(400).json({ error: 'quantity must be a positive integer' });
  if (!date) return res.status(400).json({ error: 'date is required' });

  const batch = await Production.findByPk(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const entry = await ProductionBatchStage.create({
    batch_id: req.params.id,
    stage,
    quantity: qty,
    date,
    notes: notes?.trim() || null,
  });

  res.status(201).json({ stage: entry });
}

// PUT /production/stages/:stage_id
async function update(req, res) {
  const entry = await ProductionBatchStage.findByPk(req.params.stage_id);
  if (!entry) return res.status(404).json({ error: 'Stage entry not found' });

  const { stage, quantity, date, notes } = req.body;
  const data = {};

  if (stage !== undefined) {
    if (!VALID_STAGES.includes(stage)) return res.status(400).json({ error: `Invalid stage` });
    data.stage = stage;
  }
  if (quantity !== undefined) {
    const qty = parseInt(quantity, 10);
    if (!qty || qty < 1) return res.status(400).json({ error: 'quantity must be a positive integer' });
    data.quantity = qty;
  }
  if (date !== undefined) data.date = date;
  if (notes !== undefined) data.notes = notes?.trim() || null;

  await entry.update(data);
  res.json({ stage: entry });
}

// DELETE /production/stages/:stage_id
async function remove(req, res) {
  const entry = await ProductionBatchStage.findByPk(req.params.stage_id);
  if (!entry) return res.status(404).json({ error: 'Stage entry not found' });
  await entry.destroy();
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
