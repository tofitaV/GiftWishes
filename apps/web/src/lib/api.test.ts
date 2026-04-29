import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

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
});
