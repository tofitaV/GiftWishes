import { describe, expect, it } from "vitest";
import {
  createBotWishlistDeepLink,
  createInlineWishlistResult,
  createWishlistGiftLinksReplyMarkup,
  createWishlistProfileReplyMarkup,
  formatInlineWishlistMessage,
  formatInlineWishlistReply,
  formatOwnWishlistMessage,
  formatOwnWishlistReply,
  isOwnWishlistCommand,
  parseWishlistStartPayload
} from "./bot.service.js";

describe("formatInlineWishlistMessage", () => {
  it("formats wishlist items as a numbered chat message", () => {
    expect(
      formatInlineWishlistMessage({
        username: "alice",
        items: [
          {
            collectionName: "Big Year",
            modelName: "Cyberpunk",
            backdropName: "Cobalt Blue",
            symbolName: "Star"
          },
          {
            collectionName: "Trapped Heart",
            modelName: "Ruby",
            backdropName: null,
            symbolName: null
          }
        ]
      })
    ).toBe("Wishlist @alice\n\n1. 🎁 Big Year - Cyberpunk\n   Фон: Cobalt Blue\n   Узор: Star\n2. Trapped Heart - Ruby");
  });

  it("returns an empty wishlist message when there are no gifts", () => {
    expect(formatInlineWishlistMessage({ username: "alice", items: [] })).toBe("Wishlist @alice пока пуст");
  });

  it("links gift names in inline wishlist messages when gifts have source links", () => {
    expect(
      formatInlineWishlistMessage({
        username: "alice",
        items: [
          {
            collectionName: "Happy Brownie",
            modelName: "Solid Waste",
            backdropName: "Burgundy",
            symbolName: "Mafdet",
            sourceUrl: "https://t.me/nft/HappyBrownie-192207"
          }
        ]
      })
    ).toBe("Wishlist @alice\n\n1. 💩 Happy Brownie - Solid Waste\n   Фон: Burgundy\n   Узор: Mafdet");
  });

  it("uses explicit custom emoji and text link entities for inline wishlist messages", () => {
    expect(
      formatInlineWishlistReply({
        username: "alice",
        items: [
          {
            collectionName: "Happy Brownie",
            modelName: "Solid Waste",
            backdropName: "Burgundy",
            symbolName: "Mafdet",
            sourceUrl: "https://t.me/nft/HappyBrownie-192207"
          }
        ]
      })
    ).toEqual({
      text: "Wishlist @alice\n\n1. 💩 Happy Brownie - Solid Waste\n   Фон: Burgundy\n   Узор: Mafdet",
      entities: [
        {
          type: "custom_emoji",
          offset: 20,
          length: 2,
          custom_emoji_id: "6001558562357123088"
        },
        {
          type: "text_link",
          offset: 23,
          length: 27,
          url: "https://t.me/nft/HappyBrownie-192207"
        }
      ]
    });
  });

  it("uses a Mini App deep link button in inline results because Telegram rejects web_app buttons there", () => {
    const result = createInlineWishlistResult({
      wishlistLink: "https://t.me/giftwishes_bot?startapp=profile-user-id",
      message: { text: "Wishlist @alice", entities: [] },
      itemCount: 1
    });

    expect(result.reply_markup.inline_keyboard[0]?.[0]).toEqual({
      text: "Открыть wishlist",
      url: "https://t.me/giftwishes_bot?startapp=profile-user-id"
    });
    expect(result.input_message_content).toEqual({ message_text: "Wishlist @alice", entities: undefined });
    expect(JSON.stringify(result)).not.toContain("web_app");
  });

  it("builds a Telegram Mini App deep link for another user's wishlist", () => {
    expect(createBotWishlistDeepLink({ botUsername: "@giftwishes_bot", ownerUserId: "user-id" })).toBe("https://t.me/giftwishes_bot?startapp=profile-user-id");
  });

  it("builds a direct Telegram Mini App deep link when an app short name is configured", () => {
    expect(createBotWishlistDeepLink({ botUsername: "@giftwishes_bot", appShortName: "giftwishes", ownerUserId: "user-id" })).toBe(
      "https://t.me/giftwishes_bot/giftwishes?startapp=profile-user-id"
    );
  });

  it("parses wishlist start payloads", () => {
    expect(parseWishlistStartPayload("wishlist_user-id")).toBe("user-id");
    expect(parseWishlistStartPayload("anything_else")).toBeNull();
  });

  it("opens the selected user's profile as a bot web app from /start wishlist links", () => {
    expect(
      createWishlistProfileReplyMarkup({
        ownerUsername: "alice",
        webAppUrl: "https://tofitav.github.io/GiftWishes/?owner=user-id"
      })
    ).toEqual({
      inline_keyboard: [
        [
          {
            text: "Открыть профиль @alice / Купить гифт",
            web_app: { url: "https://tofitav.github.io/GiftWishes/?owner=user-id" }
          }
        ]
      ]
    });
  });
});

