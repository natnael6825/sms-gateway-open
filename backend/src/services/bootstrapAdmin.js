'use strict';
const bcrypt = require('bcrypt');
const prisma = require('../prisma/client');

async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const user = await prisma.user.create({ data: { email, password: await bcrypt.hash(password, 10), must_change_password: true } });
  console.log(`Created owner account for ${user.email}. A password change is required at first login.`);
  return user;
}
module.exports = bootstrapAdmin;
