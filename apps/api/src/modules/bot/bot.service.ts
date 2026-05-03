import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf } from "telegraf";
import { PrismaService } from "../prisma/prisma.service.js";
import { WishlistService } from "../wishlist/wishlist.service.js";
import { lookupGiftBackdropEmoji } from "./gift-backdrop-emojis.js";
import { lookupGiftModelEmoji } from "./gift-model-emojis.js";
import { addTelegramNftGiftFromMessage, type TelegramNftGift } from "./telegram-nft.js";

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
  input_message_content: {
    message_text: string;
    entities?: TelegramMessageEntity[];
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
    input_message_content: {
      message_text: message.text,
      entities: messageEntitiesOption(message)
    },
    reply_markup: {
      inline_keyboard: [[{ text: itemCount > 0 ? "Открыть wishlist" : "Добавить подарки", url: wishlistLink }]]
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
  editMessageText: (text: string, extra: { entities?: TelegramMessageEntity[]; reply_markup: InlineWishlistResult["reply_markup"] }) => Promise<unknown>;
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
          include: { wishlistItems: { orderBy: { createdAt: "desc" } } }
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
      const user = await this.prisma.user.findUnique({
        where: { telegramId: String(from.id) },
        include: { wishlistItems: { orderBy: { createdAt: "desc" } } }
      });
      if (!user) return ctx.answerInlineQuery([], { cache_time: 0 });

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
          })
        ],
        { cache_time: 0 }
      );
    });

    this.bot.on("chosen_inline_result", async (ctx) => {
      await editChosenInlineWishlistResult({
        chosenInlineResult: ctx.chosenInlineResult,
        findUserByTelegramId: (telegramId) =>
          this.prisma.user.findUnique({
            where: { telegramId },
            include: { wishlistItems: { orderBy: { createdAt: "desc" } } }
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
        if (isOwnWishlistCommand(text)) {
          const wishlist = await this.wishlist.getMine(user.id);
          const reply = formatOwnWishlistReply({ items: wishlist.items });
          await ctx.reply(reply.text, {
            entities: messageEntitiesOption(reply),
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
