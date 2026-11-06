ALTER TABLE "Withdrawal"
  ADD COLUMN IF NOT EXISTS "providerReference" TEXT,
  ADD COLUMN IF NOT EXISTS "checkoutRequestId" TEXT,
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT;