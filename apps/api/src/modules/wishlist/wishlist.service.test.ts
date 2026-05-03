import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { WishlistService } from "./wishlist.service.js";

function prismaStub() {
  return {
    user: {
      findUniqueOrThrow: vi.fn(async () => ({ id: "user-id", purchasedWishlistSlots: 0 }))
    },
    wishlistItem: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }) => ({ id: "item-id", ...data }))
    }
  };
}

describe("WishlistService.create", () => {
  it("resolves and stores a source link for a manually added gift", async () => {
    const prisma = prismaStub();
    const seeTgGifts = {
      findFirstGift: vi.fn(async () => ({ sourceUrl: "https://t.me/nft/PlushPepe-123", backdropName: "Sapphire" }))
    };
    const service = new WishlistService(prisma as never, seeTgGifts as never);

    await service.create("user-id", {
      collectionName: "Plush Pepe",
      modelName: "Raphael",
      backdropName: "Black",
      telegramAuthData: "query_id=abc&hash=def"
    });

    expect(seeTgGifts.findFirstGift).toHaveBeenCalledWith({
      collectionName: "Plush Pepe",
      modelName: "Raphael",
      backdropName: "Black",
      telegramAuthData: "query_id=abc&hash=def"
    });
    expect(prisma.wishlistItem.create).toHaveBeenCalledWith({
      data: {
        ownerUserId: "user-id",
        collectionName: "Plush Pepe",
        modelName: "Raphael",
        backdropName: "Sapphire",
        symbolName: null,
        sourceUrl: "https://t.me/nft/PlushPepe-123"
      }
    });
  });

  it("keeps an explicit source link instead of resolving a replacement", async () => {
    const prisma = prismaStub();
    const seeTgGifts = {
      findFirstGift: vi.fn(async () => ({ sourceUrl: "https://t.me/nft/PlushPepe-999", backdropName: "Sapphire" }))
    };
    const service = new WishlistService(prisma as never, seeTgGifts as never);

    await service.create("user-id", {
      collectionName: "Plush Pepe",
      modelName: "Raphael",
      sourceUrl: "https://t.me/nft/PlushPepe-123",
      telegramAuthData: "query_id=abc&hash=def"
    });

    expect(seeTgGifts.findFirstGift).not.toHaveBeenCalled();
    expect(prisma.wishlistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceUrl: "https://t.me/nft/PlushPepe-123" })
      })
    );
  });

  it("does not call see.tg when the user has no free wishlist slot", async () => {
    const prisma = prismaStub();
    prisma.wishlistItem.count.mockResolvedValueOnce(1);
    const seeTgGifts = {
      findFirstGift: vi.fn(async () => ({ sourceUrl: "https://t.me/nft/PlushPepe-123", backdropName: "Sapphire" }))
    };
    const service = new WishlistService(prisma as never, seeTgGifts as never);

    await expect(
      service.create("user-id", {
        collectionName: "Plush Pepe",
        modelName: "Raphael",
        telegramAuthData: "query_id=abc&hash=def"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(seeTgGifts.findFirstGift).not.toHaveBeenCalled();
  });
});
