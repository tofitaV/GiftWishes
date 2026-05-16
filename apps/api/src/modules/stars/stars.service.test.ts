import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXTRA_WISHLIST_SLOT_PRICE_STARS } from "@gift-wishes/shared";
import { StarsService } from "./stars.service.js";

function createConfig() {
  return {
    getOrThrow: vi.fn((key: string) => {
      if (key === "BOT_TOKEN") return "bot-token";
      throw new Error(`Unexpected config key ${key}`);
    })
  };
}

describe("StarsService wishlist slot payments", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a pending 50 Stars invoice without granting a slot", async () => {
    const createdEntries: unknown[] = [];
    const prisma = {
      $transaction: vi.fn(async (callback) =>
        callback({
          starsLedgerEntry: {
            create: vi.fn(async ({ data }) => {
              createdEntries.push(data);
              return data;
            })
          },
          user: {
            update: vi.fn(() => {
              throw new Error("slot should not be granted before payment");
            })
          }
        })
      )
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, result: "https://t.me/$invoice/slot" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const service = new StarsService(prisma as never, createConfig() as never);
    const result = await service.createWishlistSlotInvoice("user-id", "en");

    expect(result.invoiceLink).toBe("https://t.me/$invoice/slot");
    expect(result.paymentId).toBeTruthy();
    expect(createdEntries).toMatchObject([
      {
        userId: "user-id",
        type: "slot_purchase",
        amountStars: EXTRA_WISHLIST_SLOT_PRICE_STARS,
        status: "pending"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot-token/createInvoiceLink",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"currency":"XTR"')
      })
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain(`"amount":${EXTRA_WISHLIST_SLOT_PRICE_STARS}`);
  });

  it("rejects pre-checkout when payload, user, currency, or amount do not match a pending slot payment", async () => {
    const prisma = {
      starsLedgerEntry: {
        findUnique: vi.fn(async () => ({
          userId: "user-id",
          type: "slot_purchase",
          amountStars: EXTRA_WISHLIST_SLOT_PRICE_STARS,
          status: "pending",
          user: { telegramId: "123" }
        }))
      }
    };

    const service = new StarsService(prisma as never, createConfig() as never);

    await expect(
      service.validateWishlistSlotPreCheckout({
        payload: "slot:payment-id",
        telegramUserId: "999",
        currency: "XTR",
        totalAmount: EXTRA_WISHLIST_SLOT_PRICE_STARS
      })
    ).resolves.toEqual({ ok: false, errorMessage: "Payment does not match this Telegram account." });
  });

  it("confirms a successful payment idempotently and grants exactly one slot", async () => {
    const userUpdate = vi.fn();
    const ledgerUpdate = vi.fn();
    const prisma = {
      $transaction: vi.fn(async (callback) =>
        callback({
          starsLedgerEntry: {
            findUnique: vi.fn(async () => ({
              id: "payment-id",
              userId: "user-id",
              type: "slot_purchase",
              amountStars: EXTRA_WISHLIST_SLOT_PRICE_STARS,
              status: "pending",
              telegramPaymentChargeId: null,
              user: { telegramId: "123" }
            })),
            update: ledgerUpdate
          },
          user: {
            update: userUpdate
          }
        })
      )
    };

    const service = new StarsService(prisma as never, createConfig() as never);

    await service.confirmWishlistSlotPayment({
      payload: "slot:payment-id",
      telegramUserId: "123",
      currency: "XTR",
      totalAmount: EXTRA_WISHLIST_SLOT_PRICE_STARS,
      telegramPaymentChargeId: "charge-id"
    });

    expect(ledgerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment-id" },
        data: expect.objectContaining({ status: "confirmed", telegramPaymentChargeId: "charge-id" })
      })
    );
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-id" },
      data: { purchasedWishlistSlots: { increment: 1 } }
    });
  });
});
