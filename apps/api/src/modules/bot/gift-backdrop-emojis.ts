import { giftBackdropEmojiEntries } from "./gift-backdrop-emojis.generated.js";

export type GiftBackdropEmoji = {
  backdropName: string;
  emojiId: string;
  fallback: string;
};

const giftBackdropEmojiByKey = new Map(giftBackdropEmojiEntries.map((entry) => [normalizeGiftBackdropName(entry.backdropName), entry]));

export function lookupGiftBackdropEmoji(backdropName: string) {
  return giftBackdropEmojiByKey.get(normalizeGiftBackdropName(backdropName)) ?? null;
}

function normalizeGiftBackdropName(value: string) {
  return value.normalize("NFKC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}
