"use client";

import { ArrowLeft, ChevronRight, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import giftCatalog from "../data/gift-catalog.json";
import {
  filterBySearch,
  findCatalogCollection,
  getAdjacentCatalogCollection,
  normalizeCatalog,
  type GiftAttribute,
  type GiftCatalogCollection,
  type GiftCollection
} from "../lib/gift-picker-data";

export type GiftSelection = {
  collectionName: string;
  modelName: string;
  backdropName: string;
  symbolName: string;
};

type PickerMode = "closed" | "collections" | "models" | "backdrops" | "patterns";

type Props = {
  value: GiftSelection;
  onChange: (value: GiftSelection) => void;
};

const catalogCollections = normalizeCatalog(giftCatalog);

const backdropColors: Record<string, string> = {
  Amber: "#d99a2b",
  Aquamarine: "#55c7bd",
  "Azure Blue": "#4ca2ff",
  Black: "#111318",
  Burgundy: "#8f4057",
  Cappuccino: "#b69a8c",
  Caramel: "#d07a2f",
  "Carrot Juice": "#ed7a44",
  Chestnut: "#8b4b34",
  Chocolate: "#7a4b3c",
  "Cobalt Blue": "#5165dc",
  Copper: "#c47734",
  "Coral Red": "#e45a52",
  Cyberpunk: "#7b42f6",
  "Dark Lilac": "#9b5d88",
  "Desert Sand": "#b8a886",
  "Electric Indigo": "#604dff",
  "Electric Purple": "#b457f0",
  Emerald: "#38b66f",
  Fandango: "#c94e91",
  "French Blue": "#27a5c5",
  Grape: "#7b4fe0",
  "Hunter Green": "#3d7c4b",
  "Indigo Dye": "#3d6f83",
  "Ivory White": "#f3f0e5",
  "Jade Green": "#2ea876",
  "Khaki Green": "#87965b",
  Lavender: "#9a58dc",
  Lemongrass: "#67bf46",
  "Light Olive": "#a8b83d",
  Malachite: "#36b860",
  "Midnight Blue": "#2c3652",
  "Mint Green": "#43bd6f",
  Moonstone: "#62aebb"
};

function emptySelection(): GiftSelection {
  return {
    collectionName: "",
    modelName: "",
    backdropName: "",
    symbolName: ""
  };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function collectionSummary(collection: GiftCatalogCollection): GiftCollection {
  return {
    id: collection.id,
    name: collection.name,
    imageUrl: collection.imageUrl,
    price: null
  };
}

function AttributeTile({
  item,
  selected,
  type,
  onClick
}: {
  item: GiftAttribute;
  selected: boolean;
  type: "model" | "backdrop" | "pattern";
  onClick: () => void;
}) {
  const color = type === "backdrop" ? backdropColors[item.name] ?? "#4b4c55" : null;

  return (
    <button className={`attribute-tile${selected ? " selected" : ""}`} type="button" onClick={onClick}>
      <div className="attribute-media" style={color ? { background: color } : undefined}>
        {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span>{type === "backdrop" ? "" : initials(item.name)}</span>}
      </div>
      <span>{item.name}</span>
      {item.rarityPermille !== null ? <small>{item.rarityPermille / 10}%</small> : null}
    </button>
  );
}

export function GiftPicker({ value, onChange }: Props) {
  const [mode, setMode] = useState<PickerMode>("closed");
  const [query, setQuery] = useState("");

  const collections = useMemo(() => catalogCollections.map(collectionSummary), []);
  const selectedCollection = useMemo(() => findCatalogCollection(catalogCollections, value.collectionName), [value.collectionName]);
  const filteredCollections = useMemo(() => filterBySearch(collections, query), [collections, query]);
  const currentItems =
    mode === "models" ? selectedCollection?.models ?? [] : mode === "backdrops" ? selectedCollection?.backdrops ?? [] : mode === "patterns" ? selectedCollection?.patterns ?? [] : [];
  const filteredAttributes = useMemo(() => filterBySearch(currentItems, query), [currentItems, query]);

  function toggleCollections() {
    setMode((currentMode) => (currentMode === "collections" ? "closed" : "collections"));
    setQuery("");
  }

  function selectAdjacentCollection(direction: -1 | 1) {
    const collection = getAdjacentCatalogCollection(catalogCollections, value.collectionName, direction);
    if (!collection) return;

    onChange({ ...emptySelection(), collectionName: collection.name });
    setMode("closed");
    setQuery("");
  }

  function selectCollection(collection: GiftCollection) {
    onChange({ ...emptySelection(), collectionName: collection.name });
    setMode("closed");
    setQuery("");
  }

  function openAttributeMode(nextMode: Exclude<PickerMode, "closed" | "collections">) {
    if (!value.collectionName) return;
    setMode((currentMode) => (currentMode === nextMode ? "closed" : nextMode));
    setQuery("");
  }

  return (
    <section className="card picker-card">
      <div className="picker-title-row">
        <h2 className="card-title">Добавить подарок</h2>
        <span className="muted">Выберите подарок из каталога</span>
      </div>

      <div className="selected-gift-row">
        <button className="icon-button" type="button" aria-label="Предыдущий подарок" onClick={() => selectAdjacentCollection(-1)}>
          <ArrowLeft size={20} />
        </button>
        <button className="selected-gift-button" type="button" onClick={toggleCollections}>
          <span className="gift-chip-media">
            {selectedCollection?.imageUrl ? <img src={selectedCollection.imageUrl} alt="" loading="lazy" /> : value.collectionName ? initials(value.collectionName) : "GW"}
          </span>
          <span>{value.collectionName || "Выбрать подарок"}</span>
        </button>
        <button className="icon-button" type="button" aria-label="Следующий подарок" onClick={() => selectAdjacentCollection(1)}>
          <ChevronRight size={20} />
        </button>
      </div>

      {value.collectionName ? (
        <div className="picker-tabs">
          <button className={value.modelName ? "selected" : ""} type="button" onClick={() => openAttributeMode("models")}>
            {value.modelName || "Все модели"}
          </button>
          <button className={value.backdropName ? "selected" : ""} type="button" onClick={() => openAttributeMode("backdrops")}>
            {value.backdropName || "Все фоны"}
          </button>
          <button className={value.symbolName ? "selected" : ""} type="button" onClick={() => openAttributeMode("patterns")}>
            {value.symbolName || "Все узоры"}
          </button>
        </div>
      ) : null}

      {mode !== "closed" ? (
        <div className="picker-panel">
          <div className="search-row">
            <Search size={18} />
            <input className="search-input" placeholder={mode === "collections" ? "Поиск" : "Поиск..."} value={query} onChange={(event) => setQuery(event.target.value)} />
            {query ? (
              <button className="plain-icon" type="button" aria-label="Очистить поиск" onClick={() => setQuery("")}>
                <X size={18} />
              </button>
            ) : null}
          </div>

          {mode === "collections" ? (
            <div className="collection-grid">
              {filteredCollections.map((collection) => (
                <button className={`collection-tile${value.collectionName === collection.name ? " selected" : ""}`} key={collection.id} type="button" onClick={() => selectCollection(collection)}>
                  <div className="collection-media">{collection.imageUrl ? <img src={collection.imageUrl} alt="" loading="lazy" /> : <span>{initials(collection.name)}</span>}</div>
                  <span>{collection.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="attribute-grid">
              {filteredAttributes.map((item) => (
                <AttributeTile
                  key={item.id}
                  item={item}
                  type={mode === "models" ? "model" : mode === "backdrops" ? "backdrop" : "pattern"}
                  selected={
                    (mode === "models" && value.modelName === item.name) ||
                    (mode === "backdrops" && value.backdropName === item.name) ||
                    (mode === "patterns" && value.symbolName === item.name)
                  }
                  onClick={() => {
                    onChange({
                      ...value,
                      modelName: mode === "models" ? item.name : value.modelName,
                      backdropName: mode === "backdrops" ? item.name : value.backdropName,
                      symbolName: mode === "patterns" ? item.name : value.symbolName
                    });
                    setMode("closed");
                    setQuery("");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
