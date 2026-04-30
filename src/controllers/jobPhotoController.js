const path = require('path');
const fs   = require('fs');
const { JobPhoto, LandscapingProject } = require('../models');

async function listPhotos(req, res) {
  const photos = await JobPhoto.findAll({
    where: { project_id: req.params.id },
    order: [['created_at', 'ASC']],
  });
  res.json({ photos });
}

async function uploadPhotos(req, res) {
  const project = await LandscapingProject.findByPk(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const files = req.files;
  if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const photos = await JobPhoto.bulkCreate(files.map(f => ({
    project_id: req.params.id,
    filename:      f.filename,
    original_name: f.originalname,
    mime_type:     f.mimetype,
    file_size:     f.size,
    uploaded_by:   req.user?.id || null,
  })));

  res.status(201).json({ photos });
}

async function serveFile(req, res) {
  const photo = await JobPhoto.findByPk(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const filePath = path.resolve('uploads/job-photos', photo.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.sendFile(filePath);
}

async function updateCaption(req, res) {
  const photo = await JobPhoto.findByPk(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  await photo.update({ caption: req.body.caption || null });
  res.json({ photo });
}

async function deletePhoto(req, res) {
  const photo = await JobPhoto.findByPk(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const filePath = path.resolve('uploads/job-photos', photo.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await photo.destroy();
  res.json({ ok: true });
}

module.exports = { listPhotos, uploadPhotos, serveFile, updateCaption, deletePhoto };
