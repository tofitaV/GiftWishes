-- CreateEnum
CREATE TYPE "WalletLedgerType" AS ENUM ('deposit', 'withdrawal', 'purchase_hold', 'purchase', 'refund', 'split_transfer');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('pending', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('quoted', 'pending', 'bought', 'delivered', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "StarsLedgerType" AS ENUM ('slot_purchase_stub', 'market_transfer_fee_stub');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "languageCode" TEXT,
    "isUsernameVisible" BOOLEAN NOT NULL DEFAULT false,
    "tonBalanceNano" BIGINT NOT NULL DEFAULT 0,
    "purchasedWishlistSlots" INTEGER NOT NULL DEFAULT 0,
    "connectedWalletAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "collectionName" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "backdropName" TEXT,
    "symbolName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WalletLedgerType" NOT NULL,
    "amountNano" BIGINT NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'pending',
    "txHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "wishlistItemId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "priceNano" BIGINT NOT NULL,
    "satelliteOriginalPrice" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'quoted',
    "requiresStarsTransferFee" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarsLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "StarsLedgerType" NOT NULL,
    "amountStars" INTEGER NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'confirmed',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarsLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "WishlistItem_ownerUserId_idx" ON "WishlistItem"("ownerUserId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_userId_createdAt_idx" ON "WalletLedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLedgerEntry_txHash_type_key" ON "WalletLedgerEntry"("txHash", "type");

-- CreateIndex
CREATE INDEX "Purchase_buyerUserId_createdAt_idx" ON "Purchase"("buyerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_recipientUserId_createdAt_idx" ON "Purchase"("recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "StarsLedgerEntry_userId_createdAt_idx" ON "StarsLedgerEntry"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "WishlistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarsLedgerEntry" ADD CONSTRAINT "StarsLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
