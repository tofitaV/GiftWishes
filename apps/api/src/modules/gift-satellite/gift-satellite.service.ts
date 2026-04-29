import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GiftListingDto, SupportedMarket, SUPPORTED_MARKETS } from "@gift-wishes/shared";

type RequestOptions = {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
};

@Injectable()
export class GiftSatelliteService {
  private readonly lastRequestByBucket = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  getCollections(premarket = 0) {
    return this.request<unknown[]>("/gift/collections", "gift", {
      query: { premarket }
    });
  }

  getCollection(collection: string) {
    return this.request<unknown>(`/gift/collection/${encodeURIComponent(collection)}`, "gift");
  }

  getModels(collection: string) {
    return this.request<unknown[]>(`/gift/models/${encodeURIComponent(collection)}`, "gift");
  }

  async searchMarket(market: SupportedMarket, collection: string, filters: { modelName: string; backdropName?: string | null }) {
    const route = market === "telegram" ? "tg" : market;
    const results = await this.request<GiftListingDto[]>(
      `/search/${route}/${encodeURIComponent(collection)}`,
      `search:${market}`,
      {
        query: {
          models: filters.modelName,
          backdrops: filters.backdropName || undefined
        }
      }
    );
    return results.map((item) => ({ ...item, market }));
  }

  async searchAllMarkets(collection: string, filters: { modelName: string; backdropName?: string | null }) {
    const settled = await Promise.allSettled(
      SUPPORTED_MARKETS.map((market) => this.searchMarket(market, collection, filters))
    );

    return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  }

  buyGift(input: {
    market: SupportedMarket;
    slug: string;
    originalPrice: string;
    giftId: string;
    collectionName: string;
  }) {
    return this.request<{ isBought: boolean }>("/user/buy", "buy", {
      body: {
        market: input.market,
        slug: input.slug,
        originalPrice: Number(input.originalPrice),
        giftId: input.giftId,
        collectionName: input.collectionName
      }
    }, "POST");
  }

  private async request<T>(path: string, rateLimitBucket: string, options: RequestOptions = {}, method = "GET"): Promise<T> {
    await this.waitForRateLimit(rateLimitBucket);

    const baseUrl = this.config.get<string>("GIFT_SATELLITE_BASE_URL") ?? "https://gift-satellite.dev/api";
    const token = this.config.get<string>("GIFT_SATELLITE_TOKEN");
    const url = new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
    });

    if (!token) {
      throw new ServiceUnavailableException("Gift Satellite token is not configured");
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`Gift Satellite request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private async waitForRateLimit(bucket: string) {
    const minDelayMs = bucket.startsWith("search") ? 3000 : bucket === "buy" ? 1000 : 250;
    const now = Date.now();
    const last = this.lastRequestByBucket.get(bucket) ?? 0;
    const waitMs = Math.max(0, last + minDelayMs - now);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastRequestByBucket.set(bucket, Date.now());
  }
}
