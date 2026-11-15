ALTER TABLE "LiquidityPosition" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'REAL';
ALTER TABLE "LiquidityTransaction" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'REAL';
ALTER TABLE "RolloverChallenge" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'REAL';
ALTER TABLE "RolloverChallenge" ADD COLUMN IF NOT EXISTS "reference" TEXT NOT NULL DEFAULT '';

UPDATE "RolloverChallenge"
SET "reference" = 'RC-' || upper(substr(md5("id"::text || clock_timestamp()::text), 1, 12))
WHERE "reference" = '';

DROP INDEX IF EXISTS "LiquidityPosition_userId_poolId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "LiquidityPosition_userId_poolId_mode_key"
  ON "LiquidityPosition"("userId", "poolId", "mode");
CREATE UNIQUE INDEX IF NOT EXISTS "RolloverChallenge_reference_key"
  ON "RolloverChallenge"("reference");
ALTER TABLE "RolloverChallenge" ALTER COLUMN "reference" DROP DEFAULT;
