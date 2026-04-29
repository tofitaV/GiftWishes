"use client";

// Wallet flow is temporarily disabled.
// import { useEffect, useState } from "react";
// import { TonConnectButton, useTonAddress } from "@tonconnect/ui-react";
// import { api } from "../../lib/api";
// import { authenticateWithTelegram, getTelegramInitData, prepareTelegramWebApp } from "../../lib/telegram-auth";

export default function WalletPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">Баланс</h1>
          <div className="muted">Раздел временно отключен</div>
        </div>
        {/* <TonConnectButton /> */}
      </header>

      <section className="card">
        <p className="muted">Wallet-интеграция будет добавлена позже.</p>
      </section>
    </main>
  );
}
