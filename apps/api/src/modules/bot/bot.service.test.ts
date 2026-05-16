import { describe, expect, it } from "vitest";
import {
  createBotWishlistDeepLink,
  createInlineAddGiftResult,
  createInlineDeleteGiftResult,
  createInlineGiftLinkResult,
  createInlineUserWishlistResult,
  createInlineHelpResult,
  createInlineWishlistResult,
  createWishlistGiftLinksReplyMarkup,
  createWishlistProfileReplyMarkup,
  editChosenInlineUserWishlistResult,
  editChosenInlineWishlistResult,
  formatInlineWishlistMessage,
  formatInlineWishlistReply,
  formatHelpMessage,
  formatOwnWishlistMessage,
  formatOwnWishlistReply,
  isHelpCommand,
  isOwnWishlistCommand,
  parseWishlistItemRemovalCommand,
  parseWishlistItemNumberQuery,
  parseInlineUsernameQuery,
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
    ).toBe("Wishlist @alice\n\n1. 🎁 Big Year - Cyberpunk 🎁 Cobalt Blue\n2. Trapped Heart - Ruby");
  });

  it("returns an empty wishlist message when there are no gifts", () => {
    expect(formatInlineWishlistMessage({ username: "alice", items: [] })).toBe("Wishlist @alice is empty");
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
    ).toBe("Wishlist @alice\n\n1. 💩 Happy Brownie - Solid Waste 🎁 Burgundy");
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
      text: "Wishlist @alice\n\n1. 💩 Happy Brownie - Solid Waste 🎁 Burgundy",
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
        },
        {
          type: "custom_emoji",
          offset: 51,
          length: 2,
          custom_emoji_id: "5352758474751119520"
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
      text: "Open wishlist",
      url: "https://t.me/giftwishes_bot?startapp=profile-user-id"
    });
    expect(result.thumbnail_url).toBe("https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f381.png");
    expect(result.input_message_content).toEqual({
      message_text: "Wishlist @alice",
      entities: undefined,
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true
    });
    expect(JSON.stringify(result)).not.toContain("web_app");
  });

  it("parses inline username queries for showing another user's wishlist", () => {
    expect(parseInlineUsernameQuery("@holdkaspa")).toBe("holdkaspa");
    expect(parseInlineUsernameQuery(" @HoldKaspa ")).toBe("HoldKaspa");
    expect(parseInlineUsernameQuery("holdkaspa")).toBeNull();
    expect(parseInlineUsernameQuery("@giftwishes_bot")).toBeNull();
    expect(parseInlineUsernameQuery("@bad-user")).toBeNull();
  });

  it("creates an inline result for another user's wishlist", () => {
    const result = createInlineUserWishlistResult({
      username: "holdkaspa",
      wishlistLink: "https://t.me/giftwishes_bot?startapp=profile-user-id",
      message: {
        text: "Wishlist @holdkaspa\n\n1. Diamond Ring - Twilight Electric Indigo",
        entities: []
      },
      itemCount: 1
    });

    expect(result).toEqual({
      type: "article",
      id: "wishlist_user_holdkaspa",
      title: "Show @holdkaspa's wishlist",
      description: "1 gift in wishlist",
      thumbnail_url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f381.png",
      input_message_content: {
        message_text: "Wishlist @holdkaspa\n\n1. Diamond Ring - Twilight Electric Indigo",
        entities: undefined,
        link_preview_options: { is_disabled: true },
        disable_web_page_preview: true
      },
      reply_markup: {
        inline_keyboard: [[{ text: "Open @holdkaspa's wishlist", url: "https://t.me/giftwishes_bot?startapp=profile-user-id" }]]
      }
    });
  });

  it("edits a chosen inline wishlist result with explicit custom emoji entities", async () => {
    const editCalls: unknown[] = [];

    const edited = await editChosenInlineWishlistResult({
      chosenInlineResult: {
        result_id: "wishlist",
        from: { id: 123 },
        inline_message_id: "inline-message-id"
      },
      findUserByTelegramId: async (telegramId) => {
        expect(telegramId).toBe("123");
        return {
          id: "user-id",
          username: "alice",
          wishlistItems: [
            {
              collectionName: "Happy Brownie",
              modelName: "Solid Waste",
              backdropName: "Burgundy",
              symbolName: "Mafdet",
              sourceUrl: "https://t.me/nft/HappyBrownie-192207"
            }
          ]
        };
      },
      createWishlistLink: (userId) => `https://t.me/giftwishes_bot?startapp=profile-${userId}`,
      editMessageText: async (...args) => {
        editCalls.push(args);
      }
    });

    expect(edited).toBe(true);
    expect(editCalls).toEqual([
      [
        "Wishlist @alice\n\n1. 💩 Happy Brownie - Solid Waste 🎁 Burgundy",
        {
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
            },
            {
              type: "custom_emoji",
              offset: 51,
              length: 2,
              custom_emoji_id: "5352758474751119520"
            }
          ],
          link_preview_options: { is_disabled: true },
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[{ text: "Open wishlist", url: "https://t.me/giftwishes_bot?startapp=profile-user-id" }]]
          }
        }
      ]
    ]);
  });

  it("edits a chosen inline user wishlist result with explicit custom emoji entities", async () => {
    const editCalls: unknown[] = [];

    const edited = await editChosenInlineUserWishlistResult({
      chosenInlineResult: {
        result_id: "wishlist_user_alice",
        query: "@alice",
        from: { id: 123 },
        inline_message_id: "inline-message-id"
      },
      findUserByUsername: async (username) => {
        expect(username).toBe("alice");
        return {
          id: "user-id",
          username: "alice",
          wishlistItems: [
            {
              collectionName: "Happy Brownie",
              modelName: "Solid Waste",
              backdropName: "Burgundy",
              symbolName: "Mafdet",
              sourceUrl: "https://t.me/nft/HappyBrownie-192207"
            }
          ]
        };
      },
      createWishlistLink: (userId) => `https://t.me/giftwishes_bot?startapp=profile-${userId}`,
      editMessageText: async (...args) => {
        editCalls.push(args);
      }
    });

    expect(edited).toBe(true);
    expect(editCalls).toEqual([
      [
        "Wishlist @alice\n\n1. 💩 Happy Brownie - Solid Waste 🎁 Burgundy",
        {
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
            },
            {
              type: "custom_emoji",
              offset: 51,
              length: 2,
              custom_emoji_id: "5352758474751119520"
            }
          ],
          link_preview_options: { is_disabled: true },
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[{ text: "Open @alice's wishlist", url: "https://t.me/giftwishes_bot?startapp=profile-user-id" }]]
          }
        }
      ]
    ]);
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
            text: "Open @alice's profile / Buy gift",
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
    ).toBe("Your wishlist\n\n1. 🏅 Victory Medal - Bronze 🎁 Steel Grey");
  });

  it("returns an empty message when the sender has no gifts", () => {
    expect(formatOwnWishlistMessage({ items: [] })).toBe("Your wishlist is empty");
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
    ).toBe("Your wishlist\n\n1. \uD83C\uDF81 Plush Pepe - Raphael \uD83C\uDF81 Black");
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
      text: "Your wishlist\n\n1. 🎁 Plush Pepe - Raphael 🎁 Black",
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
        },
        {
          type: "custom_emoji",
          offset: 42,
          length: 2,
          custom_emoji_id: "5350385797377855605"
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
      inline_keyboard: [[{ text: "Open 1. Victory Medal - Bronze", url: "https://t.me/nft/VictoryMedal-33886" }]]
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

describe("help command", () => {
  it("accepts Russian and slash help commands", () => {
    expect(isHelpCommand("Помощь")).toBe(true);
    expect(isHelpCommand("помощь")).toBe(true);
    expect(isHelpCommand("/help")).toBe(true);
    expect(isHelpCommand("/help@giftwishes_bot")).toBe(true);
  });

  it("formats help in English by default", () => {
    const message = formatHelpMessage("en");

    expect(message).toContain("How to use");
    expect(message).toContain("/wishlist");
    expect(message).toContain("How to delete a gift");
  });

  it("formats inline actions in Ukrainian when requested", () => {
    const result = createInlineWishlistResult({
      wishlistLink: "https://t.me/giftwishes_bot?startapp=profile-user-id",
      message: { text: "Wishlist @alice", entities: [] },
      itemCount: 1,
      language: "uk"
    });

    expect(result.title).toBe("Показати мій wishlist");
    expect(result.reply_markup.inline_keyboard[0]?.[0]?.text).toBe("Відкрити wishlist");
  });

  it("explains what the bot is and how to use wishlist features", () => {
    const message = formatHelpMessage();

    expect(message).toContain("Gift Wishes");
    expect(message).toContain("How to use");
    expect(message).toContain("How to add a gift");
    expect(message).toContain("How to show gifts in chat");
    expect(message).toContain("/wishlist");
    expect(message).toContain("Show my wishlist");
    expect(message).toContain("Delete gift #1");
  });

  it("creates an inline help result with a question thumbnail", () => {
    expect(createInlineHelpResult()).toEqual({
      type: "article",
      id: "help",
      title: "Help",
      description: "How to use Gift Wishes",
      thumbnail_url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2753.png",
      input_message_content: {
        message_text: formatHelpMessage(),
        link_preview_options: { is_disabled: true },
        disable_web_page_preview: true
      }
    });
  });
});

describe("inline gift add", () => {
  it("creates an inline result for adding a Telegram NFT gift to wishlist", () => {
    expect(
      createInlineAddGiftResult({
        wishlistLink: "https://t.me/giftwishes_bot?startapp=profile-user-id",
        sourceUrl: "https://t.me/nft/LunarSnake-141449"
      })
    ).toEqual({
      type: "article",
      id: "add_nft",
      title: "Add gift to wishlist",
      description: "https://t.me/nft/LunarSnake-141449",
      thumbnail_url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2795.png",
      input_message_content: {
        message_text: "Adding gift to wishlist...",
        link_preview_options: { is_disabled: true },
        disable_web_page_preview: true
      },
      reply_markup: {
        inline_keyboard: [[{ text: "Open wishlist", url: "https://t.me/giftwishes_bot?startapp=profile-user-id" }]]
      }
    });
  });
});

describe("inline gift delete", () => {
  it("creates an inline result for deleting a wishlist gift by source link", () => {
    expect(
      createInlineDeleteGiftResult({
        sourceUrl: "https://t.me/nft/LunarSnake-141449",
        wishlistLink: "https://t.me/giftwishes_bot?startapp=profile-user-id"
      })
    ).toEqual({
      type: "article",
      id: "delete_gift",
      title: "Delete gift from wishlist",
      description: "https://t.me/nft/LunarSnake-141449",
      thumbnail_url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2796.png",
      input_message_content: {
        message_text: "Removing gift from your wishlist...",
        link_preview_options: { is_disabled: true },
        disable_web_page_preview: true
      },
      reply_markup: {
        inline_keyboard: [[{ text: "Open wishlist", url: "https://t.me/giftwishes_bot?startapp=profile-user-id" }]]
      }
    });
  });

  it("creates an inline result for deleting a wishlist gift by number with its own result id", () => {
    expect(
      createInlineDeleteGiftResult({
        itemNumber: 2,
        wishlistLink: "https://t.me/giftwishes_bot?startapp=profile-user-id",
        language: "en"
      })
    ).toMatchObject({
      type: "article",
      id: "delete_gift_2",
      title: "Delete gift #2",
      description: "Remove gift #2 from your wishlist",
      thumbnail_url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2796.png",
      input_message_content: {
        message_text: "Removing gift #2 from your wishlist..."
      }
    });
  });
});

describe("inline gift link", () => {
  it("parses numeric inline queries in the 1..100 range", () => {
    expect(parseWishlistItemNumberQuery("1")).toBe(1);
    expect(parseWishlistItemNumberQuery("100")).toBe(100);
    expect(parseWishlistItemNumberQuery("0")).toBeNull();
    expect(parseWishlistItemNumberQuery("101")).toBeNull();
    expect(parseWishlistItemNumberQuery("1 gift")).toBeNull();
  });

  it("creates an inline result that sends only the gift link", () => {
    expect(
      createInlineGiftLinkResult({
        itemNumber: 1,
        sourceUrl: "https://t.me/nft/LunarSnake-141449",
        wishlistLink: "https://t.me/giftwishes_bot?startapp=profile-user-id"
      })
    ).toEqual({
      type: "article",
      id: "gift_link_1",
      title: "Send gift #1",
      description: "https://t.me/nft/LunarSnake-141449",
      thumbnail_url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f517.png",
      input_message_content: {
        message_text: "https://t.me/nft/LunarSnake-141449"
      },
      reply_markup: {
        inline_keyboard: [[{ text: "Open wishlist", url: "https://t.me/giftwishes_bot?startapp=profile-user-id" }]]
      }
    });
  });
});

describe("parseWishlistItemRemovalCommand", () => {
  it("parses remove commands by wishlist item number", () => {
    expect(parseWishlistItemRemovalCommand("удалить 2")).toBe(2);
    expect(parseWishlistItemRemovalCommand("delete 2")).toBe(2);
    expect(parseWishlistItemRemovalCommand("remove 2")).toBe(2);
    expect(parseWishlistItemRemovalCommand("/remove 3")).toBe(3);
    expect(parseWishlistItemRemovalCommand("/delete@giftwishes_bot 4")).toBe(4);
  });

  it("rejects invalid remove commands", () => {
    expect(parseWishlistItemRemovalCommand("удалить 0")).toBeNull();
    expect(parseWishlistItemRemovalCommand("удалить abc")).toBeNull();
    expect(parseWishlistItemRemovalCommand("список")).toBeNull();
  });
});
