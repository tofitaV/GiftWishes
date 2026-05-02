import { giftModelEmojiEntries } from "./gift-model-emojis.generated.js";

export type GiftModelEmoji = {
  collectionName: string;
  modelName: string;
  emojiId: string;
  fallback: string;
};

const giftModelEmojiByKey = new Map(giftModelEmojiEntries.map((entry) => [createGiftModelEmojiKey(entry.collectionName, entry.modelName), entry]));

export function lookupGiftModelEmoji(collectionName: string, modelName: string) {
  return giftModelEmojiByKey.get(createGiftModelEmojiKey(collectionName, modelName)) ?? null;
}

export function formatGiftModelEmojiHtml(collectionName: string, modelName: string) {
  const entry = lookupGiftModelEmoji(collectionName, modelName);
  if (!entry) return "";

  return `<tg-emoji emoji-id="${entry.emojiId}">${escapeTelegramHtml(entry.fallback)}</tg-emoji>`;
}

export function parseGiftModelEmojiPosts(html: string): GiftModelEmoji[] {
  const entries: GiftModelEmoji[] = [];
  const messagePattern = /<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/g;
  let messageMatch: RegExpExecArray | null;

  while ((messageMatch = messagePattern.exec(html))) {
    const messageHtml = messageMatch[1] ?? "";
    const collectionMatch = messageHtml.match(/<b>([\s\S]*?)<\/b>\s+Models\b/i);
    if (!collectionMatch) continue;

    const collectionName = decodeHtml(stripTags(collectionMatch[1] ?? ""));
    if (!collectionName) continue;

    const modelListHtml = messageHtml.slice(Math.max(0, messageHtml.search(/<br\s*\/?><br\s*\/?>/i)));
    const modelPattern = /<tg-emoji\s+emoji-id="(\d+)"[^>]*>((?:(?!<tg-emoji).)*?)<\/tg-emoji>\s*<code>([\s\S]*?)<\/code>/g;
    let modelMatch: RegExpExecArray | null;

    while ((modelMatch = modelPattern.exec(modelListHtml))) {
      const emojiId = modelMatch[1] ?? "";
      const fallback = decodeHtml(stripTags(modelMatch[2] ?? "")).trim();
      const modelName = decodeHtml(stripTags(modelMatch[3] ?? ""));

      if (!emojiId || !fallback || !modelName) continue;
      entries.push({ collectionName, modelName, emojiId, fallback });
    }
  }

  return entries;
}

export function createGiftModelEmojiKey(collectionName: string, modelName: string) {
  return `${normalizeGiftModelName(collectionName)}\u0000${normalizeGiftModelName(modelName)}`;
}

function normalizeGiftModelName(value: string) {
  return value.normalize("NFKC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
