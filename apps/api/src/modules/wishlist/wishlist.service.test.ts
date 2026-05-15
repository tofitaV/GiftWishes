import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { WishlistService } from "./wishlist.service.js";

function prismaStub() {
  return {
    user: {
      findUnique: vi.fn(async () => ({
        id: "user-id",
        username: "alice",
        firstName: "Alice",
        wishlistItems: []
      })),
      findUniqueOrThrow: vi.fn(async () => ({ id: "user-id", purchasedWishlistSlots: 0 }))
    },
    wishlistItem: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }) => ({ id: "item-id", ...data })),
      findMany: vi.fn(async () => [])
    }
  };
}

function wishlistService({
  prisma = prismaStub(),
  seeTgGifts = { findFirstGift: vi.fn(async () => null) },
  telegramAuthDataStore = { get: vi.fn(() => null) },
  giftSatellite = { searchMarket: vi.fn(async () => []) },
  telegramNftLookup = { findFirstGift: vi.fn(async () => null) }
} = {}) {
  return {
    prisma,
    seeTgGifts,
    telegramAuthDataStore,
    giftSatellite,
    telegramNftLookup,
    service: new WishlistService(prisma as never, seeTgGifts as never, telegramAuthDataStore as never, giftSatellite as never, telegramNftLookup as never)
  };
}

