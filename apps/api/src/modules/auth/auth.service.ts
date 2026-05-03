import crypto from "node:crypto";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service.js";
import { TelegramAuthDataStore } from "./telegram-auth-data.store.js";

type TelegramInitUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly telegramAuthDataStore: TelegramAuthDataStore
  ) {}

  async loginWithTelegramInitData(initData: string) {
    const parsed = this.parseAndValidateInitData(initData);
    const userPayload = parsed.user;

    if (!userPayload.username) {
      throw new BadRequestException("Бот не видит ваш Telegram username. Добавьте username в Telegram и откройте бота снова.");
    }

    const user = await this.prisma.user.upsert({
      where: { telegramId: String(userPayload.id) },
      update: {
        username: userPayload.username,
        firstName: userPayload.first_name ?? null,
        lastName: userPayload.last_name ?? null,
        languageCode: userPayload.language_code ?? null,
        isUsernameVisible: true
      },
      create: {
        telegramId: String(userPayload.id),
        username: userPayload.username,
        firstName: userPayload.first_name ?? null,
        lastName: userPayload.last_name ?? null,
        languageCode: userPayload.language_code ?? null,
        isUsernameVisible: true
      }
    });

    const token = await this.jwt.signAsync(
      { sub: user.id, telegramId: user.telegramId },
      { secret: this.config.getOrThrow<string>("JWT_SECRET"), expiresIn: "12h" }
    );
    this.telegramAuthDataStore.set(user.id, initData);

    return {
      token,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        languageCode: user.languageCode,
        tonBalanceNano: user.tonBalanceNano.toString(),
        purchasedWishlistSlots: user.purchasedWishlistSlots,
        connectedWalletAddress: user.connectedWalletAddress
      }
    };
  }

  private parseAndValidateInitData(initData: string): { user: TelegramInitUser } {
    const botToken = this.config.get<string>("BOT_TOKEN");
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    const user = params.get("user");

    if (!hash || !user) {
      throw new UnauthorizedException("Invalid Telegram init data");
    }

    if (botToken) {
      params.delete("hash");
      const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
      const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
      const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
      if (calculated !== hash) {
        throw new UnauthorizedException("Telegram init data signature mismatch");
      }
    }

    return { user: JSON.parse(user) as TelegramInitUser };
  }
}
