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
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "69420"
      },
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

  it("can force refresh a stored JWT after the API rejects it", async () => {
    const storage = new Map<string, string>([["gift-wishes-token", "expired-token"]]);
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: "fresh-token", user: { id: "u1" } }),
      text: async () => ""
    }));

    const result = await authenticateWithTelegram({
      initData: "query_id=1&hash=abc",
      apiBase: "https://api.example.com/api",
      fetcher,
      forceRefresh: true,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value)
      }
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(storage.get("gift-wishes-token")).toBe("fresh-token");
    expect(result).toEqual({ token: "fresh-token", user: { id: "u1" } });
  });

  it("logs failed auth requests with status and response body", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
      text: async () => '{"statusCode":500,"message":"Internal server error"}'
    }));

    await expect(
      authenticateWithTelegram({
        initData: "query_id=1&hash=abc",
        apiBase: "https://api.example.com/api",
        fetcher,
        storage: {
          getItem: () => null,
          setItem: vi.fn()
        }
      })
    ).rejects.toThrow('POST https://api.example.com/api/auth/telegram failed 500 Internal Server Error: {"statusCode":500,"message":"Internal server error"}');

    expect(errorSpy).toHaveBeenCalledWith("API request failed", {
      method: "POST",
      url: "https://api.example.com/api/auth/telegram",
      status: 500,
      statusText: "Internal Server Error",
      body: '{"statusCode":500,"message":"Internal server error"}'
    });

    errorSpy.mockRestore();
  });
});
