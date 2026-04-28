"use client";

import { useEffect, useState } from "react";
import { TonConnectButton, useTonAddress } from "@tonconnect/ui-react";
import { api } from "../../lib/api";
import { authenticateWithTelegram, getTelegramInitData, prepareTelegramWebApp } from "../../lib/telegram-auth";

export default function WalletPage() {
  const address = useTonAddress();
  const [amountNano, setAmountNano] = useState("");
  const [txHash, setTxHash] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    prepareTelegramWebApp();
    authenticateWithTelegram({ initData: getTelegramInitData() })
      .then((result) => setAuthReady(Boolean(result)))
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Telegram sign-in failed"));
  }, []);

  async function connect() {
    if (!address) return;
    await api("/wallet/connect", { method: "POST", body: JSON.stringify({ address }) });
    setMessage("Кошелёк подключён");
  }

  async function confirmDeposit() {
    await api("/wallet/deposit/confirm", { method: "POST", body: JSON.stringify({ amountNano, txHash }) });
    setMessage("Депозит подтверждён, split 50/50 поставлен в очередь");
  }

  async function withdraw() {
    await api("/wallet/withdraw", { method: "POST", body: JSON.stringify({ amountNano }) });
    setMessage("Заявка на вывод создана");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">Баланс</h1>
          <div className="muted">TON Connect и вывод средств</div>
        </div>
        <TonConnectButton />
      </header>

      {message ? <p className="card">{message}</p> : null}

      <section className="card">
        <button className="button" type="button" onClick={connect} disabled={!address || !authReady}>
          Привязать кошелёк
        </button>
        <div className="form">
          <label className="field">
            <span className="muted">Сумма в nanoTON</span>
            <input className="input" value={amountNano} onChange={(e) => setAmountNano(e.target.value)} />
          </label>
          <label className="field">
            <span className="muted">Tx hash для депозита</span>
            <input className="input" value={txHash} onChange={(e) => setTxHash(e.target.value)} />
          </label>
        </div>
        <div className="button-row">
          <button className="button" type="button" onClick={confirmDeposit} disabled={!authReady}>
            Подтвердить депозит
          </button>
          <button className="button secondary" type="button" onClick={withdraw} disabled={!authReady}>
            Вывести
          </button>
        </div>
      </section>
    </main>
  );
}
