import { describe, expect, it, vi } from "vitest";
import { authenticateWithTelegram, getTelegramInitData } from "./telegram-auth";

describe("getTelegramInitData", () => {
  it("reads Telegram WebApp initData from the browser window", () => {
    expect(
      getTelegramInitData({
        Telegram: { WebApp: { initData: "query_id=1&hash=abc" } }
      })
    ).toBe("query_id=1&hash=abc");
  });

  it("returns null outside Telegram", () => {
    expect(getTelegramInitData({})).toBeNull();
  });
});

describe("authenticateWithTelegram", () => {
  it("posts initData and stores the returned JWT", async () => {
    const storage = new Map<string, string>();
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: "jwt-token", user: { id: "u1" } }),
      text: async () => ""
    }));

    const result = await authenticateWithTelegram({
      initData: "query_id=1&hash=abc",
      apiBase: "https://api.example.com/api",
      fetcher,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value)
      }
    });

    expect(fetcher).toHaveBeenCalledWith("https://api.example.com/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: "query_id=1&hash=abc" })
    });
    expect(storage.get("gift-wishes-token")).toBe("jwt-token");
    expect(result).toEqual({ token: "jwt-token", user: { id: "u1" } });
  });

  it("reuses the stored JWT without posting to the backend", async () => {
    const fetcher = vi.fn();

    const result = await authenticateWithTelegram({
      initData: "query_id=1&hash=abc",
      apiBase: "https://api.example.com/api",
      fetcher,
      storage: {
        getItem: () => "existing-token",
        setItem: vi.fn()
      }
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual({ token: "existing-token" });
  });
});
