"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import type { WishlistItemDto } from "@gift-wishes/shared";
import { GiftPicker, type GiftSelection } from "../components/gift-picker";
import { api } from "../lib/api";
import { GiftCard } from "../components/gift-card";
import { PublicWishlistClient } from "../components/public-wishlist-client";
// import { appHref } from "../lib/routing";
import { parsePublicWishlistStartParam } from "../lib/routing";
import { SLOT_PURCHASE_DISABLED } from "../lib/slot-purchase";
import { authenticateWithTelegram, getTelegramInitData, getTelegramStartParam, prepareTelegramWebApp } from "../lib/telegram-auth";

type MineResponse = {
  limit: number;
  items: WishlistItemDto[];
};

const emptySelection: GiftSelection = {
  collectionName: "",
  modelName: "",
  backdropName: "",
  symbolName: ""
};

export default function HomePage() {
  const [wishlist, setWishlist] = useState<MineResponse>({ limit: 3, items: [] });
  const [selection, setSelection] = useState<GiftSelection>(emptySelection);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAddingGift, setIsAddingGift] = useState(false);

  async function load() {
    try {
      setWishlist(await api<MineResponse>("/wishlist/mine"));
    } catch (err) {
      if (err instanceof Error && err.message.includes("failed 401")) {
        const refreshed = await authenticateWithTelegram({ initData: getTelegramInitData(), forceRefresh: true });
        if (refreshed) {
          setAuthReady(true);
          setWishlist(await api<MineResponse>("/wishlist/mine"));
          return;
        }
      }

      setError(err instanceof Error ? err.message : "Не удалось загрузить wishlist");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const owner = params.get("owner") ?? parsePublicWishlistStartParam(getTelegramStartParam());
    setOwnerId(owner);

    if (owner) {
      setAuthReady(true);
      return;
    }

    prepareTelegramWebApp();
    authenticateWithTelegram({ initData: getTelegramInitData() })
      .then((result) => {
        if (!result) {
          setError("Open the app from the Telegram bot to sign in.");
          return;
        }

        setAuthReady(true);
        void load();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Telegram sign-in failed");
      });
  }, []);

  if (ownerId) {
    return <PublicWishlistClient userId={ownerId} />;
  }

  async function addGift() {
    if (isAddingGift || !selection.collectionName || !selection.modelName) return;

    setIsAddingGift(true);
    setError(null);
    setStatusMessage(null);

    try {
      await authenticateWithTelegram({ initData: getTelegramInitData(), forceRefresh: true });
      await api("/wishlist", {
        method: "POST",
        body: JSON.stringify({
          collectionName: selection.collectionName,
          modelName: selection.modelName,
          backdropName: selection.backdropName || undefined,
          symbolName: selection.symbolName || undefined
        })
      });
      setSelection(emptySelection);
      await load();
      setStatusMessage("Подарок добавлен в список.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить подарок");
    } finally {
      setIsAddingGift(false);
    }
  }

  async function removeGift(id: string) {
    await api(`/wishlist/${id}`, { method: "DELETE" });
    await load();
  }

  async function buySlotStub() {
    await api("/stars/wishlist-slot/stub", { method: "POST" });
    await load();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">Gift Wishes</h1>
          <div className="muted">
            {wishlist.items.length}/{wishlist.limit} слотов
          </div>
        </div>
        {/*
          Wallet UI is temporarily disabled.
          <a className="button secondary" href={appHref("/wallet")}>
            <Wallet size={18} /> Баланс
          </a>
        */}
      </header>

      {error ? <p className="card">{error}</p> : null}
      {statusMessage ? <p className="card success-card">{statusMessage}</p> : null}

      <GiftPicker value={selection} onChange={setSelection} />

      <div className="button-row">
        <button className="button" type="button" onClick={addGift} disabled={!authReady || !selection.collectionName || !selection.modelName || isAddingGift}>
          {isAddingGift ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}
          {isAddingGift ? "Добавляю..." : "Добавить"}
        </button>
        <button className="button secondary" type="button" onClick={buySlotStub} disabled={!authReady || SLOT_PURCHASE_DISABLED}>
          + слот за 50 Stars
        </button>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {wishlist.items.map((item) => (
          <GiftCard key={item.id} item={item} canDelete onDelete={removeGift} />
        ))}
      </div>
    </main>
  );
}
