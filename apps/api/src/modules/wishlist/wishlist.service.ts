import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FREE_WISHLIST_SLOTS } from "@gift-wishes/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { SeeTgGiftsService } from "./see-tg-gifts.service.js";

type CreateWishlistItemInput = {
  collectionName: string;
  modelName: string;
  backdropName?: string;
  symbolName?: string;
  sourceUrl?: string;
  telegramAuthData?: string;
};

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seeTgGifts: SeeTgGiftsService
  ) {}

  async getMine(userId: string) {
    const [user, items] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.wishlistItem.findMany({ where: { ownerUserId: userId }, orderBy: { createdAt: "desc" } })
    ]);

    return {
      limit: FREE_WISHLIST_SLOTS + user.purchasedWishlistSlots,
      items
    };
  }

  async getPublic(userId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wishlistItems: { orderBy: { createdAt: "desc" } } }
    });
    if (!owner || !owner.username) throw new NotFoundException("Wishlist owner not found");

    return {
      owner: { id: owner.id, username: owner.username, firstName: owner.firstName },
      items: owner.wishlistItems
    };
  }

  async create(userId: string, input: CreateWishlistItemInput) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const usedSlots = await this.prisma.wishlistItem.count({ where: { ownerUserId: userId } });
    const allowedSlots = FREE_WISHLIST_SLOTS + user.purchasedWishlistSlots;

    if (usedSlots >= allowedSlots) {
      throw new BadRequestException("Wishlist slot limit reached. Buy an extra slot for 50 Telegram Stars.");
    }

    const sourceUrl =
      input.sourceUrl ||
      (await this.seeTgGifts.findFirstGiftUrl({
        collectionName: input.collectionName,
        modelName: input.modelName,
        backdropName: input.backdropName,
        telegramAuthData: input.telegramAuthData
      }));

    return this.prisma.wishlistItem.create({
      data: {
        ownerUserId: userId,
        collectionName: input.collectionName,
        modelName: input.modelName,
        backdropName: input.backdropName || null,
        symbolName: input.symbolName || null,
        sourceUrl: sourceUrl || null
      }
    });
  }

  async remove(userId: string, id: string) {
    const item = await this.prisma.wishlistItem.findFirst({ where: { id, ownerUserId: userId } });
    if (!item) throw new NotFoundException("Wishlist item not found");
    await this.prisma.wishlistItem.delete({ where: { id } });
    return { ok: true };
  }
}
