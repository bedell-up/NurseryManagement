const path = require('path');
const { importFromFile } = require('../services/importService');

async function upload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
    return res.status(400).json({ error: 'Only .xlsx, .xls, and .csv files are accepted' });
  }

  const results = await importFromFile(filePath);
  res.json({
    message: 'Import complete',
    imported: results.imported,
    updated: results.updated,
    errors: results.errors,
  });
}

module.exports = { upload };
