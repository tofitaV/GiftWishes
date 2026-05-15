import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf } from "telegraf";
import { PrismaService } from "../prisma/prisma.service.js";
import { WishlistService } from "../wishlist/wishlist.service.js";
import { lookupGiftBackdropEmoji } from "./gift-backdrop-emojis.js";
import { lookupGiftModelEmoji } from "./gift-model-emojis.js";
import { addTelegramNftGiftFromMessage, extractTelegramNftUrl, type TelegramNftGift } from "./telegram-nft.js";

type InlineWishlistItem = {
  collectionName: string;
  modelName: string;
  backdropName: string | null;
  symbolName: string | null;
  sourceUrl?: string | null;
};

type TelegramMessageEntity =
  | {
      type: "custom_emoji";
      offset: number;
      length: number;
      custom_emoji_id: string;
    }
  | {
      type: "text_link";
      offset: number;
      length: number;
      url: string;
    };

type FormattedTelegramMessage = {
  text: string;
  entities: TelegramMessageEntity[];
};

type InlineWishlistResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  input_message_content: {
    message_text: string;
    entities?: TelegramMessageEntity[];
    link_preview_options: { is_disabled: true };
    disable_web_page_preview: true;
  };
  reply_markup: {
    inline_keyboard: [[{ text: string; url: string }]];
  };
};

type InlineAddGiftResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  input_message_content: {
    message_text: string;
    link_preview_options: { is_disabled: true };
    disable_web_page_preview: true;
  };
  reply_markup: {
    inline_keyboard: [[{ text: string; url: string }]];
  };
};

type InlineHelpResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  input_message_content: {
    message_text: string;
    link_preview_options: { is_disabled: true };
    disable_web_page_preview: true;
  };
};

type InlineDeleteGiftResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  input_message_content: {
    message_text: string;
    link_preview_options: { is_disabled: true };
    disable_web_page_preview: true;
  };
  reply_markup: {
    inline_keyboard: [[{ text: string; url: string }]];
  };
};

type WishlistProfileReplyMarkup = {
  inline_keyboard: [[{ text: string; web_app: { url: string } }]];
};

type WishlistGiftLinksReplyMarkup = {
  inline_keyboard: { text: string; url: string }[][];
};

type ChosenInlineWishlistResult = {
  result_id: string;
  from: { id: number };
  inline_message_id?: string;
};

const WISHLIST_START_PREFIX = "wishlist_";
const WISHLIST_PROFILE_START_PREFIX = "profile-";
const DEFAULT_BOT_USERNAME = "giftwishes_bot";
const INLINE_WISHLIST_RESULT_ID = "wishlist";
const INLINE_ADD_GIFT_RESULT_ID = "add_nft";
const INLINE_HELP_RESULT_ID = "help";
const INLINE_DELETE_GIFT_RESULT_ID = "delete_gift";
const INLINE_WISHLIST_THUMBNAIL_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f381.png";
const INLINE_ADD_THUMBNAIL_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2795.png";
const INLINE_DELETE_THUMBNAIL_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2796.png";
const INLINE_HELP_THUMBNAIL_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2753.png";

export function formatInlineWishlistMessage({ username, items }: { username: string | null; items: InlineWishlistItem[] }) {
  return formatInlineWishlistReply({ username, items }).text;
}

export function formatInlineWishlistReply({ username, items }: { username: string | null; items: InlineWishlistItem[] }): FormattedTelegramMessage {
  const displayName = username ? `@${username}` : "пользователя";
  return formatWishlistReply({
    header: `Wishlist ${displayName}`,
    emptyMessage: `Wishlist ${displayName} пока пуст`,
    items
  });
}

export function formatOwnWishlistMessage({ items }: { items: InlineWishlistItem[] }) {
  return formatOwnWishlistReply({ items }).text;
}

export function formatOwnWishlistReply({ items }: { items: InlineWishlistItem[] }): FormattedTelegramMessage {
  return formatWishlistReply({
    header: "Твой wishlist",
    emptyMessage: "Твой wishlist пока пуст",
    items
  });
}

