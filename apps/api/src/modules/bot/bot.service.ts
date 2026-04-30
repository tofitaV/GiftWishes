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

  onModuleInit() {
    const token = this.config.get<string>("BOT_TOKEN");
    if (!token) {
      this.logger.warn("BOT_TOKEN is not configured; Telegram bot is disabled");
      return;
    }

    this.bot = new Telegraf(token);
    this.bot.start(async (ctx) => {
      const from = ctx.from;
      if (!from?.username) {
        await ctx.reply("Bot cannot see your Telegram username. Add a username in Telegram and open the bot again.");
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

      const wishlistLink = this.publicWishlistUrl(user.id);
      const message = formatInlineWishlistMessage({
        username: user.username,
        items: user.wishlistItems
      });

      return ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "wishlist",
            title: "Показать свой wishlist",
            description: user.wishlistItems.length > 0 ? `${user.wishlistItems.length} подарков в списке` : "Wishlist пока пуст",
            input_message_content: {
              message_text: message
            },
            reply_markup: { inline_keyboard: [[{ text: user.wishlistItems.length > 0 ? "Открыть wishlist" : "Добавить подарки", web_app: { url: wishlistLink } }]] }
          }
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
