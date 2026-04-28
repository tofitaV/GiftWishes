"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { appHref } from "../lib/routing";

export function TonConnectProvider({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={appHref("/tonconnect-manifest.json")}>
      {children}
    </TonConnectUIProvider>
  );
}
