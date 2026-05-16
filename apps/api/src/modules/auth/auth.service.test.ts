import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service.js";

function initDataFor(user: Record<string, unknown>) {
  return new URLSearchParams({
    user: JSON.stringify(user),
    hash: "test-hash"
  }).toString();
}

function createService(prismaOverrides: Record<string, unknown> = {}) {
  const jwt = { signAsync: vi.fn(async () => "jwt-token") };
  const config = {
    get: vi.fn(() => undefined),
    getOrThrow: vi.fn((key: string) => {
      if (key === "JWT_SECRET") return "jwt-secret";
      throw new Error(`Unexpected config key ${key}`);
    })
  };
  const telegramAuthDataStore = { set: vi.fn() };
  const prisma = {
    user: {
      upsert: vi.fn(async ({ create }) => ({
        id: "user-id",
        telegramId: create.telegramId,
        username: create.username,
        firstName: create.firstName,
        lastName: create.lastName,
        languageCode: create.languageCode,
        preferredLanguage: create.preferredLanguage,
        tonBalanceNano: 0n,
        purchasedWishlistSlots: 0,
        connectedWalletAddress: null
      })),
      update: vi.fn()
    },
    ...prismaOverrides
  };

  return {
    service: new AuthService(config as never, jwt as never, prisma as never, telegramAuthDataStore as never),
    prisma,
    telegramAuthDataStore
  };
}

describe("AuthService preferred language", () => {
  it("uses Telegram language_code as preferredLanguage for a new supported user", async () => {
    const { service, prisma } = createService();

    const result = await service.loginWithTelegramInitData(
      initDataFor({
        id: 123,
        username: "alice",
        first_name: "Alice",
        language_code: "uk"
      })
    );

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          languageCode: "uk",
          preferredLanguage: "uk"
        })
      })
    );
    expect(result.user.preferredLanguage).toBe("uk");
  });

  it("falls back to English when Telegram language_code is unsupported", async () => {
    const { service, prisma } = createService();

    const result = await service.loginWithTelegramInitData(
      initDataFor({
        id: 123,
        username: "alice",
        language_code: "de"
      })
    );

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          preferredLanguage: "en"
        })
      })
    );
    expect(result.user.preferredLanguage).toBe("en");
  });

  it("does not overwrite preferredLanguage on later Telegram logins", async () => {
    const { service, prisma } = createService({
      user: {
        upsert: vi.fn(async ({ update }) => ({
          id: "user-id",
          telegramId: "123",
          username: update.username,
          firstName: update.firstName,
          lastName: update.lastName,
          languageCode: update.languageCode,
          preferredLanguage: "ru",
          tonBalanceNano: 0n,
          purchasedWishlistSlots: 0,
          connectedWalletAddress: null
        }))
      }
    });

    const result = await service.loginWithTelegramInitData(
      initDataFor({
        id: 123,
        username: "alice",
        language_code: "uk"
      })
    );

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({
          preferredLanguage: expect.anything()
        })
      })
    );
    expect(result.user.preferredLanguage).toBe("ru");
  });
});