function formatWishlistReply({ header, emptyMessage, items }: { header: string; emptyMessage: string; items: InlineWishlistItem[] }): FormattedTelegramMessage {
  const builder = createTelegramMessageBuilder();
  if (items.length === 0) {
    builder.append(emptyMessage);
    return builder.build();
  }

  builder.append(header);
  builder.append("\n\n");
  items.forEach((item, index) => {
    if (index > 0) builder.append("\n");

    builder.append(`${index + 1}. `);
    appendGiftTitle(builder, item);
  });

  return builder.build();
}

function appendGiftTitle(builder: TelegramMessageBuilder, item: Pick<InlineWishlistItem, "collectionName" | "modelName" | "backdropName" | "sourceUrl">) {
  const emoji = lookupGiftModelEmoji(item.collectionName, item.modelName);
  if (emoji) {
    const offset = builder.length;
    builder.append(emoji.fallback);
    builder.addEntity({
      type: "custom_emoji",
      offset,
      length: emoji.fallback.length,
      custom_emoji_id: emoji.emojiId
    });
    builder.append(" ");
  }

  const title = `${item.collectionName} - ${item.modelName}`;
  const offset = builder.length;
  builder.append(title);
  if (item.sourceUrl) {
    builder.addEntity({
      type: "text_link",
      offset,
      length: title.length,
      url: item.sourceUrl
    });
  }

  if (item.backdropName) {
    const backdropEmoji = lookupGiftBackdropEmoji(item.backdropName);
    builder.append(" ");

    if (backdropEmoji) {
      const backdropOffset = builder.length;
      builder.append(backdropEmoji.fallback);
      builder.addEntity({
        type: "custom_emoji",
        offset: backdropOffset,
        length: backdropEmoji.fallback.length,
        custom_emoji_id: backdropEmoji.emojiId
      });
      builder.append(" ");
    }

    builder.append(item.backdropName);
  }
}

type TelegramMessageBuilder = ReturnType<typeof createTelegramMessageBuilder>;

function createTelegramMessageBuilder() {
  let text = "";
  const entities: TelegramMessageEntity[] = [];
  return {
    get length() {
      return text.length;
    },
    append(value: string) {
      text += value;
    },
    addEntity(entity: TelegramMessageEntity) {
      entities.push(entity);
    },
    build(): FormattedTelegramMessage {
      return { text, entities };
    }
  };
}

function messageEntitiesOption(message: FormattedTelegramMessage) {
  return message.entities.length > 0 ? message.entities : undefined;
}

export function parseWishlistStartPayload(payload: string | undefined) {
  if (!payload?.startsWith(WISHLIST_START_PREFIX)) return null;

  const ownerUserId = payload.slice(WISHLIST_START_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(ownerUserId)) return null;
  return ownerUserId;
}

export function createBotWishlistDeepLink({ botUsername, appShortName, ownerUserId }: { botUsername: string; appShortName?: string; ownerUserId: string }) {
  const username = botUsername.replace(/^@/, "");
  const appPath = appShortName ? `/${appShortName.replace(/^\//, "")}` : "";
  return `https://t.me/${username}${appPath}?startapp=${WISHLIST_PROFILE_START_PREFIX}${ownerUserId}`;
}

export function isOwnWishlistCommand(text: string) {
  const normalized = text.trim().toLowerCase();
  return (
    /^\/(?:wishlist|list)(?:@\w+)?$/.test(normalized) ||
    normalized === "wishlist" ||
    normalized === "список" ||
    normalized === "показать список" ||
    normalized === "покажи список" ||
    normalized === "показать wishlist" ||
    normalized === "покажи wishlist"
  );
}

export function isHelpCommand(text: string) {
  const normalized = text.trim().toLowerCase();
  return /^\/help(?:@\w+)?$/.test(normalized) || normalized === "help" || normalized === "помощь";
}

export function parseWishlistItemRemovalCommand(text: string) {
  const normalized = text.trim().toLowerCase();
  const match = normalized.match(/^(?:(?:\/)?(?:remove|delete)(?:@\w+)?|удалить)\s+(\d+)$/);
  if (!match) return null;

  const itemNumber = Number(match[1]);
  return Number.isInteger(itemNumber) && itemNumber > 0 ? itemNumber : null;
}

