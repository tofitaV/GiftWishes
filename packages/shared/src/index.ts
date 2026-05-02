export const FREE_WISHLIST_SLOTS = 1;
export const EXTRA_WISHLIST_SLOT_PRICE_STARS = 50;
export const TELEGRAM_MARKET_TRANSFER_FEE_STARS = 25;
export const NANO_TON = 1_000_000_000n;

export const SUPPORTED_MARKETS = ["telegram", "portals", "tonnel", "mrkt", "getgems"] as const;
export type SupportedMarket = (typeof SUPPORTED_MARKETS)[number];

export const MARKETS_REQUIRING_TELEGRAM_TRANSFER_FEE: SupportedMarket[] = ["telegram", "mrkt"];
export const MARKETS_WITH_SATELLITE_DELIVERY: SupportedMarket[] = ["portals", "tonnel"];

export type WishlistItemDto = {
  id: string;
  ownerUserId: string;
  collectionName: string;
  modelName: string;
  backdropName: string | null;
  symbolName: string | null;
  sourceUrl: string | null;
  createdAt: string;
};

export type GiftListingDto = {
  market: SupportedMarket;
  slug: string;
  giftId: string;
  collectionName: string;
  modelName: string;
  backdropName: string | null;
  symbolName: string | null;
  normalizedPrice: number;
  originalPrice: string;
  currency: string;
  link?: string;
  isCraftable?: boolean;
};

export type PublicWishlistDto = {
  owner: {
    id: string;
    username: string;
    firstName: string | null;
  };
  items: WishlistItemDto[];
};

export function tonToNanoString(ton: number): string {
  if (!Number.isFinite(ton) || ton < 0) {
    throw new Error("Invalid TON amount");
  }
  return BigInt(Math.round(ton * Number(NANO_TON))).toString();
}

export function nanoStringToTon(nano: string): number {
  return Number(BigInt(nano)) / Number(NANO_TON);
}
