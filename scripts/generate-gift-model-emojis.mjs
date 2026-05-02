import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const channelUrl = "https://t.me/s/GiftChangesModels";
const outputPath = resolve("apps/api/src/modules/bot/gift-model-emojis.generated.ts");

const entriesByKey = new Map();

for await (const html of fetchChannelPages(channelUrl)) {
  for (const entry of parseGiftModelEmojiPosts(html)) {
    const key = createGiftModelEmojiKey(entry.collectionName, entry.modelName);
    if (!entriesByKey.has(key)) {
      entriesByKey.set(key, entry);
    }
  }
}

const entries = [...entriesByKey.values()].sort((left, right) => {
  const byCollection = left.collectionName.localeCompare(right.collectionName, "en");
  return byCollection || left.modelName.localeCompare(right.modelName, "en");
});

const source = `import type { GiftModelEmoji } from "./gift-model-emojis.js";

export const giftModelEmojiEntries: GiftModelEmoji[] = ${JSON.stringify(entries, null, 2)};
`;

await writeFile(outputPath, source, "utf8");
console.log(`Generated ${entries.length} gift model emoji entries at ${outputPath}`);

async function* fetchChannelPages(startUrl) {
  const seenUrls = new Set();
  let url = startUrl;

  while (url && !seenUrls.has(url)) {
    seenUrls.add(url);
    console.log(`Fetching ${url}`);

    const response = await fetch(url, {
      headers: {
        "user-agent": "GiftWishesEmojiGenerator/1.0"
      }
    });
    if (!response.ok) {
      throw new Error(`Telegram returned ${response.status} for ${url}`);
    }

    const html = await response.text();
    yield html;

    const prevMatch = html.match(/rel="prev"\s+href="([^"]+)"/);
    if (!prevMatch) break;
    url = new URL(prevMatch[1], startUrl).toString();
  }
}

function parseGiftModelEmojiPosts(html) {
  const entries = [];
  const messagePattern = /<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/g;
  let messageMatch;

  while ((messageMatch = messagePattern.exec(html))) {
    const messageHtml = messageMatch[1] ?? "";
    const collectionMatch = messageHtml.match(/<b>([\s\S]*?)<\/b>\s+Models\b/i);
    if (!collectionMatch) continue;

    const collectionName = decodeHtml(stripTags(collectionMatch[1] ?? ""));
    if (!collectionName) continue;

    const modelListHtml = messageHtml.slice(Math.max(0, messageHtml.search(/<br\s*\/?><br\s*\/?>/i)));
    const modelPattern = /<tg-emoji\s+emoji-id="(\d+)"[^>]*>((?:(?!<tg-emoji).)*?)<\/tg-emoji>\s*<code>([\s\S]*?)<\/code>/g;
    let modelMatch;

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

function createGiftModelEmojiKey(collectionName, modelName) {
  return `${normalizeGiftModelName(collectionName)}\u0000${normalizeGiftModelName(modelName)}`;
}

function normalizeGiftModelName(value) {
  return value.normalize("NFKC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "");
}

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}
