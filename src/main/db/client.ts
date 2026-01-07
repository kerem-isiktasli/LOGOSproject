/**
 * Prisma Database Client for LOGOS
 *
 * Exports a singleton PrismaClient instance to ensure connection pooling
 * and prevent multiple client instances during development (hot reload).
 */

import { PrismaClient } from '@prisma/client';

// Use a unique global key to avoid conflicts with other modules
const globalForPrisma = globalThis as unknown as {
  __prismaClient: PrismaClient | undefined;
};

/**
 * Singleton PrismaClient instance
 *
 * In development, we store the client on the global object to prevent
 * creating multiple instances during hot module replacement (HMR).
 * In production, we always create a fresh instance.
 */
export const prisma: PrismaClient =
  globalForPrisma.__prismaClient ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

// Store on global in development to survive HMR
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prismaClient = prisma;
}

/**
 * Graceful shutdown handler
 * Ensures database connections are properly closed on application exit
 */
async function gracefulShutdown(): Promise<void> {
  await prisma.$disconnect();
}

// Register shutdown handlers
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default prisma;

/**
 * Initialize the database connection
 * Called during app startup to ensure connection is ready
 */
export async function initDatabase(): Promise<void> {
  await prisma.$connect();
}
