import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
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
  private readonly logger = new Logger(SeeTgGiftsService.name);
  private readonly fetcher: Fetcher;

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(SEE_TG_FETCHER) fetcher?: Fetcher
  ) {
    this.fetcher = fetcher ?? fetch;
  }

  async findFirstGift(input: SeeTgGiftLookup): Promise<SeeTgResolvedGift | null> {
    const token = this.config.get<string>("SEE_TG_TOKEN");
    if (!token) {
      this.logger.warn("SEE_TG_TOKEN is not configured");
      return null;
    }
    if (!input.telegramAuthData) {
      this.logger.warn(`Skipping see.tg lookup without Telegram auth data for ${input.collectionName} / ${input.modelName}`);
      return null;
    }

    const backdropName = cleanOptionalName(input.backdropName);
    const lookup = { ...input, backdropName };
    const exactResults = await this.searchGifts(lookup, token, {
      includeBackdrop: Boolean(backdropName),
      limit: 1
    });
    const firstExactResult = exactResults[0] ?? null;
    if (!backdropName) return firstExactResult;

    if (matchesBackdrop(firstExactResult, backdropName)) return firstExactResult;

    const broaderResults = await this.searchGifts(lookup, token, {
      includeBackdrop: false,
      limit: 50
    });
    return broaderResults.find((gift) => matchesBackdrop(gift, backdropName)) ?? null;
  }

  private async searchGifts(input: SeeTgGiftLookup, token: string, options: { includeBackdrop: boolean; limit: number }) {
    const baseUrl = this.config.get<string>("SEE_TG_BASE_URL") ?? "https://poso.see.tg";
    const url = new URL("/api/gifts", baseUrl.replace(/\/$/, ""));
    url.searchParams.set("app_token", token);
    url.searchParams.set("tgauth", toSeeTgAuth(input.telegramAuthData ?? ""));
    url.searchParams.set("title", input.collectionName);
    url.searchParams.set("model_name", input.modelName);
    if (options.includeBackdrop && input.backdropName) url.searchParams.set("backdrop_name", input.backdropName);
    url.searchParams.set("limit", String(options.limit));
    url.searchParams.set("sort_by", "num");
    url.searchParams.set("order", "asc");

    const response = await this.fetcher(url.toString()).catch((error: unknown) => {
      this.logger.warn(`see.tg lookup failed for ${input.collectionName} / ${input.modelName}`, error instanceof Error ? error.message : String(error));
      return null;
    });
    if (!response?.ok) {
      this.logger.warn(`see.tg lookup returned ${response?.status ?? "no response"} for ${input.collectionName} / ${input.modelName}`);
      return [];
    }

    const resolvedGifts = giftsFromResponse(await response.json()).map(giftToResolvedGift).filter(isResolvedGift);
    if (resolvedGifts.length === 0) {
      this.logger.warn(`see.tg lookup returned no parsable gift for ${input.collectionName} / ${input.modelName}`);
    }
    return resolvedGifts;
  }
}

function giftsFromResponse(data: unknown) {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (!data || typeof data !== "object") return [];

  const record = data as Record<string, unknown>;
  for (const key of ["gifts", "items", "results", "data"]) {
    const value = record[key];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }

  return [record];
}

function toSeeTgAuth(telegramAuthData: string) {
  const trimmed = telegramAuthData.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("{")) return trimmed;

  const params = new URLSearchParams(trimmed);
  const user = parseUser(params.get("user"));
  return JSON.stringify({
    ...user,
    auth_date: params.get("auth_date") ?? undefined,
    hash: params.get("hash") ?? undefined,
    query_id: params.get("query_id") ?? undefined,
    tma: true,
    tg_initdata: telegramAuthData
  });
}

function parseUser(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
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

function isResolvedGift(gift: SeeTgResolvedGift | null): gift is SeeTgResolvedGift {
  return Boolean(gift);
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

function matchesBackdrop(gift: { backdropName?: string | null } | null, backdropName: string) {
  return normalizeName(gift?.backdropName) === normalizeName(backdropName);
}

function cleanOptionalName(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeName(value?: string | null) {
  return (
    value
      ?.normalize("NFKC")
      .replace(/[â€™â€˜]/g, "'")
      .replace(/\belectro\b/gi, "electric")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase() || ""
  );
}
