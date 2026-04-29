import {
  API_BASE,
  AUTH_TOKEN_STORAGE_KEY,
  NGROK_SKIP_BROWSER_WARNING_HEADER,
  NGROK_SKIP_BROWSER_WARNING_VALUE,
  throwLoggedRequestError
} from "./api";

type TelegramWindow = Partial<Window> & {
  Telegram?: {
    WebApp?: {
      initData?: string;
      ready?: () => void;
      expand?: () => void;
    };
  };
};

type TokenStorage = Pick<Storage, "getItem" | "setItem">;
type AuthFetcher = (input: string, init: RequestInit) => Promise<Pick<Response, "json" | "ok" | "text">>;

type AuthOptions = {
  initData: string | null;
  apiBase?: string;
  fetcher?: AuthFetcher;
  storage?: TokenStorage;
};

export function getTelegramInitData(win: TelegramWindow = window as TelegramWindow) {
  const initData = win.Telegram?.WebApp?.initData;
  return initData && initData.length > 0 ? initData : null;
}

export function prepareTelegramWebApp(win: TelegramWindow = window as TelegramWindow) {
  win.Telegram?.WebApp?.ready?.();
  win.Telegram?.WebApp?.expand?.();
}

export async function authenticateWithTelegram({
  initData,
  apiBase = API_BASE,
  fetcher = fetch as AuthFetcher,
  storage = window.localStorage
}: AuthOptions) {
  const existingToken = storage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (existingToken) {
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

  const result = (await response.json()) as { token: string; user: unknown };
  storage.setItem(AUTH_TOKEN_STORAGE_KEY, result.token);
  return result;
}