export function formatHelpMessage() {
  return [
    "Gift Wishes — бот для хранения желаемых подарков.",
    "",
    "Как пользоваться:",
    "1. Открой Mini App из бота и собери свой список желаний.",
    "2. Другие пользователи смогут открыть твой профиль и подарить подарок(пока не реализовано).",
    "",
    "Как добавить подарок:",
    "Напиши в чате @giftwishes_bot и вставь ссылку на подарок. Выбери \"Добавить подарок в wishlist\".",
    "",
    "Как показать подарки в чате:",
    "Напиши /wishlist, список или показать список. Также можно вызвать бота через @giftwishes_bot и выбрать результат \"Показать свой wishlist\".",
    "",
    "Как удалить подарок:",
    "В чате напиши @giftwishes_bot и вставь ссылку на подарок. Выбери результат \"Удалить подарок из wishlist\"."
  ].join("\n");
}

export function createWishlistProfileReplyMarkup({ ownerUsername, webAppUrl }: { ownerUsername: string | null; webAppUrl: string }): WishlistProfileReplyMarkup {
  const label = ownerUsername ? `Открыть профиль @${ownerUsername} / Купить гифт` : "Открыть профиль / Купить гифт";

  return {
    inline_keyboard: [[{ text: label, web_app: { url: webAppUrl } }]]
  };
}

export function createWishlistGiftLinksReplyMarkup({ items }: { items: InlineWishlistItem[] }): WishlistGiftLinksReplyMarkup | undefined {
  const buttons = items.flatMap((item, index) => {
    if (!item.sourceUrl) return [];
    return [
      [
        {
          text: `Открыть ${index + 1}. ${item.collectionName} - ${item.modelName}`,
          url: item.sourceUrl
        }
      ]
    ];
  });

  return buttons.length > 0 ? { inline_keyboard: buttons } : undefined;
}

export function createInlineWishlistResult({ wishlistLink, message, itemCount }: { wishlistLink: string; message: FormattedTelegramMessage; itemCount: number }): InlineWishlistResult {
  return {
    type: "article",
    id: INLINE_WISHLIST_RESULT_ID,
    title: "Показать свой wishlist",
    description: itemCount > 0 ? `${itemCount} подарков в списке` : "Wishlist пока пуст",
    thumbnail_url: INLINE_WISHLIST_THUMBNAIL_URL,
    input_message_content: {
      message_text: message.text,
      entities: messageEntitiesOption(message),
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true
    },
    reply_markup: {
      inline_keyboard: [[{ text: itemCount > 0 ? "Открыть wishlist" : "Добавить подарки", url: wishlistLink }]]
    }
  };
}

export function createInlineAddGiftResult({ wishlistLink, sourceUrl }: { wishlistLink: string; sourceUrl: string }): InlineAddGiftResult {
  return {
    type: "article",
    id: INLINE_ADD_GIFT_RESULT_ID,
    title: "Добавить подарок в wishlist",
    description: sourceUrl,
    thumbnail_url: INLINE_ADD_THUMBNAIL_URL,
    input_message_content: {
      message_text: "Добавляю подарок в wishlist...",
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true
    },
    reply_markup: {
      inline_keyboard: [[{ text: "Открыть wishlist", url: wishlistLink }]]
    }
  };
}

export function createInlineHelpResult(): InlineHelpResult {
  return {
    type: "article",
    id: INLINE_HELP_RESULT_ID,
    title: "Помощь",
    description: "Как пользоваться Gift Wishes",
    thumbnail_url: INLINE_HELP_THUMBNAIL_URL,
    input_message_content: {
      message_text: formatHelpMessage(),
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true
    }
  };
}

export function createInlineDeleteGiftResult({ itemNumber, sourceUrl, wishlistLink }: { itemNumber?: number; sourceUrl?: string; wishlistLink: string }): InlineDeleteGiftResult {
  const title = sourceUrl ? "Удалить подарок из wishlist" : `Удалить подарок #${itemNumber}`;
  const description = sourceUrl ?? `Удалить подарок под номером ${itemNumber} из wishlist`;
  const messageText = sourceUrl ? "Удаляю подарок из wishlist..." : `Удаляю подарок #${itemNumber} из wishlist...`;

  return {
    type: "article",
    id: INLINE_DELETE_GIFT_RESULT_ID,
    title,
    description,
    thumbnail_url: INLINE_DELETE_THUMBNAIL_URL,
    input_message_content: {
      message_text: messageText,
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true
    },
    reply_markup: {
      inline_keyboard: [[{ text: "Открыть wishlist", url: wishlistLink }]]
    }
  };
}

