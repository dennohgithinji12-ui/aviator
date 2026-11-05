const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const crypto = require('crypto');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (optional - remove if you want to preserve data)
  console.log('🧹 Cleaning existing data...');
  await prisma.stkAttempt.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users
  console.log('👤 Creating demo users...');

  const demoUser1 = await prisma.user.create({
    data: {
      phone: '254712345678',
      username: 'demo_pilot_1',
      passwordHash: crypto.createHash('sha256').update('password123').digest('hex'),
      realBalance: 1000,
      demoBalance: 50000,
      createdAt: BigInt(Date.now()),
      lastLogin: BigInt(Date.now()),
      signupBonusClaimed: true,
      casinoBonusClaimed: false
    }
  });

  const demoUser2 = await prisma.user.create({
    data: {
      phone: '254798765432',
      username: 'demo_pilot_2',
      passwordHash: crypto.createHash('sha256').update('password123').digest('hex'),
      realBalance: 500,
      demoBalance: 50000,
      createdAt: BigInt(Date.now()),
      lastLogin: BigInt(Date.now()),
      signupBonusClaimed: false,
      casinoBonusClaimed: false
    }
  });

  console.log(`✅ Created demo users: ${demoUser1.username}, ${demoUser2.username}`);

  // Create sample deposits
  console.log('💰 Creating sample deposits...');

  await prisma.deposit.create({
    data: {
      reference: 'DEMO_DEPOSIT_001',
      phone: demoUser1.phone,
      amount: 1000,
      status: 'SUCCESS',
      receiptNumber: 'NL12345678',
      createdAt: BigInt(Date.now() - 86400000), // 1 day ago
      completedAt: BigInt(Date.now() - 86400000)
    }
  });

  await prisma.deposit.create({
    data: {
      reference: 'DEMO_DEPOSIT_002',
      phone: demoUser2.phone,
      amount: 500,
      status: 'SUCCESS',
      receiptNumber: 'NL87654321',
      createdAt: BigInt(Date.now() - 43200000), // 12 hours ago
      completedAt: BigInt(Date.now() - 43200000)
    }
  });

  console.log('✅ Created sample deposits');

  // Create sample bets
  console.log('🎮 Creating sample bets...');

  const now = BigInt(Date.now());

  await prisma.bet.create({
    data: {
      phone: demoUser1.phone,
      mode: 'REAL',
      terminalId: 1,
      amount: 100,
      roundNonce: 1001,
      cashedOut: 1,
      multiplier: 2.5,
      payout: 250,
      profit: 150,
      status: 'WON',
      createdAt: now - BigInt(3600000) // 1 hour ago
    }
  });

  await prisma.bet.create({
    data: {
      phone: demoUser1.phone,
      mode: 'REAL',
      terminalId: 2,
      amount: 50,
      roundNonce: 1002,
      cashedOut: 0,
      multiplier: 1.0,
      payout: 0,
      profit: -50,
      status: 'LOST',
      createdAt: now - BigInt(1800000) // 30 minutes ago
    }
  });

  await prisma.bet.create({
    data: {
      phone: demoUser2.phone,
      mode: 'DEMO',
      terminalId: 1,
      amount: 200,
      roundNonce: 1003,
      cashedOut: 1,
      multiplier: 1.8,
      payout: 360,
      profit: 160,
      status: 'WON',
      createdAt: now - BigInt(900000) // 15 minutes ago
    }
  });

  console.log('✅ Created sample bets');

  // Create sample withdrawal
  console.log('💸 Creating sample withdrawal...');

  await prisma.withdrawal.create({
    data: {
      userId: demoUser1.id,
      phone: demoUser1.phone,
      amount: 200,
      taxAmount: 10,
      netAmount: 190,
      taxRate: 0.05,
      reference: 'WTH_DEMO_001',
      status: 'SETTLED',
      riskScore: 10,
      riskReason: 'Approved automated B2C payout',
      createdAt: now - BigInt(172800000), // 2 days ago
      completedAt: now - BigInt(172800000)
    }
  });

  console.log('✅ Created sample withdrawal');

  console.log('🎉 Database seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Users: 2`);
  console.log(`   - Deposits: 2`);
  console.log(`   - Bets: 3`);
  console.log(`   - Withdrawals: 1`);
  console.log('\n🔐 Demo Credentials:');
  console.log(`   Phone: 254712345678 | Password: password123`);
  console.log(`   Phone: 254798765432 | Password: password123`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
