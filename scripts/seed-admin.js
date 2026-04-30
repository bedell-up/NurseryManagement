require('dotenv').config();
const { sequelize, User } = require('../src/models');

async function seedAdmin() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  const email = process.env.ADMIN_EMAIL || 'admin@pscapps.com';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  const [user, created] = await User.findOrCreate({
    where: { email },
    defaults: {
      email,
      password_hash: password,
      name: 'Admin',
      role: 'admin',
    },
  });

  if (created) {
    console.log(`Admin user created: ${email}`);
  } else {
    console.log(`Admin user already exists: ${email}`);
  }

  await sequelize.close();
}

seedAdmin().catch((err) => { console.error(err); process.exit(1); });
