import crypto from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_LANGUAGE, EXTRA_WISHLIST_SLOT_PRICE_STARS, TELEGRAM_MARKET_TRANSFER_FEE_STARS, type SupportedLanguage } from "@gift-wishes/shared";
import { PrismaService } from "../prisma/prisma.service.js";

type SlotPaymentCheck = {
  payload: string;
  telegramUserId: string;
  currency: string;
  totalAmount: number;
};

type SlotPaymentConfirmation = SlotPaymentCheck & {
  telegramPaymentChargeId: string;
};

@Injectable()
export class StarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async createWishlistSlotInvoice(userId: string, language: SupportedLanguage = DEFAULT_LANGUAGE) {
    const id = crypto.randomUUID();
    const payload = `slot:${id}`;

    const entry = await this.prisma.$transaction(async (tx) =>
      tx.starsLedgerEntry.create({
        data: {
          id,
          userId,
          type: "slot_purchase",
          amountStars: EXTRA_WISHLIST_SLOT_PRICE_STARS,
          status: "pending",
          invoicePayload: payload,
          metadata: { language }
        }
      })
    );

    try {
      const invoiceLink = await this.createInvoiceLink({
        title: this.invoiceTitle(language),
        description: this.invoiceDescription(language),
        payload,
        prices: [{ label: this.invoiceLabel(language), amount: EXTRA_WISHLIST_SLOT_PRICE_STARS }]
      });
      return { invoiceLink, paymentId: entry.id };
    } catch (error) {
      await this.prisma.starsLedgerEntry.update({
        where: { id: entry.id },
        data: {
          status: "failed",
          metadata: {
            language,
            errorMessage: error instanceof Error ? error.message : "Unknown invoice creation error"
          }
        }
      });
      throw error;
    }
  }

  async validateWishlistSlotPreCheckout(input: SlotPaymentCheck): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
    const entry = await this.prisma.starsLedgerEntry.findUnique({
      where: { invoicePayload: input.payload },
      include: { user: true }
    });

    if (!entry || entry.type !== "slot_purchase" || entry.status !== "pending") {
      return { ok: false, errorMessage: "Payment invoice is no longer valid." };
    }
    if (entry.user.telegramId !== input.telegramUserId) {
      return { ok: false, errorMessage: "Payment does not match this Telegram account." };
    }
    if (input.currency !== "XTR" || input.totalAmount !== EXTRA_WISHLIST_SLOT_PRICE_STARS || entry.amountStars !== EXTRA_WISHLIST_SLOT_PRICE_STARS) {
      return { ok: false, errorMessage: "Payment amount is invalid." };
    }

    return { ok: true };
  }

  async confirmWishlistSlotPayment(input: SlotPaymentConfirmation) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.starsLedgerEntry.findUnique({
        where: { invoicePayload: input.payload },
        include: { user: true }
      });

      if (!entry || entry.type !== "slot_purchase") {
        throw new BadRequestException("Payment invoice is not valid.");
      }
      if (entry.status === "confirmed") {
        return entry;
      }
      if (entry.status !== "pending") {
        throw new BadRequestException("Payment invoice is no longer valid.");
      }
      if (entry.user.telegramId !== input.telegramUserId || input.currency !== "XTR" || input.totalAmount !== EXTRA_WISHLIST_SLOT_PRICE_STARS) {
        throw new BadRequestException("Payment does not match the invoice.");
      }

      const updated = await tx.starsLedgerEntry.update({
        where: { id: entry.id },
        data: {
          status: "confirmed",
          telegramPaymentChargeId: input.telegramPaymentChargeId,
          metadata: {
            telegramPaymentChargeId: input.telegramPaymentChargeId,
            totalAmount: input.totalAmount,
            currency: input.currency
          }
        }
      });
      await tx.user.update({
        where: { id: entry.userId },
        data: { purchasedWishlistSlots: { increment: 1 } }
      });
      return updated;
    });
  }

  private async createInvoiceLink(input: { title: string; description: string; payload: string; prices: { label: string; amount: number }[] }) {
    const token = this.config.getOrThrow<string>("BOT_TOKEN");
    const response = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        payload: input.payload,
        provider_token: "",
        currency: "XTR",
        prices: input.prices
      })
    });

    const body = (await response.json()) as { ok?: boolean; result?: string; description?: string };
    if (!response.ok || !body.ok || !body.result) {
      throw new Error(body.description ?? "Telegram invoice creation failed");
    }
    return body.result;
  }

  private invoiceTitle(language: SupportedLanguage) {
    return {
      en: "Extra wishlist slot",
      uk: "Додатковий слот wishlist",
      ru: "Дополнительный слот wishlist"
    }[language];
  }

  private invoiceDescription(language: SupportedLanguage) {
    return {
      en: "Adds one permanent slot to your Gift Wishes wishlist.",
      uk: "Додає один постійний слот до твого wishlist у Gift Wishes.",
      ru: "Добавляет один постоянный слот в твой wishlist в Gift Wishes."
    }[language];
  }

  private invoiceLabel(language: SupportedLanguage) {
    return {
      en: "One slot",
      uk: "Один слот",
      ru: "Один слот"
    }[language];
  }

  async stubBuyWishlistSlot(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.starsLedgerEntry.create({
        data: {
          userId,
          type: "slot_purchase_stub",
          amountStars: EXTRA_WISHLIST_SLOT_PRICE_STARS,
          metadata: { stub: true }
        }
      });
      return tx.user.update({
        where: { id: userId },
        data: { purchasedWishlistSlots: { increment: 1 } }
      });
    });
  }

  async stubChargeTelegramTransferFee(userId: string, purchaseId: string) {
    return this.prisma.starsLedgerEntry.create({
      data: {
        userId,
        type: "market_transfer_fee_stub",
        amountStars: TELEGRAM_MARKET_TRANSFER_FEE_STARS,
        metadata: { stub: true, purchaseId }
      }
    });
  }
}