describe("formatOwnWishlistMessage", () => {
  it("links gift names in the sender's wishlist when gifts have source links", () => {
    expect(
      formatOwnWishlistMessage({
        items: [
          {
            collectionName: "Victory Medal",
            modelName: "Bronze",
            backdropName: "Steel Grey",
            symbolName: "Shield",
            sourceUrl: "https://t.me/nft/VictoryMedal-33886"
          }
        ]
      })
    ).toBe("Твой wishlist\n\n1. 🏅 Victory Medal - Bronze\n   Фон: Steel Grey\n   Узор: Shield");
  });

  it("returns an empty message when the sender has no gifts", () => {
    expect(formatOwnWishlistMessage({ items: [] })).toBe("Твой wishlist пока пуст");
  });
  it("adds the model custom emoji before gift names when it is known", () => {
    expect(
      formatOwnWishlistMessage({
        items: [
          {
            collectionName: "Plush Pepe",
            modelName: "Raphael",
            backdropName: "Black",
            symbolName: null,
            sourceUrl: "https://t.me/nft/PlushPepe-123"
          }
        ]
      })
    ).toBe("\u0422\u0432\u043E\u0439 wishlist\n\n1. \uD83C\uDF81 Plush Pepe - Raphael\n   \u0424\u043E\u043D: Black");
  });

  it("uses explicit custom emoji entities instead of HTML tags for the sender's wishlist", () => {
    expect(
      formatOwnWishlistReply({
        items: [
          {
            collectionName: "Plush Pepe",
            modelName: "Raphael",
            backdropName: "Black",
            symbolName: null,
            sourceUrl: "https://t.me/nft/PlushPepe-123"
          }
        ]
      })
    ).toEqual({
      text: "Твой wishlist\n\n1. 🎁 Plush Pepe - Raphael\n   Фон: Black",
      entities: [
        {
          type: "custom_emoji",
          offset: 18,
          length: 2,
          custom_emoji_id: "5456658853242365136"
        },
        {
          type: "text_link",
          offset: 21,
          length: 20,
          url: "https://t.me/nft/PlushPepe-123"
        }
      ]
    });
  });
});

describe("createWishlistGiftLinksReplyMarkup", () => {
  it("creates one open button per gift that has a source link", () => {
    expect(
      createWishlistGiftLinksReplyMarkup({
        items: [
          {
            collectionName: "Victory Medal",
            modelName: "Bronze",
            sourceUrl: "https://t.me/nft/VictoryMedal-33886"
          },
          {
            collectionName: "Crystal Ball",
            modelName: "Incubus",
            sourceUrl: null
          }
        ]
      })
    ).toEqual({
      inline_keyboard: [[{ text: "Открыть 1. Victory Medal - Bronze", url: "https://t.me/nft/VictoryMedal-33886" }]]
    });
  });
});

describe("isOwnWishlistCommand", () => {
  it("accepts slash commands and plain Russian text for showing the sender's wishlist", () => {
    expect(isOwnWishlistCommand("/wishlist")).toBe(true);
    expect(isOwnWishlistCommand("/list@giftwishes_bot")).toBe(true);
    expect(isOwnWishlistCommand("показать список")).toBe(true);
    expect(isOwnWishlistCommand("список")).toBe(true);
  });

  it("rejects unrelated messages", () => {
    expect(isOwnWishlistCommand("https://t.me/nft/VictoryMedal-33886")).toBe(false);
    expect(isOwnWishlistCommand("/start")).toBe(false);
  });
});
