import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type SeeTgGiftLookup = {
  collectionName: string;
  modelName: string;
  backdropName?: string | null;
  telegramAuthData?: string | null;
};

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type SeeTgResolvedGift = {
  sourceUrl: string;
  backdropName: string | null;
};

export const SEE_TG_FETCHER = Symbol("SEE_TG_FETCHER");

@Injectable()
export class SeeTgGiftsService {
  private readonly fetcher: Fetcher;

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(SEE_TG_FETCHER) fetcher?: Fetcher
  ) {
    this.fetcher = fetcher ?? fetch;
  }

  async findFirstGift(input: SeeTgGiftLookup): Promise<SeeTgResolvedGift | null> {
    const token = this.config.get<string>("SEE_TG_TOKEN");
    if (!token || !input.telegramAuthData) return null;

    const exactBackdropGift = await this.searchFirstGift(input, token, Boolean(input.backdropName));
    if (exactBackdropGift || !input.backdropName) return exactBackdropGift;

    return this.searchFirstGift(input, token, false);
  }

  private async searchFirstGift(input: SeeTgGiftLookup, token: string, includeBackdrop: boolean) {
    const baseUrl = this.config.get<string>("SEE_TG_BASE_URL") ?? "https://poso.see.tg";
    const url = new URL("/api/gifts", baseUrl.replace(/\/$/, ""));
    url.searchParams.set("app_token", token);
    url.searchParams.set("tgauth", input.telegramAuthData ?? "");
    url.searchParams.set("title", input.collectionName);
    url.searchParams.set("model_name", input.modelName);
    if (includeBackdrop && input.backdropName) url.searchParams.set("backdrop_name", input.backdropName);
    url.searchParams.set("limit", "1");
    url.searchParams.set("sort_by", "num");
    url.searchParams.set("order", "asc");

    const response = await this.fetcher(url.toString()).catch(() => null);
    if (!response?.ok) return null;

    return giftToResolvedGift(firstGift(await response.json()));
  }
}

function firstGift(data: unknown) {
  if (Array.isArray(data)) return data[0] as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return undefined;

  const record = data as Record<string, unknown>;
  for (const key of ["gifts", "items", "results", "data"]) {
    const value = record[key];
    if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  }

  return record;
}

function giftToResolvedGift(gift: Record<string, unknown> | undefined) {
  if (!gift) return null;

  const existingUrl = firstString(gift, ["url", "nft_url", "telegram_url", "link"]);
  const existingNftUrl = existingUrl?.match(/^https:\/\/t\.me\/nft\/[A-Za-z0-9_-]+-\d+\b/i)?.[0];
  const sourceUrl = existingNftUrl ?? giftToTelegramNftUrl(gift);
  if (!sourceUrl) return null;

  return {
    sourceUrl,
    backdropName: giftBackdropName(gift)
  };
}

function giftToTelegramNftUrl(gift: Record<string, unknown>) {
  const slug = firstString(gift, ["slug", "gift_slug", "collection_slug"]);
  const num = firstString(gift, ["num", "number", "model_num"]);
  return slug && num ? `https://t.me/nft/${slug}-${num}` : null;
}

function giftBackdropName(gift: Record<string, unknown>) {
  const direct = firstString(gift, ["backdrop_name", "backdropName", "backdrop"]);
  if (direct) return direct;

  const backdrop = gift.backdrop;
  if (backdrop && typeof backdrop === "object") {
    return firstString(backdrop as Record<string, unknown>, ["name", "backdrop_name", "backdropName"]);
  }

  return null;
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}
