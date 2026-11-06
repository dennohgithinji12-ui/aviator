const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GAME_MASTER_SECRET',
  'ADMIN_JWT_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'CRON_SECRET',
  'PAYHERO_CALLBACK_SECRET',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Vercel deployment is missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.ADMIN_PASSWORD.length < 14 || process.env.ADMIN_PASSWORD.length > 128) {
  console.error('ADMIN_PASSWORD must be between 14 and 128 characters.');
  process.exit(1);
}

if (process.env.PAYHERO_PAYOUTS_ENABLED === 'true') {
  const payoutRequired = ['PAYHERO_API_KEY', 'PAYHERO_API_SECRET', 'PAYHERO_PAYOUT_ACCOUNT_ID', 'PAYHERO_NETWORK_CODE', 'APP_BASE_URL'];
  const payoutMissing = payoutRequired.filter((name) => !process.env[name]?.trim());
  if (payoutMissing.length) {
    console.error(`PayHero payouts are enabled but required environment variables are missing: ${payoutMissing.join(', ')}`);
    process.exit(1);
  }
  if (!Number.isInteger(Number(process.env.PAYHERO_PAYOUT_ACCOUNT_ID))) {
    console.error('PAYHERO_PAYOUT_ACCOUNT_ID must be a numeric account ID.');
    process.exit(1);
  }
}

console.log('Required Vercel environment variables are configured.');
