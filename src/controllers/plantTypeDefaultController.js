const { PlantTypeDefault, PlantType } = require('../models');

async function list(req, res) {
  const [plantTypes, rows] = await Promise.all([
    PlantType.findAll({ where: { is_active: true }, order: [['sort_order', 'ASC'], ['label', 'ASC']] }),
    PlantTypeDefault.findAll({ order: [['plant_type', 'ASC']] }),
  ]);
  const byType = Object.fromEntries(rows.map(r => [r.plant_type, r]));
  const result = plantTypes.map(pt => {
    const saved = byType[pt.name];
    return {
      id:                 saved?.id               ?? null,
      plant_type:         pt.name,
      label:              pt.label,
      default_tray_types: saved?.default_tray_types ?? [],
      default_pot_sizes:  saved?.default_pot_sizes  ?? [],
    };
  });
  res.json(result);
}

async function upsert(req, res) {
  const { plant_type } = req.params;
  const exists = await PlantType.findOne({ where: { name: plant_type } });
  if (!exists) return res.status(400).json({ error: 'Unknown plant type' });
  const { default_tray_types, default_pot_sizes } = req.body;
  const [row] = await PlantTypeDefault.upsert({
    plant_type,
    default_tray_types: Array.isArray(default_tray_types) ? default_tray_types : [],
    default_pot_sizes:  Array.isArray(default_pot_sizes)  ? default_pot_sizes  : [],
  }, { returning: true });
  res.json(row);
}

module.exports = { list, upsert };
