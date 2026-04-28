import "./globals.css";
import type { Metadata } from "next";
import { TonConnectProvider } from "../components/ton-connect-provider";

export const metadata: Metadata = {
  title: "Gift Wishes",
  description: "Telegram gift wishlist Mini App"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <TonConnectProvider>{children}</TonConnectProvider>
      </body>
    </html>
  );
}

