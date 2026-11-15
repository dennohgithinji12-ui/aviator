-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "firebaseUid" TEXT,
    "phone" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT,
    "realBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "demoBalance" DECIMAL(10,2) NOT NULL DEFAULT 50000,
    "createdAt" BIGINT NOT NULL,
    "lastLogin" BIGINT,
    "signupBonusClaimed" BOOLEAN NOT NULL DEFAULT false,
    "casinoBonusClaimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PAYHERO',
    "providerReference" TEXT,
    "checkoutRequestId" TEXT,
    "status" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "failureReason" TEXT,
    "createdAt" BIGINT NOT NULL,
    "completedAt" BIGINT,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "terminalId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "roundNonce" INTEGER NOT NULL,
    "cashedOut" INTEGER NOT NULL DEFAULT 0,
    "multiplier" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payout" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "nonce" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "serverSeed" TEXT,
    "clientSeed" TEXT NOT NULL,
    "crashMultiplier" DECIMAL(10,2),
    "roundStartTime" BIGINT NOT NULL,
    "roundEndTime" BIGINT NOT NULL,
    "settledAt" BIGINT,
    "lostBetCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "lastLoginAt" BIGINT,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" BIGSERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" BIGSERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'REAL',
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "metadata" JSONB,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" BIGSERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB,
    "error" TEXT,
    "receivedAt" BIGINT NOT NULL,
    "processedAt" BIGINT,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "phone" TEXT NOT NULL,
    "targetPhone" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(10,2) NOT NULL DEFAULT 0.05,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskReason" TEXT,
    "createdAt" BIGINT NOT NULL,
    "completedAt" BIGINT,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StkAttempt" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,

    CONSTRAINT "StkAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidityPool" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "name" TEXT NOT NULL DEFAULT 'ShiftStack Liquidity Vault',
    "totalValueLocked" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "apyPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "LiquidityPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidityPosition" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "poolId" TEXT NOT NULL DEFAULT 'primary',
    "principal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "accruedYield" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "LiquidityPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidityTransaction" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "poolId" TEXT NOT NULL,
    "positionId" BIGINT,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "LiquidityTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolloverChallenge" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "baseStake" DECIMAL(12,2) NOT NULL,
    "targetMultiplier" DECIMAL(7,2) NOT NULL,
    "totalStages" INTEGER NOT NULL,
    "currentStage" INTEGER NOT NULL DEFAULT 0,
    "currentStake" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "accumulatedProfit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" BIGINT NOT NULL,
    "startedAt" BIGINT,
    "completedAt" BIGINT,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "RolloverChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolloverStage" (
    "id" BIGSERIAL NOT NULL,
    "challengeId" BIGINT NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "roundNonce" INTEGER,
    "betId" INTEGER,
    "stake" DECIMAL(12,2) NOT NULL,
    "targetMultiplier" DECIMAL(7,2) NOT NULL,
    "resultMultiplier" DECIMAL(7,2),
    "payout" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" BIGINT NOT NULL,
    "completedAt" BIGINT,

    CONSTRAINT "RolloverStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_reference_key" ON "Deposit"("reference");

-- CreateIndex
CREATE INDEX "Deposit_reference_idx" ON "Deposit"("reference");

-- CreateIndex
CREATE INDEX "Deposit_phone_idx" ON "Deposit"("phone");

-- CreateIndex
CREATE INDEX "Bet_phone_idx" ON "Bet"("phone");

-- CreateIndex
CREATE INDEX "Bet_roundNonce_status_idx" ON "Bet"("roundNonce", "status");

-- CreateIndex
CREATE INDEX "Round_phase_roundEndTime_idx" ON "Round"("phase", "roundEndTime");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Admin_isActive_role_idx" ON "Admin"("isActive", "role");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_reference_key" ON "WalletTransaction"("reference");

-- CreateIndex
CREATE INDEX "WalletTransaction_phone_createdAt_idx" ON "WalletTransaction"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_createdAt_idx" ON "WalletTransaction"("type", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_reference_receivedAt_idx" ON "PaymentEvent"("reference", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_status_receivedAt_idx" ON "PaymentEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_reference_key" ON "Withdrawal"("reference");

-- CreateIndex
CREATE INDEX "Withdrawal_phone_idx" ON "Withdrawal"("phone");

-- CreateIndex
CREATE INDEX "Withdrawal_reference_idx" ON "Withdrawal"("reference");

-- CreateIndex
CREATE INDEX "PasswordReset_phone_timestamp_idx" ON "PasswordReset"("phone", "timestamp");

-- CreateIndex
CREATE INDEX "StkAttempt_phone_timestamp_idx" ON "StkAttempt"("phone", "timestamp");

-- CreateIndex
CREATE INDEX "LiquidityPosition_poolId_status_idx" ON "LiquidityPosition"("poolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidityPosition_userId_poolId_key" ON "LiquidityPosition"("userId", "poolId");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidityTransaction_reference_key" ON "LiquidityTransaction"("reference");

-- CreateIndex
CREATE INDEX "LiquidityTransaction_userId_createdAt_idx" ON "LiquidityTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LiquidityTransaction_poolId_createdAt_idx" ON "LiquidityTransaction"("poolId", "createdAt");

-- CreateIndex
CREATE INDEX "RolloverChallenge_userId_status_createdAt_idx" ON "RolloverChallenge"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RolloverStage_roundNonce_status_idx" ON "RolloverStage"("roundNonce", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RolloverStage_challengeId_stageNumber_key" ON "RolloverStage"("challengeId", "stageNumber");

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_phone_fkey" FOREIGN KEY ("phone") REFERENCES "User"("phone") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_phone_fkey" FOREIGN KEY ("phone") REFERENCES "User"("phone") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_phone_fkey" FOREIGN KEY ("phone") REFERENCES "User"("phone") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_phone_fkey" FOREIGN KEY ("phone") REFERENCES "User"("phone") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_phone_fkey" FOREIGN KEY ("phone") REFERENCES "User"("phone") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StkAttempt" ADD CONSTRAINT "StkAttempt_phone_fkey" FOREIGN KEY ("phone") REFERENCES "User"("phone") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityPosition" ADD CONSTRAINT "LiquidityPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityPosition" ADD CONSTRAINT "LiquidityPosition_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "LiquidityPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityTransaction" ADD CONSTRAINT "LiquidityTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityTransaction" ADD CONSTRAINT "LiquidityTransaction_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "LiquidityPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityTransaction" ADD CONSTRAINT "LiquidityTransaction_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "LiquidityPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloverChallenge" ADD CONSTRAINT "RolloverChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloverStage" ADD CONSTRAINT "RolloverStage_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "RolloverChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