describe("WishlistService.create", () => {
  it("resolves a source link but keeps the manually selected backdrop", async () => {
    const { prisma, seeTgGifts, service } = wishlistService({
      seeTgGifts: { findFirstGift: vi.fn(async () => ({ sourceUrl: "https://t.me/nft/PlushPepe-123", backdropName: "Sapphire" })) }
    });

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
        backdropName: "Black",
        symbolName: null,
        sourceUrl: "https://t.me/nft/PlushPepe-123"
      }
    });
  });

  it("keeps an explicit source link instead of resolving a replacement", async () => {
    const { prisma, seeTgGifts, giftSatellite, service } = wishlistService({
      seeTgGifts: { findFirstGift: vi.fn(async () => ({ sourceUrl: "https://t.me/nft/PlushPepe-999", backdropName: "Sapphire" })) }
    });

    await service.create("user-id", {
      collectionName: "Plush Pepe",
      modelName: "Raphael",
      sourceUrl: "https://t.me/nft/PlushPepe-123",
      telegramAuthData: "query_id=abc&hash=def"
    });

    expect(seeTgGifts.findFirstGift).not.toHaveBeenCalled();
    expect(giftSatellite.searchMarket).not.toHaveBeenCalled();
    expect(prisma.wishlistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceUrl: "https://t.me/nft/PlushPepe-123" })
      })
    );
  });

  it("uses stored Telegram auth data when the wishlist request has no auth header", async () => {
    const { seeTgGifts, telegramAuthDataStore, service } = wishlistService({
      seeTgGifts: { findFirstGift: vi.fn(async () => ({ sourceUrl: "https://t.me/nft/PlushPepe-123", backdropName: "Black" })) },
      telegramAuthDataStore: { get: vi.fn(() => "query_id=stored&hash=stored") }
    });

    await service.create("user-id", {
      collectionName: "Plush Pepe",
      modelName: "Raphael",
      backdropName: "Black"
    });

    expect(telegramAuthDataStore.get).toHaveBeenCalledWith("user-id");
    expect(seeTgGifts.findFirstGift).toHaveBeenCalledWith({
      collectionName: "Plush Pepe",
      modelName: "Raphael",
      backdropName: "Black",
      telegramAuthData: "query_id=stored&hash=stored"
    });
  });

  it("falls back to Gift Satellite when see.tg does not resolve a gift", async () => {
    const { prisma, seeTgGifts, giftSatellite, service } = wishlistService({
      seeTgGifts: { findFirstGift: vi.fn(async () => null) },
      giftSatellite: {
        searchMarket: vi.fn(async () => [
          {
            market: "telegram",
            collectionName: "Artisan Brick",
            modelName: "Watermelon",
            backdropName: "Black",
            symbolName: "Aztec Falcon",
            slug: "ArtisanBrick-1164",
            giftId: "ArtisanBrick-1164",
            normalizedPrice: 1000,
            originalPrice: "1000000000000",
            currency: "ton",
            link: "https://t.me/nft/ArtisanBrick-1164"
          }
        ])
      }
    });

    await service.create("user-id", {
      collectionName: "Artisan Brick",
      modelName: "Watermelon",
      backdropName: "Black",
      telegramAuthData: "query_id=abc&hash=def"
    });

    expect(seeTgGifts.findFirstGift).toHaveBeenCalled();
    expect(giftSatellite.searchMarket).toHaveBeenCalledWith("telegram", "Artisan Brick", { modelName: "Watermelon", backdropName: "Black" });
    expect(prisma.wishlistItem.create).toHaveBeenCalledWith({
      data: {
        ownerUserId: "user-id",
        collectionName: "Artisan Brick",
        modelName: "Watermelon",
        backdropName: "Black",
        symbolName: null,
        sourceUrl: "https://t.me/nft/ArtisanBrick-1164"
      }
    });
  });

  it("keeps the manually selected backdrop when falling back to any Gift Satellite listing", async () => {
    const { prisma, giftSatellite, service } = wishlistService({
      seeTgGifts: { findFirstGift: vi.fn(async () => null) },
      giftSatellite: {
        searchMarket: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              market: "telegram",
              collectionName: "Crystal Ball",
              modelName: "Poor Kitty",
              backdropName: "Pistachio",
              symbolName: "Garden Pot",
              slug: "CrystalBall-21716",
              giftId: "CrystalBall-21716",
              normalizedPrice: 32.55,
              originalPrice: "32550000000",
              currency: "ton",
              link: "https://t.me/nft/CrystalBall-21716"
            }
          ])
      }
    });

    await service.create("user-id", {
      collectionName: "Crystal Ball",
      modelName: "Poor Kitty",
      backdropName: "Amber",
      telegramAuthData: "query_id=abc&hash=def"
    });

    expect(giftSatellite.searchMarket).toHaveBeenNthCalledWith(1, "telegram", "Crystal Ball", { modelName: "Poor Kitty", backdropName: "Amber" });
    expect(giftSatellite.searchMarket).toHaveBeenNthCalledWith(2, "telegram", "Crystal Ball", { modelName: "Poor Kitty", backdropName: null });
    expect(prisma.wishlistItem.create).toHaveBeenCalledWith({
      data: {
        ownerUserId: "user-id",
        collectionName: "Crystal Ball",
        modelName: "Poor Kitty",
        backdropName: "Amber",
        symbolName: null,
        sourceUrl: "https://t.me/nft/CrystalBall-21716"
      }
    });
  });

  it("keeps the manually selected backdrop when direct Telegram NFT lookup returns a different backdrop", async () => {
    const { prisma, telegramNftLookup, service } = wishlistService({
      seeTgGifts: { findFirstGift: vi.fn(async () => null) },
      giftSatellite: { searchMarket: vi.fn(async () => []) },
      telegramNftLookup: { findFirstGift: vi.fn(async () => ({ sourceUrl: "https://t.me/nft/PlushPepe-57", backdropName: "Neon Blue" })) }
    });

    await service.create("user-id", {
      collectionName: "Plush Pepe",
      modelName: "Raphael",
      backdropName: "Black",
      telegramAuthData: "query_id=abc&hash=def"
    });

    expect(telegramNftLookup.findFirstGift).toHaveBeenCalledWith({ collectionName: "Plush Pepe", modelName: "Raphael", backdropName: "Black" });
    expect(prisma.wishlistItem.create).toHaveBeenCalledWith({
      data: {
        ownerUserId: "user-id",
        collectionName: "Plush Pepe",
        modelName: "Raphael",
        backdropName: "Black",
        symbolName: null,
        sourceUrl: "https://t.me/nft/PlushPepe-57"
      }
    });
  });

  it("does not call see.tg when the user has no free wishlist slot", async () => {
    const prisma = prismaStub();
    prisma.wishlistItem.count.mockResolvedValueOnce(1);
    const { seeTgGifts, giftSatellite, service } = wishlistService({
      prisma,
      seeTgGifts: { findFirstGift: vi.fn(async () => ({ sourceUrl: "https://t.me/nft/PlushPepe-123", backdropName: "Sapphire" })) }
    });

    await expect(
      service.create("user-id", {
        collectionName: "Plush Pepe",
        modelName: "Raphael",
        telegramAuthData: "query_id=abc&hash=def"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(seeTgGifts.findFirstGift).not.toHaveBeenCalled();
    expect(giftSatellite.searchMarket).not.toHaveBeenCalled();
  });

  it("uses the resolved backdrop when the user did not select one", async () => {
    const { prisma, seeTgGifts, service } = wishlistService({
      seeTgGifts: { findFirstGift: vi.fn(async () => ({ sourceUrl: "https://t.me/nft/PlushPepe-123", backdropName: "Sapphire" })) }
    });

    await service.create("user-id", {
      collectionName: "Plush Pepe",
      modelName: "Raphael",
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
});

describe("WishlistService reads", () => {
  it("returns own wishlist gifts oldest first so new gifts appear at the end", async () => {
    const { prisma, service } = wishlistService();

    await service.getMine("user-id");

    expect(prisma.wishlistItem.findMany).toHaveBeenCalledWith({
      where: { ownerUserId: "user-id" },
      orderBy: { createdAt: "asc" }
    });
  });

  it("returns public wishlist gifts oldest first so new gifts appear at the end", async () => {
    const { prisma, service } = wishlistService();

    await service.getPublic("user-id");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-id" },
      include: { wishlistItems: { orderBy: { createdAt: "asc" } } }
    });
  });
});
