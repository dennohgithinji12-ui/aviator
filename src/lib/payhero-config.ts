import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';

export type PayHeroConfig = { username: string; password: string; channelId: string; callbackSecret: string; payoutAccountId: string; networkCode: string; payoutsEnabled: boolean };
const KEY = 'PAYHERO_CONFIG';

function key() {
  if (!process.env.GAME_MASTER_SECRET) throw new Error('GAME_MASTER_SECRET is required for saved PayHero credentials');
  return createHash('sha256').update(process.env.GAME_MASTER_SECRET).digest();
}

export async function getPayHeroConfig(): Promise<PayHeroConfig> {
  const saved = await prisma.appSetting.findUnique({ where: { key: KEY }, select: { value: true } });
  if (typeof saved?.value === 'string') {
    const [iv, tag, ciphertext] = saved.value.split('.').map((part) => Buffer.from(part, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as PayHeroConfig;
  }
  return { username: process.env.PAYHERO_API_USERNAME || process.env.PAYHERO_API_KEY || '', password: process.env.PAYHERO_API_PASSWORD || process.env.PAYHERO_API_SECRET || '', channelId: process.env.PAYHERO_CHANNEL_ID || '', callbackSecret: process.env.PAYHERO_CALLBACK_SECRET || '', payoutAccountId: process.env.PAYHERO_PAYOUT_ACCOUNT_ID || '', networkCode: process.env.PAYHERO_NETWORK_CODE || '', payoutsEnabled: process.env.PAYHERO_PAYOUTS_ENABLED === 'true' };
}

export async function savePayHeroConfig(config: PayHeroConfig) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()]);
  const value = [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
  const updatedAt = BigInt(Date.now());
  await prisma.appSetting.upsert({ where: { key: KEY }, update: { value, updatedAt }, create: { key: KEY, value, description: 'Encrypted PayHero payment settings', updatedAt } });
}
