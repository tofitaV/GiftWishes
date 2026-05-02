import { describe, expect, it } from "vitest";
import { appHref, parsePublicWishlistStartParam, publicAssetHref, publicWishlistHref } from "./routing";

describe("publicWishlistHref", () => {
  it("builds a root query URL for GitHub Pages static hosting", () => {
    expect(publicWishlistHref("user 1", "/GiftWishes")).toBe("/GiftWishes/?owner=user+1");
  });

  it("uses root when no base path is configured", () => {
    expect(publicWishlistHref("abc", "")).toBe("/?owner=abc");
  });
});

describe("parsePublicWishlistStartParam", () => {
  it("reads the wishlist owner from a Telegram Mini App profile payload", () => {
    expect(parsePublicWishlistStartParam("profile-user-id")).toBe("user-id");
  });

  it("ignores unsupported Telegram Mini App payloads", () => {
    expect(parsePublicWishlistStartParam("wishlist_user-id")).toBeNull();
    expect(parsePublicWishlistStartParam("profile-")).toBeNull();
  });
});

describe("appHref", () => {
  it("prefixes internal routes with the GitHub Pages base path", () => {
    expect(appHref("/wishlist", "/GiftWishes")).toBe("/GiftWishes/wishlist/");
  });
});

describe("publicAssetHref", () => {
  it("prefixes public asset paths with the GitHub Pages base path", () => {
    expect(publicAssetHref("/gifts/collections/trappedheart/thumb.webp", "/GiftWishes")).toBe("/GiftWishes/gifts/collections/trappedheart/thumb.webp");
  });
});
