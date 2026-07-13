'use strict';
require('dotenv').config();
const bootstrapAdmin = require('../src/services/bootstrapAdmin');
const prisma = require('../src/prisma/client');

bootstrapAdmin()
  .then((user) => console.log(`Owner account ready: ${user.email}`))
  .catch((error) => { console.error(`Seed failed: ${error.message}`); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
