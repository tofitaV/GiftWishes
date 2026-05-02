export type TelegramNftGift = {
  collectionName: string;
  modelName: string;
  backdropName?: string;
  symbolName?: string;
  sourceUrl?: string;
};

type AddTelegramNftGiftOptions<T> = {
  text: string;
  fetchHtml: (url: string) => Promise<string>;
  createWishlistItem: (input: TelegramNftGift) => Promise<T>;
};

export function extractTelegramNftUrl(text: string) {
  const match = text.match(/https?:\/\/t\.me\/nft\/([A-Za-z0-9_-]+-\d+)\b/i);
  return match ? `https://t.me/nft/${match[1]}` : null;
}

export function parseTelegramNftGift(html: string, url: string): TelegramNftGift {
  const title = metaContent(html, "og:title") ?? "";
  const description = metaContent(html, "og:description") ?? metaContent(html, "twitter:description") ?? "";
  const fields = parseDescriptionFields(description);
  const collectionName = collectionFromTitle(title) ?? collectionFromUrl(url);

  if (!collectionName || !fields.Model) {
    throw new Error("Telegram NFT metadata is incomplete");
  }

  return {
    collectionName,
    modelName: fields.Model,
    backdropName: fields.Backdrop,
    symbolName: fields.Symbol
  };
}

export async function addTelegramNftGiftFromMessage<T>({ text, fetchHtml, createWishlistItem }: AddTelegramNftGiftOptions<T>) {
  const url = extractTelegramNftUrl(text);
  if (!url) return null;

  const html = await fetchHtml(url);
  const gift = parseTelegramNftGift(html, url);
  return createWishlistItem({ ...gift, sourceUrl: url });
}

function metaContent(html: string, property: string) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${escapedProperty}["'][^>]*content=["']([\\s\\S]*?)["'][^>]*>`, "i");
  const match = html.match(regex);
  return match?.[1] ? decodeHtml(match[1]).trim() : null;
}

function parseDescriptionFields(description: string) {
  const fields: Record<string, string> = {};
  for (const line of description.split(/\r?\n/)) {
    const match = line.match(/^\s*(Model|Backdrop|Symbol):\s*(.+?)\s*$/i);
    if (!match) continue;
    fields[toTitleCase(match[1])] = stripRarity(match[2]);
  }
  return fields;
}

function collectionFromTitle(title: string) {
  const match = title.match(/^(.+?)\s+#\d+\s*$/);
  return match?.[1]?.trim() || null;
}

function collectionFromUrl(url: string) {
  const match = url.match(/\/nft\/([A-Za-z0-9_]+)-\d+\b/i);
  if (!match) return "";
  return splitCompactName(match[1]);
}

function splitCompactName(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();
}

function stripRarity(value: string) {
  return value.replace(/\s+\d+(?:[.,]\d+)?%\s*$/, "").trim();
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
