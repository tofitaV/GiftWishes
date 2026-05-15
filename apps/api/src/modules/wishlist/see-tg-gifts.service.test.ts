import { describe, expect, it, vi } from "vitest";
import { SeeTgGiftsService } from "./see-tg-gifts.service.js";

function config(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key]
  };
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body
  } as Response;
}

describe("SeeTgGiftsService", () => {
  it("finds the first gift link by collection, model, and backdrop", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ gifts: [{ slug: "PlushPepe", num: 123, backdrop_name: "Black" }] }));
    const service = new SeeTgGiftsService(config({ SEE_TG_TOKEN: "app-token" }) as never, fetcher);

    await expect(
      service.findFirstGift({
        collectionName: "Plush Pepe",
        modelName: "Raphael",
        backdropName: "Black",
        telegramAuthData: "query_id=abc&hash=def"
      })
    ).resolves.toEqual({ sourceUrl: "https://t.me/nft/PlushPepe-123", backdropName: "Black" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/api/gifts");
    expect(url.searchParams.get("app_token")).toBe("app-token");
    expect(JSON.parse(url.searchParams.get("tgauth") ?? "{}")).toEqual({
      hash: "def",
      query_id: "abc",
      tg_initdata: "query_id=abc&hash=def",
      tma: true
    });
    expect(url.searchParams.get("title")).toBe("Plush Pepe");
    expect(url.searchParams.get("model_name")).toBe("Raphael");
    expect(url.searchParams.get("backdrop_name")).toBe("Black");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(url.searchParams.get("sort_by")).toBe("num");
    expect(url.searchParams.get("order")).toBe("asc");
  });

  it("falls back to any backdrop when the requested backdrop has no gifts", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ gifts: [] }))
      .mockResolvedValueOnce(jsonResponse([{ slug: "PlushPepe", num: 456, backdrop: { name: "Sapphire" } }]));
    const service = new SeeTgGiftsService(config({ SEE_TG_TOKEN: "app-token" }) as never, fetcher);

    await expect(
      service.findFirstGift({
        collectionName: "Plush Pepe",
        modelName: "Raphael",
        backdropName: "Black",
        telegramAuthData: "query_id=abc&hash=def"
      })
    ).resolves.toEqual({ sourceUrl: "https://t.me/nft/PlushPepe-456", backdropName: "Sapphire" });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetcher.mock.calls[0]?.[0])).searchParams.get("backdrop_name")).toBe("Black");
    expect(new URL(String(fetcher.mock.calls[1]?.[0])).searchParams.has("backdrop_name")).toBe(false);
  });

  it("converts Telegram Mini App initData to see.tg JSON tgauth", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ gifts: [] }));
    const service = new SeeTgGiftsService(config({ SEE_TG_TOKEN: "app-token" }) as never, fetcher);
    const initData = [
      "query_id=query-id",
      `user=${encodeURIComponent(JSON.stringify({ id: 123, first_name: "Alice", username: "alice" }))}`,
      "auth_date=1700000000",
      "hash=hash-value"
    ].join("&");

    await service.findFirstGift({
      collectionName: "Cupid Charm",
      modelName: "Ice Glass",
      backdropName: "Electric Indigo",
      telegramAuthData: initData
    });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(JSON.parse(url.searchParams.get("tgauth") ?? "{}")).toEqual({
      id: 123,
      first_name: "Alice",
      username: "alice",
      auth_date: "1700000000",
      hash: "hash-value",
      query_id: "query-id",
      tma: true,
      tg_initdata: initData
    });
  });

  it("passes through an already JSON see.tg tgauth token", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ gifts: [] }));
    const service = new SeeTgGiftsService(config({ SEE_TG_TOKEN: "app-token" }) as never, fetcher);
    const tgauth = JSON.stringify({ id: 123, auth_date: "1700000000", hash: "hash-value", tma: true });

    await service.findFirstGift({
      collectionName: "Cupid Charm",
      modelName: "Ice Glass",
      telegramAuthData: tgauth
    });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.searchParams.get("tgauth")).toBe(tgauth);
  });

  it("does not call see.tg when auth data or app token is missing", async () => {
    const fetcher = vi.fn();
    const service = new SeeTgGiftsService(config({ SEE_TG_TOKEN: undefined }) as never, fetcher);

    await expect(
      service.findFirstGift({
        collectionName: "Plush Pepe",
        modelName: "Raphael",
        backdropName: "Black",
        telegramAuthData: "query_id=abc&hash=def"
      })
    ).resolves.toBeNull();

    await expect(
      new SeeTgGiftsService(config({ SEE_TG_TOKEN: "app-token" }) as never, fetcher).findFirstGift({
        collectionName: "Plush Pepe",
        modelName: "Raphael"
      })
    ).resolves.toBeNull();

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns null when see.tg is unavailable", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });
    const service = new SeeTgGiftsService(config({ SEE_TG_TOKEN: "app-token" }) as never, fetcher);

    await expect(
      service.findFirstGift({
        collectionName: "Plush Pepe",
        modelName: "Raphael",
        backdropName: "Black",
        telegramAuthData: "query_id=abc&hash=def"
      })
    ).resolves.toBeNull();
  });
});
