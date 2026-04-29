import { describe, expect, it } from "vitest";
import { filterBySearch, findCatalogCollection, normalizeAttributes, normalizeCatalog, normalizeCollections } from "./gift-picker-data";

describe("normalizeCollections", () => {
  it("keeps Satellite collection names and optional media/price fields", () => {
    expect(
      normalizeCollections([
        {
          _id: "1",
          name: "Pool Float",
          telegramId: "tg-1",
          imageUrl: "https://cdn.example/pool.png",
          floorPrice: 2.94
        }
      ])
    ).toEqual([
      {
        id: "1",
        name: "Pool Float",
        imageUrl: "https://cdn.example/pool.png",
        price: "2.94"
      }
    ]);
  });
});

describe("normalizeAttributes", () => {
  it("normalizes models and backdrops from collection details", () => {
    expect(normalizeAttributes([{ name: "Luxury Yacht", rarityPermille: 5 }])).toEqual([
      {
        id: "Luxury Yacht",
        name: "Luxury Yacht",
        imageUrl: null,
        rarityPermille: 5
      }
    ]);
  });
});

describe("filterBySearch", () => {
  it("filters locally by name without requiring remote search calls", () => {
    const items = [{ name: "Pool Float" }, { name: "Heart Locket" }];

    expect(filterBySearch(items, "pool")).toEqual([{ name: "Pool Float" }]);
  });
});

describe("normalizeCatalog", () => {
  it("keeps collection details locally for frontend-only search and selection", () => {
    const catalog = normalizeCatalog({
      collections: [
        {
          _id: "collection-1",
          name: "Pool Float",
          telegramId: "tg-1",
          models: [{ name: "Luxury Yacht", rarityPermille: 5 }],
          backdrops: [{ name: "Cobalt Blue", rarityPermille: 10 }],
          patterns: [{ name: "Paw Print", rarityPermille: 1 }]
        }
      ]
    });

    expect(findCatalogCollection(catalog, "Pool Float")).toEqual({
      id: "collection-1",
      name: "Pool Float",
      imageUrl: null,
      price: null,
      telegramId: "tg-1",
      models: [{ id: "Luxury Yacht", name: "Luxury Yacht", imageUrl: null, rarityPermille: 5 }],
      backdrops: [{ id: "Cobalt Blue", name: "Cobalt Blue", imageUrl: null, rarityPermille: 10 }],
      patterns: [{ id: "Paw Print", name: "Paw Print", imageUrl: null, rarityPermille: 1 }]
    });
  });
});
