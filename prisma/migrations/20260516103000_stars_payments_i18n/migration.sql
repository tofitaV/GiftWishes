ALTER TYPE "StarsLedgerType" ADD VALUE 'slot_purchase';

ALTER TABLE "User" ADD COLUMN "preferredLanguage" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "StarsLedgerEntry"
  ADD COLUMN "invoicePayload" TEXT,
  ADD COLUMN "telegramPaymentChargeId" TEXT;

CREATE UNIQUE INDEX "StarsLedgerEntry_invoicePayload_key" ON "StarsLedgerEntry"("invoicePayload");
CREATE UNIQUE INDEX "StarsLedgerEntry_telegramPaymentChargeId_key" ON "StarsLedgerEntry"("telegramPaymentChargeId");
