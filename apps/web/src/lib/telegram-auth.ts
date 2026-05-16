import {
  API_BASE,
  AUTH_TOKEN_STORAGE_KEY,
  NGROK_SKIP_BROWSER_WARNING_HEADER,
  NGROK_SKIP_BROWSER_WARNING_VALUE,
  throwLoggedRequestError
} from "./api";
import { normalizeLanguage, type SupportedLanguage } from "./i18n";

type TelegramWindow = Partial<Window> & {
  Telegram?: {
    WebApp?: {
      initData?: string;
      initDataUnsafe?: {
        start_param?: string;
      };
      ready?: () => void;
      expand?: () => void;
      openInvoice?: (url: string, callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void) => void;
    };
  };
};

type TokenStorage = Pick<Storage, "getItem" | "setItem">;
type AuthFetcher = (input: string, init: RequestInit) => Promise<Pick<Response, "json" | "ok" | "text">>;

type AuthOptions = {
  initData: string | null;
  apiBase?: string;
  fetcher?: AuthFetcher;
  forceRefresh?: boolean;
  storage?: TokenStorage;
};

export type TelegramAuthResult = {
  token: string;
  user?: {
    preferredLanguage?: string | null;
  };
};

export function getTelegramInitData(win: TelegramWindow = window as TelegramWindow) {
  const initData = win.Telegram?.WebApp?.initData;
  return initData && initData.length > 0 ? initData : null;
}

export function getTelegramStartParam(win: TelegramWindow = window as TelegramWindow) {
  const startParam = win.Telegram?.WebApp?.initDataUnsafe?.start_param ?? new URLSearchParams(win.location?.search ?? "").get("tgWebAppStartParam");
  return startParam && startParam.length > 0 ? startParam : null;
}

export function prepareTelegramWebApp(win: TelegramWindow = window as TelegramWindow) {
  win.Telegram?.WebApp?.ready?.();
  win.Telegram?.WebApp?.expand?.();
}

export function openTelegramInvoice(invoiceLink: string, callback: (status: "paid" | "cancelled" | "failed" | "pending") => void, win: TelegramWindow = window as TelegramWindow) {
  if (!win.Telegram?.WebApp?.openInvoice) return false;
  win.Telegram.WebApp.openInvoice(invoiceLink, callback);
  return true;
}

export async function authenticateWithTelegram({
  initData,
  apiBase = API_BASE,
  fetcher = fetch as AuthFetcher,
  forceRefresh = false,
  storage = window.localStorage
}: AuthOptions) {
  const existingToken = storage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (existingToken && !forceRefresh) {
    return { token: existingToken };
  }

  if (!initData) {
    return null;
  }

  const url = `${apiBase}/auth/telegram`;
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [NGROK_SKIP_BROWSER_WARNING_HEADER]: NGROK_SKIP_BROWSER_WARNING_VALUE
    },
    body: JSON.stringify({ initData })
  });

  if (!response.ok) {
    await throwLoggedRequestError("POST", url, response);
  }

  const result = (await response.json()) as TelegramAuthResult;
  storage.setItem(AUTH_TOKEN_STORAGE_KEY, result.token);
  if (result.user?.preferredLanguage) {
    result.user.preferredLanguage = normalizeLanguage(result.user.preferredLanguage) satisfies SupportedLanguage;
  }
  return result;
}
