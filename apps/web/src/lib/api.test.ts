import { afterEach, describe, expect, it, vi } from "vitest";
import { api, TELEGRAM_INIT_DATA_HEADER } from "./api";

describe("api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds the ngrok skip warning header to backend requests", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => ""
    }));
    vi.stubGlobal("fetch", fetcher);

    await api("/wishlist/mine");

    expect(fetcher).toHaveBeenCalledWith("http://localhost:4000/api/wishlist/mine", {
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "69420"
      }
    });
  });

  it("forwards Telegram initData so backend can call see.tg on behalf of the user", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => ""
    }));
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("window", {
      localStorage: { getItem: () => null },
      Telegram: { WebApp: { initData: "query_id=1&hash=abc" } }
    });

    await api("/wishlist", { method: "POST", body: "{}" });

    expect(fetcher).toHaveBeenCalledWith("http://localhost:4000/api/wishlist", {
      method: "POST",
      body: "{}",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "69420",
        [TELEGRAM_INIT_DATA_HEADER]: "query_id=1&hash=abc"
      }
    });
  });
});
