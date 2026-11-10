const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GAME_MASTER_SECRET',
  'ADMIN_JWT_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD'
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Vercel deployment is missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

for (const name of ['DATABASE_URL', 'DATABASE_URL_POOLED', 'DIRECT_URL']) {
  if (!process.env[name]) continue;
  try {
    const url = new URL(process.env[name]);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) throw new Error();
  } catch {
    console.error(`${name} must be a PostgreSQL connection URL (postgres:// or postgresql://).`);
    process.exit(1);
  }
}

if (!process.env.DATABASE_URL_POOLED && new URL(process.env.DATABASE_URL).hostname === 'db.prisma.io') {
  console.warn('DATABASE_URL_POOLED is missing. Add the pooled Prisma Postgres URL for runtime traffic to avoid exhausting direct database connections.');
}

if (process.env.ADMIN_PASSWORD.length < 14 || process.env.ADMIN_PASSWORD.length > 128) {
  console.error('ADMIN_PASSWORD must be between 14 and 128 characters.');
  process.exit(1);
}

if (process.env.APP_BASE_URL) {
  try {
    if (new URL(process.env.APP_BASE_URL).protocol !== 'https:') throw new Error();
  } catch {
    console.error('APP_BASE_URL must be a public HTTPS origin, for example https://example.com.');
    process.exit(1);
  }
}

console.log('Required Vercel environment variables are configured.');
