const { User } = require('../models');

const SAFE_ATTRS = ['id', 'email', 'name', 'role', 'is_active', 'last_login_at', 'created_at'];

async function list(req, res) {
  const users = await User.findAll({
    attributes: SAFE_ATTRS,
    order: [['created_at', 'ASC']],
  });
  res.json(users);
}

async function create(req, res) {
  const { email, name, role = 'staff', password } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!['admin', 'manager', 'staff'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
  if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

  const user = await User.create({
    email: email.toLowerCase().trim(),
    name: name?.trim() || null,
    role,
    password_hash: password,
    is_active: true,
  });

  res.status(201).json({
    id: user.id, email: user.email, name: user.name,
    role: user.role, is_active: user.is_active, created_at: user.created_at,
  });
}

async function update(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Prevent removing admin access from yourself
  if (req.user.id === user.id && req.body.role && req.body.role !== 'admin' && user.role === 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin role' });
  }
  if (req.user.id === user.id && req.body.is_active === false) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' });
  }

  const data = {};
  if (req.body.name !== undefined) data.name = req.body.name?.trim() || null;
  if (req.body.role !== undefined && ['admin', 'manager', 'staff'].includes(req.body.role)) data.role = req.body.role;
  if (req.body.is_active !== undefined) data.is_active = Boolean(req.body.is_active);
  if (req.body.password && req.body.password.length >= 8) data.password_hash = req.body.password;

  await user.update(data);
  const fresh = await User.findByPk(user.id, { attributes: SAFE_ATTRS });
  res.json(fresh);
}

async function remove(req, res) {
  if (req.user.id === req.params.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await user.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
