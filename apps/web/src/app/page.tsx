"use client";

import { useEffect, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import type { WishlistItemDto } from "@gift-wishes/shared";
import { api } from "../lib/api";
import { GiftCard } from "../components/gift-card";
import { PublicWishlistClient } from "../components/public-wishlist-client";
import { appHref } from "../lib/routing";
import { authenticateWithTelegram, getTelegramInitData, prepareTelegramWebApp } from "../lib/telegram-auth";

type MineResponse = {
  limit: number;
  items: WishlistItemDto[];
};

export default function HomePage() {
  const [wishlist, setWishlist] = useState<MineResponse>({ limit: 1, items: [] });
  const [form, setForm] = useState({ collectionName: "", modelName: "", backdropName: "" });
  const [error, setError] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  async function load() {
    try {
      setWishlist(await api<MineResponse>("/wishlist/mine"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить wishlist");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const owner = params.get("owner");
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
    await api("/wishlist", {
      method: "POST",
      body: JSON.stringify({
        collectionName: form.collectionName,
        modelName: form.modelName,
        backdropName: form.backdropName || undefined
      })
    });
    setForm({ collectionName: "", modelName: "", backdropName: "" });
    await load();
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
        <a className="button secondary" href={appHref("/wallet")}>
          <Wallet size={18} /> Баланс
        </a>
      </header>

      {error ? <p className="card">{error}</p> : null}

      <section className="card">
        <h2 className="card-title">Добавить подарок</h2>
        <div className="form">
          <label className="field">
            <span className="muted">Коллекция</span>
            <input className="input" value={form.collectionName} onChange={(e) => setForm({ ...form, collectionName: e.target.value })} />
          </label>
          <label className="field">
            <span className="muted">Модель</span>
            <input className="input" value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} />
          </label>
          <label className="field">
            <span className="muted">Фон, можно пусто</span>
            <input className="input" value={form.backdropName} onChange={(e) => setForm({ ...form, backdropName: e.target.value })} />
          </label>
        </div>
        <div className="button-row">
          <button className="button" type="button" onClick={addGift} disabled={!authReady}>
            <Plus size={18} /> Добавить
          </button>
          <button className="button secondary" type="button" onClick={buySlotStub} disabled={!authReady}>
            + слот за 50 Stars
          </button>
        </div>
      </section>

      <div className="grid" style={{ marginTop: 12 }}>
        {wishlist.items.map((item) => (
          <GiftCard key={item.id} item={item} canDelete onDelete={removeGift} />
        ))}
      </div>
    </main>
  );
}
