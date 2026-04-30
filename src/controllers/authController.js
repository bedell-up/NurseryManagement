const jwt = require('jsonwebtoken');
const { User } = require('../models');

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (!user || !user.is_active || !(await user.validatePassword(password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  await user.update({ last_login_at: new Date() });
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, me };
