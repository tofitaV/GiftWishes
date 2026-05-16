"use client";

import { useEffect, useState } from "react";
import type { PublicWishlistDto } from "@gift-wishes/shared";
import { GiftCard } from "./gift-card";
import { LanguageSelector } from "./language-selector";
import { api } from "../lib/api";
import { DEFAULT_LANGUAGE, normalizeLanguage, t, type SupportedLanguage } from "../lib/i18n";
import { authenticateWithTelegram, getTelegramInitData, prepareTelegramWebApp } from "../lib/telegram-auth";

export function PublicWishlistClient({ userId }: { userId: string }) {
  const [wishlist, setWishlist] = useState<PublicWishlistDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    prepareTelegramWebApp();
    authenticateWithTelegram({ initData: getTelegramInitData() })
      .then((result) => {
        setAuthReady(Boolean(result));
        setLanguage(normalizeLanguage(result?.user?.preferredLanguage));
      })
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : (t(language, "telegramSignInFailed") as string)));

    api<PublicWishlistDto>(`/wishlist/public/${userId}`)
      .then(setWishlist)
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : (t(language, "wishlistNotFound") as string)));
  }, [userId]);

  async function changeLanguage(nextLanguage: SupportedLanguage) {
    setLanguage(nextLanguage);
    if (authReady) {
      await api("/auth/me/language", {
        method: "PATCH",
        body: JSON.stringify({ language: nextLanguage })
      });
    }
  }

  async function buy(itemId: string) {
    if (!authReady) {
      setMessage(t(language, "telegramBuyAuth") as string);
      return;
    }

    const quote = await api<{ cheapest: { slug: string; normalizedPrice: number } | null }>(`/purchase/quote/${itemId}`, { method: "POST" });
    if (!quote.cheapest) {
      setMessage(t(language, "giftUnavailable") as string);
      return;
    }
    await api(`/purchase/confirm/${itemId}`, {
      method: "POST",
      body: JSON.stringify({ listingSlug: quote.cheapest.slug })
    });
    setMessage((t(language, "purchaseSent") as (price: number) => string)(quote.cheapest.normalizedPrice));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">{wishlist ? `Wishlist @${wishlist.owner.username}` : "Gift Wishes"}</h1>
          <div className="muted">{t(language, "publicSubtitle") as string}</div>
        </div>
        <LanguageSelector language={language} onChange={changeLanguage} />
      </header>
      {message ? <p className="card">{message}</p> : null}
      <div className="grid">
        {wishlist?.items.map((item) => (
          <GiftCard key={item.id} item={item} onBuy={buy} language={language} />
        ))}
      </div>
    </main>
  );
}