export async function editChosenInlineWishlistResult({
  chosenInlineResult,
  findUserByTelegramId,
  createWishlistLink,
  editMessageText
}: {
  chosenInlineResult: ChosenInlineWishlistResult;
  findUserByTelegramId: (telegramId: string) => Promise<{ id: string; username: string | null; wishlistItems: InlineWishlistItem[] } | null>;
  createWishlistLink: (userId: string) => string;
  editMessageText: (
    text: string,
    extra: {
      entities?: TelegramMessageEntity[];
      link_preview_options: { is_disabled: true };
      disable_web_page_preview: true;
      reply_markup: InlineWishlistResult["reply_markup"];
    }
  ) => Promise<unknown>;
}) {
  if (chosenInlineResult.result_id !== INLINE_WISHLIST_RESULT_ID) return false;
  if (!chosenInlineResult.inline_message_id) return false;

  const user = await findUserByTelegramId(String(chosenInlineResult.from.id));
  if (!user) return false;

  const message = formatInlineWishlistReply({
    username: user.username,
    items: user.wishlistItems
  });
  const result = createInlineWishlistResult({
    wishlistLink: createWishlistLink(user.id),
    message,
    itemCount: user.wishlistItems.length
  });

  await editMessageText(message.text, {
    entities: messageEntitiesOption(message),
    link_preview_options: { is_disabled: true },
    disable_web_page_preview: true,
    reply_markup: result.reply_markup
  });
  return true;
}

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private bot?: Telegraf;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly wishlist: WishlistService
  ) {}

  private appUrl(path = "") {
    const base = this.config.getOrThrow<string>("WEB_APP_URL").replace(/\/$/, "");
    return `${base}${path}`;
  }

  private publicWishlistUrl(userId: string) {
    return `${this.appUrl("/")}?${new URLSearchParams({ owner: userId }).toString()}`;
  }

  private botUsername() {
    return this.config.get<string>("BOT_USERNAME") ?? DEFAULT_BOT_USERNAME;
  }

  private botWishlistUrl(userId: string) {
    return createBotWishlistDeepLink({
      botUsername: this.botUsername(),
      appShortName: this.config.get<string>("BOT_APP_SHORT_NAME"),
      ownerUserId: userId
    });
  }

  private async fetchTelegramNftHtml(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Telegram NFT page request failed ${response.status}`);
    }
    return response.text();
  }

  private async upsertTelegramUser(from: { id: number; username?: string; first_name?: string; last_name?: string; language_code?: string }) {
    return this.prisma.user.upsert({
      where: { telegramId: String(from.id) },
      update: {
        username: from.username,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        languageCode: from.language_code ?? null,
        isUsernameVisible: true
      },
      create: {
        telegramId: String(from.id),
        username: from.username,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        languageCode: from.language_code ?? null,
        isUsernameVisible: true
      }
    });
  }

  private formatAddedGiftMessage(gift: { collectionName: string; modelName: string; backdropName?: string | null; symbolName?: string | null }) {
    const lines = [`Добавлено в wishlist: ${gift.collectionName} - ${gift.modelName}`];
    if (gift.backdropName) lines.push(`Фон: ${gift.backdropName}`);
    if (gift.symbolName) lines.push(`Узор: ${gift.symbolName}`);
    return lines.join("\n");
  }

  onModuleInit() {
    const token = this.config.get<string>("BOT_TOKEN");
    if (!token) {
      this.logger.warn("BOT_TOKEN is not configured; Telegram bot is disabled");
      return;
    }

    this.bot = new Telegraf(token);
    this.bot.catch((error) => {
      this.logger.error("Telegram bot update failed", error instanceof Error ? error.stack : String(error));
    });

    this.bot.start(async (ctx) => {
      const from = ctx.from;
      if (!from) {
        return;
      }

      await this.upsertTelegramUser(from);

      const ownerUserId = parseWishlistStartPayload((ctx as { payload?: string }).payload);
      if (ownerUserId) {
        const owner = await this.prisma.user.findUnique({
          where: { id: ownerUserId },
          include: { wishlistItems: { orderBy: { createdAt: "asc" } } }
        });

        if (!owner) {
          await ctx.reply("Wishlist не найден.");
          return;
        }

        const reply = formatInlineWishlistReply({ username: owner.username, items: owner.wishlistItems });
        await ctx.reply(reply.text, {
          entities: messageEntitiesOption(reply),
          reply_markup: createWishlistProfileReplyMarkup({
            ownerUsername: owner.username,
            webAppUrl: this.publicWishlistUrl(owner.id)
          })
        });
        return;
      }

      if (!from.username) {
        await ctx.reply("Bot cannot see your Telegram username. Add a username in Telegram and open the bot again.");
        return;
      }

      await ctx.reply("Gift Wishes is ready.", {
        reply_markup: { inline_keyboard: [[{ text: "Open wishlist", web_app: { url: this.appUrl() } }]] }
      });
    });

    this.bot.on("inline_query", async (ctx) => {
      const from = ctx.from;
      const itemNumberToRemove = parseWishlistItemRemovalCommand(ctx.inlineQuery.query ?? "");
      if (itemNumberToRemove) {
        const user = await this.upsertTelegramUser(from);
        return ctx.answerInlineQuery([createInlineDeleteGiftResult({ itemNumber: itemNumberToRemove, wishlistLink: this.botWishlistUrl(user.id) }), createInlineHelpResult()], {
          cache_time: 0,
          is_personal: true
        });
      }

      const sourceUrl = extractTelegramNftUrl(ctx.inlineQuery.query ?? "");
      if (sourceUrl) {
        const user = await this.upsertTelegramUser(from);
        return ctx.answerInlineQuery(
          [
            createInlineAddGiftResult({
              wishlistLink: this.botWishlistUrl(user.id),
              sourceUrl
            }),
            createInlineDeleteGiftResult({ sourceUrl, wishlistLink: this.botWishlistUrl(user.id) }),
            createInlineHelpResult()
          ],
          { cache_time: 0, is_personal: true }
        );
      }

      const registeredUser = await this.upsertTelegramUser(from);
      const user = await this.prisma.user.findUnique({
        where: { id: registeredUser.id },
        include: { wishlistItems: { orderBy: { createdAt: "asc" } } }
      });
      if (!user) return ctx.answerInlineQuery([createInlineHelpResult()], { cache_time: 0, is_personal: true });

      const wishlistLink = this.botWishlistUrl(user.id);
      const message = formatInlineWishlistReply({
        username: user.username,
        items: user.wishlistItems
      });

      return ctx.answerInlineQuery(
        [
          createInlineWishlistResult({
            wishlistLink,
            message,
            itemCount: user.wishlistItems.length
          }),
          createInlineHelpResult()
        ],
        { cache_time: 0, is_personal: true }
      );
    });

    this.bot.on("chosen_inline_result", async (ctx) => {
      if (ctx.chosenInlineResult.result_id === INLINE_DELETE_GIFT_RESULT_ID) {
        const query = ctx.chosenInlineResult.query ?? "";
        const sourceUrlToRemove = extractTelegramNftUrl(query);
        const itemNumberToRemove = parseWishlistItemRemovalCommand(query);
        if (!sourceUrlToRemove && !itemNumberToRemove) return;

        try {
          const user = await this.upsertTelegramUser(ctx.chosenInlineResult.from);
          const wishlist = await this.wishlist.getMine(user.id);
          const item = sourceUrlToRemove ? wishlist.items.find((wishlistItem) => wishlistItem.sourceUrl === sourceUrlToRemove) : wishlist.items[(itemNumberToRemove ?? 1) - 1];
          if (!item) {
            if (ctx.chosenInlineResult.inline_message_id) {
              await ctx.editMessageText("Подарок не найден в твоем wishlist.", {
                link_preview_options: { is_disabled: true }
              });
            }
            return;
          }

          await this.wishlist.remove(user.id, item.id);
          if (ctx.chosenInlineResult.inline_message_id) {
            await ctx.editMessageText(`Удалено из wishlist: ${item.collectionName} - ${item.modelName}`, {
              link_preview_options: { is_disabled: true }
            });
          }
        } catch (error) {
          this.logger.warn("Telegram NFT inline wishlist removal failed", error instanceof Error ? error.stack : String(error));
          if (ctx.chosenInlineResult.inline_message_id) {
            await ctx.editMessageText(error instanceof Error ? error.message : "Не удалось удалить гифт из wishlist.", {
              link_preview_options: { is_disabled: true }
            });
          }
        }
        return;
      }

      if (ctx.chosenInlineResult.result_id === INLINE_ADD_GIFT_RESULT_ID) {
        const query = ctx.chosenInlineResult.query ?? "";
        try {
          const user = await this.upsertTelegramUser(ctx.chosenInlineResult.from);
          const createdGift = await addTelegramNftGiftFromMessage({
            text: query,
            fetchHtml: (url) => this.fetchTelegramNftHtml(url),
            createWishlistItem: (input) => this.wishlist.create(user.id, input)
          });

          if (createdGift && ctx.chosenInlineResult.inline_message_id) {
            await ctx.editMessageText(this.formatAddedGiftMessage(createdGift), {
              link_preview_options: { is_disabled: true },
              reply_markup: { inline_keyboard: [[{ text: "Открыть wishlist", url: this.botWishlistUrl(user.id) }]] }
            });
          }
        } catch (error) {
          this.logger.warn("Telegram NFT inline wishlist import failed", error instanceof Error ? error.stack : String(error));
          if (ctx.chosenInlineResult.inline_message_id) {
            await ctx.editMessageText(error instanceof Error ? error.message : "Не удалось добавить гифт в wishlist.", {
              link_preview_options: { is_disabled: true }
            });
          }
        }
        return;
      }

      await editChosenInlineWishlistResult({
        chosenInlineResult: ctx.chosenInlineResult,
        findUserByTelegramId: (telegramId) =>
          this.prisma.user.findUnique({
            where: { telegramId },
            include: { wishlistItems: { orderBy: { createdAt: "asc" } } }
          }),
        createWishlistLink: (userId) => this.botWishlistUrl(userId),
        editMessageText: (text, extra) => ctx.editMessageText(text, extra)
      });
    });

    this.bot.on("text", async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const message = ctx.message as { text?: string };
      const text = message.text ?? "";
      try {
        const user = await this.upsertTelegramUser(from);
        if (isHelpCommand(text)) {
          await ctx.reply(formatHelpMessage(), {
            link_preview_options: { is_disabled: true }
          });
          return;
        }

        const itemNumberToRemove = parseWishlistItemRemovalCommand(text);
        if (itemNumberToRemove) {
          const wishlist = await this.wishlist.getMine(user.id);
          const item = wishlist.items[itemNumberToRemove - 1];
          if (!item) {
            await ctx.reply(`Подарок с номером ${itemNumberToRemove} не найден. Напиши /wishlist, чтобы увидеть текущий список.`);
            return;
          }

          await this.wishlist.remove(user.id, item.id);
          await ctx.reply(`Удалено из wishlist: ${item.collectionName} - ${item.modelName}`);
          return;
        }

        if (isOwnWishlistCommand(text)) {
          const wishlist = await this.wishlist.getMine(user.id);
          const reply = formatOwnWishlistReply({ items: wishlist.items });
          await ctx.reply(reply.text, {
            entities: messageEntitiesOption(reply),
            link_preview_options: { is_disabled: true },
            reply_markup: createWishlistGiftLinksReplyMarkup({ items: wishlist.items })
          });
          return;
        }

        const createdGift = await addTelegramNftGiftFromMessage({
          text,
          fetchHtml: (url) => this.fetchTelegramNftHtml(url),
          createWishlistItem: (input) => this.wishlist.create(user.id, input)
        });

        if (!createdGift) return;
        await ctx.reply(this.formatAddedGiftMessage(createdGift));
      } catch (error) {
        this.logger.warn("Telegram NFT wishlist import failed", error instanceof Error ? error.stack : String(error));
        await ctx.reply(error instanceof Error ? error.message : "Не удалось добавить гифт в wishlist.");
      }
    });

    void this.bot.launch();
  }

  async notifyGiftReceived(recipientTelegramId: string, text: string) {
    if (!this.bot) return;
    await this.bot.telegram.sendMessage(recipientTelegramId, text);
  }
}
