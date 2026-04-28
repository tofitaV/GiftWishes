import { Injectable } from "@nestjs/common";
import { EXTRA_WISHLIST_SLOT_PRICE_STARS, TELEGRAM_MARKET_TRANSFER_FEE_STARS } from "@gift-wishes/shared";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class StarsService {
  constructor(private readonly prisma: PrismaService) {}

  async stubBuyWishlistSlot(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.starsLedgerEntry.create({
        data: {
          userId,
          type: "slot_purchase_stub",
          amountStars: EXTRA_WISHLIST_SLOT_PRICE_STARS,
          metadata: { stub: true }
        }
      });
      return tx.user.update({
        where: { id: userId },
        data: { purchasedWishlistSlots: { increment: 1 } }
      });
    });
  }

  async stubChargeTelegramTransferFee(userId: string, purchaseId: string) {
    return this.prisma.starsLedgerEntry.create({
      data: {
        userId,
        type: "market_transfer_fee_stub",
        amountStars: TELEGRAM_MARKET_TRANSFER_FEE_STARS,
        metadata: { stub: true, purchaseId }
      }
    });
  }
}

