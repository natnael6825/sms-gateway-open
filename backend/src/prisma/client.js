const { PrismaClient } = require('@prisma/client');

// Use a global variable to avoid multiple PrismaClient instances in development
// (Next.js hot reload / Jest test runs can create many instances otherwise)
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
