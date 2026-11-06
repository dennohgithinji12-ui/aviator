import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/lib/password';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed the database');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const defaults = [
  { key: 'MINIMUM_DEPOSIT_KES', value: 49, description: 'Minimum M-Pesa deposit amount' },
  { key: 'MINIMUM_STAKE_KES', value: 100, description: 'Minimum real or demo stake' },
  { key: 'MAXIMUM_STAKE_KES', value: 100000, description: 'Maximum stake per terminal' },
  { key: 'MINIMUM_WITHDRAWAL_KES', value: 25, description: 'Minimum withdrawal request' },
  { key: 'GAMING_TAX_RATE', value: 0.05, description: 'Withdrawal tax rate; confirm policy before production payouts' },
  { key: 'MAX_WITHDRAWALS_PER_24H', value: 2, description: 'Withdrawal velocity limit' },
  { key: 'AUTO_WITHDRAWAL_LIMIT_KES', value: 5000, description: 'Maximum automatic withdrawal amount' },
  { key: 'DEMO_STARTING_BALANCE_KES', value: 50000, description: 'Starting demo balance for new accounts' },
  { key: 'MAX_WEEKLY_PASSWORD_RESETS', value: 2, description: 'Password reset rate limit' },
  { key: 'LIQUIDITY_VAULT_ENABLED', value: false, description: 'Enable the liquidity vault after its economics and settlement rules are approved' },
  { key: 'ROLLOVER_VAULT_ENABLED', value: false, description: 'Enable rollover after its rules and liability controls are approved' },
  { key: 'PAYMENTS_SANDBOX_MODE', value: true, description: 'Keep payments in sandbox until live provider configuration is verified' }
];

async function main() {
  const now = BigInt(Date.now());

  // Defaults are insert-only: rerunning deployment seeding never resets live settings.
  for (const setting of defaults) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: { ...setting, updatedAt: now }
    });
  }

  await prisma.liquidityPool.upsert({
    where: { id: 'primary' },
    update: {},
    create: {
      id: 'primary',
      name: 'ShiftStack Liquidity Vault',
      totalValueLocked: 0,
      apyPercent: 0,
      enabled: false,
      createdAt: now,
      updatedAt: now
    }
  });

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured for production deployments');
    }
    console.warn('Admin seed skipped: configure ADMIN_EMAIL and ADMIN_PASSWORD to create the initial admin login.');
    return;
  }
  if (password.length < 14 || password.length > 128) {
    throw new Error('ADMIN_PASSWORD must be between 14 and 128 characters');
  }

  const passwordHash = await hashPassword(password);
  const name = process.env.ADMIN_NAME?.trim() || 'ShiftStack Administrator';
  const admin = await prisma.admin.upsert({
    where: { email },
    update: { name, passwordHash, updatedAt: now },
    create: { email, name, passwordHash, role: 'SUPER_ADMIN', isActive: true, createdAt: now, updatedAt: now }
  });

  console.log(`Seeded defaults and administrator account ${admin.email}.`);
  console.log('No demo user accounts, balances, deposits, or bets were created.');
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
