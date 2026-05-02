import { describe, expect, it } from "vitest";
import { addTelegramNftGiftFromMessage, extractTelegramNftUrl, parseTelegramNftGift } from "./telegram-nft.js";

const victoryMedalHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta property="og:title" content="Victory Medal #33886">
    <meta property="og:description" content="Model: Bronze
Backdrop: Steel Grey
Symbol: Shield
">
  </head>
</html>`;

describe("extractTelegramNftUrl", () => {
  it("extracts the first Telegram NFT link from a bot message", () => {
    expect(extractTelegramNftUrl("add https://t.me/nft/VictoryMedal-33886 please")).toBe("https://t.me/nft/VictoryMedal-33886");
  });

  it("ignores non NFT Telegram links", () => {
    expect(extractTelegramNftUrl("https://t.me/giftwishes_bot")).toBeNull();
  });
});

describe("parseTelegramNftGift", () => {
  it("parses collection, model, backdrop, and symbol from Telegram NFT metadata", () => {
    expect(parseTelegramNftGift(victoryMedalHtml, "https://t.me/nft/VictoryMedal-33886")).toEqual({
      collectionName: "Victory Medal",
      modelName: "Bronze",
      backdropName: "Steel Grey",
      symbolName: "Shield"
    });
  });

  it("falls back to the URL slug for the collection name", () => {
    expect(
      parseTelegramNftGift(
        `<meta property="og:description" content="Model: Bronze 3%\nBackdrop: Steel Grey 1.5%\nSymbol: Shield 0.7%">`,
        "https://t.me/nft/VictoryMedal-33886"
      )
    ).toEqual({
      collectionName: "Victory Medal",
      modelName: "Bronze",
      backdropName: "Steel Grey",
      symbolName: "Shield"
    });
  });
});

describe("addTelegramNftGiftFromMessage", () => {
  it("fetches a Telegram NFT page and creates a wishlist item from parsed metadata", async () => {
    const createdItems: unknown[] = [];

    const result = await addTelegramNftGiftFromMessage({
      text: "https://t.me/nft/VictoryMedal-33886",
      fetchHtml: async (url) => {
        expect(url).toBe("https://t.me/nft/VictoryMedal-33886");
        return victoryMedalHtml;
      },
      createWishlistItem: async (input) => {
        createdItems.push(input);
        return { id: "wishlist-item-id", ...input };
      }
    });

    expect(createdItems).toEqual([
      {
        collectionName: "Victory Medal",
        modelName: "Bronze",
        backdropName: "Steel Grey",
        symbolName: "Shield",
        sourceUrl: "https://t.me/nft/VictoryMedal-33886"
      }
    ]);
    expect(result).toEqual({
      id: "wishlist-item-id",
      collectionName: "Victory Medal",
      modelName: "Bronze",
      backdropName: "Steel Grey",
      symbolName: "Shield",
      sourceUrl: "https://t.me/nft/VictoryMedal-33886"
    });
  });

  it("does nothing when the message has no Telegram NFT link", async () => {
    const result = await addTelegramNftGiftFromMessage({
      text: "hello",
      fetchHtml: async () => {
        throw new Error("fetch should not be called");
      },
      createWishlistItem: async () => {
        throw new Error("create should not be called");
      }
    });

    expect(result).toBeNull();
  });
});
