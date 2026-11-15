import { prisma } from '@/lib/db';

const POLICY_KEY = 'ROUND_ODDS_POLICY';
export const FAVORABLE_ODDS_TARGET_PERCENT = 65;
const FAVORABLE_BOOST_RATE = (FAVORABLE_ODDS_TARGET_PERCENT / 100 - 0.48) / (1 - 0.48);
export const MAX_FLIGHT_SECONDS = 160;
const MAX_CRASH_MULTIPLIER = Math.floor((Math.exp(0.072 * MAX_FLIGHT_SECONDS) + 0.012 * MAX_FLIGHT_SECONDS ** 2) * 100) / 100;

export type OddsPolicyChange = { fromNonce: number; favorable: boolean };

function parseChanges(value: unknown): OddsPolicyChange[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const changes = (value as { changes?: unknown }).changes;
  if (!Array.isArray(changes)) return [];
  return changes
    .filter((change): change is OddsPolicyChange => Boolean(change)
      && typeof change === 'object'
      && Number.isSafeInteger((change as OddsPolicyChange).fromNonce)
      && typeof (change as OddsPolicyChange).favorable === 'boolean')
    .sort((a, b) => a.fromNonce - b.fromNonce);
}

// In-memory cache to eliminate repetitive DB queries on every round calculation
let cachedPolicy: { changes: OddsPolicyChange[]; expiresAt: number } | null = null;

export async function getOddsPolicyChanges(): Promise<OddsPolicyChange[]> {
  const now = Date.now();
  if (cachedPolicy && now < cachedPolicy.expiresAt) {
    return cachedPolicy.changes;
  }

  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: POLICY_KEY }, select: { value: true } });
    const changes = parseChanges(setting?.value);
    cachedPolicy = { changes, expiresAt: now + 30_000 };
    return changes;
  } catch {
    return cachedPolicy ? cachedPolicy.changes : [];
  }
}

export function isFavorableOddsEnabled(changes: OddsPolicyChange[], nonce: number): boolean {
  let enabled = false;
  for (const change of changes) {
    if (change.fromNonce > nonce) break;
    enabled = change.favorable;
  }
  return enabled;
}

export async function scheduleOddsPolicyChange(fromNonce: number, favorable: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.appSetting.findUnique({ where: { key: POLICY_KEY }, select: { value: true } });
    const changes = parseChanges(current?.value).filter((change) => change.fromNonce < fromNonce);
    changes.push({ fromNonce, favorable });
    const value = { changes };
    const now = BigInt(Date.now());
    await tx.appSetting.upsert({
      where: { key: POLICY_KEY },
      update: { value, description: 'Round odds distribution changes, applied from the listed round nonce', updatedAt: now },
      create: { key: POLICY_KEY, value, description: 'Round odds distribution changes, applied from the listed round nonce', updatedAt: now }
    });
  });
  // Clear cache immediately so the new policy is applied
  cachedPolicy = null;
}

/**
 * Preserve the current distribution exactly when disabled. When enabled, a
 * deterministic portion of outcomes below 2.01x is remapped into the same
 * heavy-tailed distribution starting at 2.01x, giving about 65% of rounds
 * a 2.01x-or-higher result over a long run. All inputs remain round-seeded.
 */
export function getCrashMultiplierForPolicy(hexHash: string, favorable: boolean): number {
  const e = Math.pow(2, 52);
  const baseEntropy = parseInt(hexHash.substring(0, 13), 16);
  if (baseEntropy % 33 === 0) return 1.00;

  const baseMultiplier = Math.min(MAX_CRASH_MULTIPLIER, Math.max(1.00, Math.floor((100 * e - baseEntropy) / (e - baseEntropy)) / 100));
  if (!favorable || baseMultiplier >= 2.01) return baseMultiplier;

  const gateEntropy = parseInt(hexHash.substring(13, 26), 16);
  if (gateEntropy / e >= FAVORABLE_BOOST_RATE) return baseMultiplier;

  const boostedEntropy = parseInt(hexHash.substring(26, 39), 16);
  return Math.min(MAX_CRASH_MULTIPLIER, Math.max(2.01, Math.floor((100 * 2.01 * e) / (e - boostedEntropy)) / 100));
}
