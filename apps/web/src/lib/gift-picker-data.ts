export type GiftCollection = {
  id: string;
  name: string;
  imageUrl: string | null;
  price: string | null;
};

export type GiftAttribute = {
  id: string;
  name: string;
  imageUrl: string | null;
  rarityPermille: number | null;
};

export type GiftCatalogCollection = GiftCollection & {
  telegramId: string | null;
  models: GiftAttribute[];
  backdrops: GiftAttribute[];
  patterns: GiftAttribute[];
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function firstString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstNumber(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function giftAssetSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function satelliteGiftAssetSlug(name: string) {
  return name.replace(/[/\\?%*:|"'<>\u2018-\u201F ]/g, "").toLowerCase();
}

export function localGiftCollectionImagePath(collectionName: string) {
  return `/gifts/collections/${giftAssetSlug(collectionName)}/thumb.webp`;
}

export function localGiftModelImagePath(collectionName: string, modelName: string) {
  return `/gifts/models/${satelliteGiftAssetSlug(collectionName)}/${satelliteGiftAssetSlug(modelName)}.webp`;
}

export function normalizeCollections(input: unknown): GiftCollection[] {
  return (Array.isArray(input) ? input : []).flatMap((item) => {
    const record = asRecord(item);
    const name = firstString(record, ["name", "collectionName"]);
    if (!name) return [];

    return {
      id: firstString(record, ["_id", "id", "telegramId"]) ?? name,
      name,
      imageUrl: firstString(record, ["imageUrl", "image", "photoUrl", "thumbnailUrl", "iconUrl"]),
      price: firstString(record, ["floorPrice", "minPrice", "price", "normalizedPrice"])
    };
  });
}

export function normalizeAttributes(input: unknown): GiftAttribute[] {
  return (Array.isArray(input) ? input : []).flatMap((item) => {
    const record = asRecord(item);
    const name = firstString(record, ["name", "modelName", "backdropName", "symbolName"]);
    if (!name) return [];

    return {
      id: firstString(record, ["_id", "id", "telegramId"]) ?? name,
      name,
      imageUrl: firstString(record, ["imageUrl", "image", "photoUrl", "thumbnailUrl", "iconUrl"]),
      rarityPermille: firstNumber(record, ["rarityPermille", "rarity"])
    };
  });
}

export function normalizeCatalog(input: unknown): GiftCatalogCollection[] {
  const record = asRecord(input);
  const collections = Array.isArray(record.collections) ? record.collections : [];

  return collections.flatMap((item) => {
    const collection = asRecord(item);
    const normalized = normalizeCollections([collection])[0];
    if (!normalized) return [];

    return {
      ...normalized,
      telegramId: firstString(collection, ["telegramId"]),
      imageUrl: localGiftCollectionImagePath(normalized.name),
      models: normalizeAttributes(collection.models).map((model) => ({
        ...model,
        imageUrl: localGiftModelImagePath(normalized.name, model.name)
      })),
      backdrops: normalizeAttributes(collection.backdrops),
      patterns: normalizeAttributes(collection.patterns)
    };
  });
}

export function findCatalogCollection(collections: GiftCatalogCollection[], collectionName: string): GiftCatalogCollection | null {
  return collections.find((collection) => collection.name === collectionName) ?? null;
}

export function getAdjacentCatalogCollection(collections: GiftCatalogCollection[], collectionName: string, direction: -1 | 1): GiftCatalogCollection | null {
  if (collections.length === 0) return null;

  const currentIndex = collections.findIndex((collection) => collection.name === collectionName);
  if (currentIndex === -1) {
    return direction === 1 ? collections[0] : collections[collections.length - 1];
  }

  const nextIndex = (currentIndex + direction + collections.length) % collections.length;
  return collections[nextIndex];
}

export function filterBySearch<T extends { name: string }>(items: T[], query: string): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return items;
  return items.filter((item) => item.name.toLocaleLowerCase().includes(normalizedQuery));
}

export function findWishlistGiftImageUrl(collections: GiftCatalogCollection[], collectionName: string, modelName: string): string | null {
  const collection = findCatalogCollection(collections, collectionName);
  if (!collection) return null;

  return collection.models.find((model) => model.name === modelName)?.imageUrl ?? collection.imageUrl;
}
