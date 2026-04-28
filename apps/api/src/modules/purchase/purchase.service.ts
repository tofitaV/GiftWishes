import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  GiftListingDto,
  MARKETS_REQUIRING_TELEGRAM_TRANSFER_FEE,
  MARKETS_WITH_SATELLITE_DELIVERY,
  tonToNanoString
} from "@gift-wishes/shared";
import { GiftSatelliteService } from "../gift-satellite/gift-satellite.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { StarsService } from "../stars/stars.service.js";

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly satellite: GiftSatelliteService,
    private readonly stars: StarsService
  ) {}

  async quote(buyerUserId: string, wishlistItemId: string) {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { id: wishlistItemId },
      include: { owner: true }
    });
    if (!item) throw new NotFoundException("Wishlist item not found");
    if (!item.owner.username) throw new BadRequestException("Recipient has no visible Telegram username");

    const listings = await this.satellite.searchAllMarkets(item.collectionName, {
      modelName: item.modelName,
      backdropName: item.backdropName
    });
    const sorted = listings
      .filter((listing) => listing.currency === "ton")
      .sort((a, b) => a.normalizedPrice - b.normalizedPrice);

    return {
      wishlistItemId,
      recipient: { id: item.owner.id, username: item.owner.username },
      cheapest: sorted[0] ?? null,
      listings: sorted,
      buyerUserId
    };
  }

  async confirm(buyerUserId: string, wishlistItemId: string, listingSlug: string) {
    const quote = await this.quote(buyerUserId, wishlistItemId);
    const listing = quote.listings.find((candidate: GiftListingDto) => candidate.slug === listingSlug) ?? quote.cheapest;
    if (!listing) throw new BadRequestException("Gift is not available on supported markets");

    const priceNano = BigInt(tonToNanoString(listing.normalizedPrice));
    const requiresStarsTransferFee = MARKETS_REQUIRING_TELEGRAM_TRANSFER_FEE.includes(listing.market);

    const purchase = await this.prisma.$transaction(async (tx) => {
      const buyer = await tx.user.findUniqueOrThrow({ where: { id: buyerUserId } });
      if (buyer.tonBalanceNano < priceNano) throw new BadRequestException("Insufficient TON balance");

      await tx.user.update({ where: { id: buyerUserId }, data: { tonBalanceNano: { decrement: priceNano } } });
      await tx.walletLedgerEntry.create({
        data: { userId: buyerUserId, type: "purchase_hold", amountNano: priceNano, status: "confirmed" }
      });
      return tx.purchase.create({
        data: {
          buyerUserId,
          recipientUserId: quote.recipient.id,
          wishlistItemId,
          market: listing.market,
          slug: listing.slug,
          giftId: listing.giftId,
          priceNano,
          satelliteOriginalPrice: listing.originalPrice,
          requiresStarsTransferFee,
          status: "pending"
        }
      });
    });

    try {
      const result = await this.satellite.buyGift({
        market: listing.market,
        slug: listing.slug,
        originalPrice: listing.originalPrice,
        giftId: listing.giftId,
        collectionName: listing.collectionName
      });
      if (!result.isBought) throw new Error("Gift Satellite did not confirm purchase");

      if (requiresStarsTransferFee) {
        await this.stars.stubChargeTelegramTransferFee(buyerUserId, purchase.id);
      }

      const status = MARKETS_WITH_SATELLITE_DELIVERY.includes(listing.market) ? "bought" : "delivered";
      return this.prisma.purchase.update({ where: { id: purchase.id }, data: { status } });
    } catch (error) {
      await this.refundFailedPurchase(purchase.id, buyerUserId, priceNano, error);
      throw error;
    }
  }

  private async refundFailedPurchase(purchaseId: string, buyerUserId: string, priceNano: bigint, error: unknown) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: buyerUserId }, data: { tonBalanceNano: { increment: priceNano } } });
      await tx.walletLedgerEntry.create({
        data: { userId: buyerUserId, type: "refund", amountNano: priceNano, status: "confirmed", metadata: { purchaseId } }
      });
      await tx.purchase.update({
        where: { id: purchaseId },
        data: { status: "refunded", errorMessage: error instanceof Error ? error.message : "Unknown purchase error" }
      });
    });
  }
}

