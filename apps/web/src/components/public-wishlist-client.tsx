"use client";

import { useEffect, useState } from "react";
import type { PublicWishlistDto } from "@gift-wishes/shared";
import { GiftCard } from "./gift-card";
import { api } from "../lib/api";
import { authenticateWithTelegram, getTelegramInitData, prepareTelegramWebApp } from "../lib/telegram-auth";

export function PublicWishlistClient({ userId }: { userId: string }) {
  const [wishlist, setWishlist] = useState<PublicWishlistDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    prepareTelegramWebApp();
    authenticateWithTelegram({ initData: getTelegramInitData() })
      .then((result) => setAuthReady(Boolean(result)))
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Telegram sign-in failed"));

    api<PublicWishlistDto>(`/wishlist/public/${userId}`)
      .then(setWishlist)
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Wishlist не найден"));
  }, [userId]);

  async function buy(itemId: string) {
    if (!authReady) {
      setMessage("Open the wishlist from Telegram to buy a gift.");
      return;
    }

    const quote = await api<{ cheapest: { slug: string; normalizedPrice: number } | null }>(`/purchase/quote/${itemId}`, { method: "POST" });
    if (!quote.cheapest) {
      setMessage("Подарок сейчас не найден на маркетах");
      return;
    }
    await api(`/purchase/confirm/${itemId}`, {
      method: "POST",
      body: JSON.stringify({ listingSlug: quote.cheapest.slug })
    });
    setMessage(`Покупка отправлена: ${quote.cheapest.normalizedPrice} TON`);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">{wishlist ? `Wishlist @${wishlist.owner.username}` : "Gift Wishes"}</h1>
          <div className="muted">Подарки, которые можно купить</div>
        </div>
      </header>
      {message ? <p className="card">{message}</p> : null}
      <div className="grid">
        {wishlist?.items.map((item) => (
          <GiftCard key={item.id} item={item} onBuy={buy} />
        ))}
      </div>
    </main>
  );
}
