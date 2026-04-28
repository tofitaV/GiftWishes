import { describe, expect, it } from "vitest";
import { appHref, publicWishlistHref } from "./routing";

describe("publicWishlistHref", () => {
  it("builds a root query URL for GitHub Pages static hosting", () => {
    expect(publicWishlistHref("user 1", "/GiftWishes")).toBe("/GiftWishes/?owner=user+1");
  });

  it("uses root when no base path is configured", () => {
    expect(publicWishlistHref("abc", "")).toBe("/?owner=abc");
  });
});

describe("appHref", () => {
  it("prefixes internal routes with the GitHub Pages base path", () => {
    expect(appHref("/wallet", "/GiftWishes")).toBe("/GiftWishes/wallet/");
  });
});
