import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isProduction = process.env.NODE_ENV === 'production';

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
    // Keep max connection count strictly at 1 per serverless instance to prevent
    // exhausting database pool limits during concurrent traffic spikes.
    max: isProduction ? 1 : 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000
  })
});

globalForPrisma.prisma = prisma;
