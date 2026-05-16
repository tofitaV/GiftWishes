"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import type { WishlistItemDto } from "@gift-wishes/shared";
import { GiftPicker, type GiftSelection } from "../components/gift-picker";
import { api } from "../lib/api";
import { GiftCard } from "../components/gift-card";
import { LanguageSelector } from "../components/language-selector";
import { PublicWishlistClient } from "../components/public-wishlist-client";
// import { appHref } from "../lib/routing";
import { parsePublicWishlistStartParam } from "../lib/routing";
import { SLOT_PURCHASE_DISABLED } from "../lib/slot-purchase";
import { DEFAULT_LANGUAGE, normalizeLanguage, t, type SupportedLanguage } from "../lib/i18n";
import { authenticateWithTelegram, getTelegramInitData, getTelegramStartParam, openTelegramInvoice, prepareTelegramWebApp, storePreferredLanguage } from "../lib/telegram-auth";

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
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);

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

        setError(err instanceof Error ? err.message : (t(language, "loadWishlistFailed") as string));
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
          setError(t(language, "openFromTelegram") as string);
          return;
        }

        setLanguage(normalizeLanguage(result.user?.preferredLanguage));
        setAuthReady(true);
        void load();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : (t(language, "telegramSignInFailed") as string));
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
      setStatusMessage(t(language, "giftAdded") as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : (t(language, "addGiftFailed") as string));
    } finally {
      setIsAddingGift(false);
    }
  }

  async function removeGift(id: string) {
    await api(`/wishlist/${id}`, { method: "DELETE" });
    await load();
  }

  async function changeLanguage(nextLanguage: SupportedLanguage) {
    setLanguage(nextLanguage);
    storePreferredLanguage(nextLanguage);
    if (authReady) {
      await api("/auth/me/language", {
        method: "PATCH",
        body: JSON.stringify({ language: nextLanguage })
      });
    }
  }

  async function buySlot() {
    const invoice = await api<{ invoiceLink: string; paymentId: string }>("/stars/wishlist-slot/invoice", {
      method: "POST",
      body: JSON.stringify({ language })
    });

    const opened = openTelegramInvoice(invoice.invoiceLink, (status) => {
      if (status === "paid") {
        setStatusMessage(t(language, "slotPaid") as string);
        window.setTimeout(() => void load(), 1000);
        return;
      }
      if (status === "cancelled" || status === "failed") {
        setStatusMessage(t(language, "slotCancelled") as string);
      }
    });
    if (!opened) {
      setError(t(language, "slotInvoiceUnavailable") as string);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">Gift Wishes</h1>
          <div className="muted">
            {wishlist.items.length}/{wishlist.limit} {t(language, "slots") as string}
          </div>
        </div>
        <LanguageSelector language={language} onChange={changeLanguage} />
        {/*
          Wallet UI is temporarily disabled.
          <a className="button secondary" href={appHref("/wallet")}>
            <Wallet size={18} /> Баланс
          </a>
        */}
      </header>

      {error ? <p className="card">{error}</p> : null}
      {statusMessage ? <p className="card success-card">{statusMessage}</p> : null}

      <GiftPicker value={selection} onChange={setSelection} language={language} />

      <div className="button-row">
        <button className="button" type="button" onClick={addGift} disabled={!authReady || !selection.collectionName || !selection.modelName || isAddingGift}>
          {isAddingGift ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}
          {isAddingGift ? (t(language, "addingGift") as string) : (t(language, "addGift") as string)}
        </button>
        <button className="button secondary" type="button" onClick={buySlot} disabled={!authReady || SLOT_PURCHASE_DISABLED}>
          {t(language, "buySlot") as string}
        </button>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {wishlist.items.map((item) => (
          <GiftCard key={item.id} item={item} canDelete onDelete={removeGift} language={language} />
        ))}
      </div>
    </main>
  );
}
