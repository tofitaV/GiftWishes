import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
// import { TonConnectProvider } from "../components/ton-connect-provider";

export const metadata: Metadata = {
  title: "Gift Wishes",
  description: "Telegram gift wishlist Mini App"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body>
        {/*
          Wallet integration is temporarily disabled.
          <TonConnectProvider>{children}</TonConnectProvider>
        */}
        {children}
      </body>
    </html>
  );
}
