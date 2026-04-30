import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf } from "telegraf";
import { PrismaService } from "../prisma/prisma.service.js";

type InlineWishlistItem = {
  collectionName: string;
  modelName: string;
  backdropName: string | null;
  symbolName: string | null;
};

type InlineWishlistResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  input_message_content: {
    message_text: string;
  };
  reply_markup: {
    inline_keyboard: [[{ text: string; url: string }]];
  };
};

type WishlistProfileReplyMarkup = {
  inline_keyboard: [[{ text: string; web_app: { url: string } }]];
};

const WISHLIST_START_PREFIX = "wishlist_";
const DEFAULT_BOT_USERNAME = "giftwishes_bot";

export function formatInlineWishlistMessage({ username, items }: { username: string | null; items: InlineWishlistItem[] }) {
  const displayName = username ? `@${username}` : "пользователя";
  if (items.length === 0) {
    return `Wishlist ${displayName} пока пуст`;
  }

  const lines = items.flatMap((item, index) => {
    const itemLines = [`${index + 1}. ${item.collectionName} - ${item.modelName}`];
    if (item.backdropName) itemLines.push(`   Фон: ${item.backdropName}`);
    if (item.symbolName) itemLines.push(`   Узор: ${item.symbolName}`);
    return itemLines;
  });

  return [`Wishlist ${displayName}`, "", ...lines].join("\n");
}

export function parseWishlistStartPayload(payload: string | undefined) {
  if (!payload?.startsWith(WISHLIST_START_PREFIX)) return null;

  const ownerUserId = payload.slice(WISHLIST_START_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(ownerUserId)) return null;
  return ownerUserId;
}

export function createBotWishlistDeepLink({ botUsername, ownerUserId }: { botUsername: string; ownerUserId: string }) {
  const username = botUsername.replace(/^@/, "");
  return `https://t.me/${username}?start=${WISHLIST_START_PREFIX}${ownerUserId}`;
}

export function createWishlistProfileReplyMarkup({ ownerUsername, webAppUrl }: { ownerUsername: string | null; webAppUrl: string }): WishlistProfileReplyMarkup {
  const label = ownerUsername ? `Открыть профиль @${ownerUsername} / Купить гифт` : "Открыть профиль / Купить гифт";

  return {
    inline_keyboard: [[{ text: label, web_app: { url: webAppUrl } }]]
  };
}

export function createInlineWishlistResult({ wishlistLink, message, itemCount }: { wishlistLink: string; message: string; itemCount: number }): InlineWishlistResult {
  return {
    type: "article",
    id: "wishlist",
    title: "Показать свой wishlist",
    description: itemCount > 0 ? `${itemCount} подарков в списке` : "Wishlist пока пуст",
    input_message_content: {
      message_text: message
    },
    reply_markup: {
      inline_keyboard: [[{ text: itemCount > 0 ? "Открыть wishlist" : "Добавить подарки", url: wishlistLink }]]
    }
  };
}

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private bot?: Telegraf;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
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
    return createBotWishlistDeepLink({ botUsername: this.botUsername(), ownerUserId: userId });
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

      await this.prisma.user.upsert({
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

        await ctx.reply(formatInlineWishlistMessage({ username: owner.username, items: owner.wishlistItems }), {
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
      const message = formatInlineWishlistMessage({
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

    void this.bot.launch();
  }

  async notifyGiftReceived(recipientTelegramId: string, text: string) {
    if (!this.bot) return;
    await this.bot.telegram.sendMessage(recipientTelegramId, text);
  }
}
