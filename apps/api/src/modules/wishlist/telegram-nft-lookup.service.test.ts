import { describe, expect, it, vi } from "vitest";
import { TelegramNftLookupService } from "./telegram-nft-lookup.service.js";

function config(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key]
  };
}

function htmlResponse(description: string) {
  return {
    ok: true,
    text: async () => `<meta property="og:description" content="${description}">`
  } as Response;
}

describe("TelegramNftLookupService", () => {
  it("checks known exact candidates before the numeric scan limit", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("DiamondRing-6921")) return htmlResponse("Model: Twilight\nBackdrop: Electric Indigo");
      return { ok: false, text: async () => "" } as Response;
    });
    const service = new TelegramNftLookupService(config({ TELEGRAM_NFT_LOOKUP_LIMIT: "3", TELEGRAM_NFT_LOOKUP_CONCURRENCY: "1" }) as never, fetcher);

    await expect(service.findFirstGift({ collectionName: "Diamond Ring", modelName: "Twilight", backdropName: "Electric Indigo" })).resolves.toEqual({
      sourceUrl: "https://t.me/nft/DiamondRing-6921",
      backdropName: "Electric Indigo"
    });
  });

  it("matches the Electro Indigo spelling to Telegram's Electric Indigo backdrop", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("DiamondRing-6921")) return htmlResponse("Model: Twilight\nBackdrop: Electric Indigo");
      return { ok: false, text: async () => "" } as Response;
    });
    const service = new TelegramNftLookupService(config({ TELEGRAM_NFT_LOOKUP_LIMIT: "3", TELEGRAM_NFT_LOOKUP_CONCURRENCY: "1" }) as never, fetcher);

    await expect(service.findFirstGift({ collectionName: "Diamond Ring", modelName: "Twilight", backdropName: "Electro Indigo" })).resolves.toEqual({
      sourceUrl: "https://t.me/nft/DiamondRing-6921",
      backdropName: "Electric Indigo"
    });
  });

  it("finds the first public Telegram NFT matching a model and backdrop", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("PlushPepe-1")) return htmlResponse("Model: Steel Frog\nBackdrop: Jade Green");
      if (url.endsWith("PlushPepe-2")) return htmlResponse("Model: Raphael\nBackdrop: Neon Blue");
      if (url.endsWith("PlushPepe-3")) return htmlResponse("Model: Raphael\nBackdrop: Black");
      return { ok: false, text: async () => "" } as Response;
    });
    const service = new TelegramNftLookupService(config({ TELEGRAM_NFT_LOOKUP_LIMIT: "3", TELEGRAM_NFT_LOOKUP_CONCURRENCY: "1" }) as never, fetcher);

    await expect(service.findFirstGift({ collectionName: "Plush Pepe", modelName: "Raphael", backdropName: "Black" })).resolves.toEqual({
      sourceUrl: "https://t.me/nft/PlushPepe-3",
      backdropName: "Black"
    });
  });

  it("falls back to the first model match when the requested backdrop is missing", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("PlushPepe-2")) return htmlResponse("Model: Raphael\nBackdrop: Neon Blue");
      return { ok: false, text: async () => "" } as Response;
    });
    const service = new TelegramNftLookupService(config({ TELEGRAM_NFT_LOOKUP_LIMIT: "3", TELEGRAM_NFT_LOOKUP_CONCURRENCY: "1" }) as never, fetcher);

    await expect(service.findFirstGift({ collectionName: "Plush Pepe", modelName: "Raphael", backdropName: "Black" })).resolves.toEqual({
      sourceUrl: "https://t.me/nft/PlushPepe-2",
      backdropName: "Neon Blue"
    });
  });
});
