export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
export const AUTH_TOKEN_STORAGE_KEY = "gift-wishes-token";
export const NGROK_SKIP_BROWSER_WARNING_HEADER = "ngrok-skip-browser-warning";
export const NGROK_SKIP_BROWSER_WARNING_VALUE = "69420";
export const TELEGRAM_INIT_DATA_HEADER = "x-telegram-init-data";

type ResponseLike = Pick<Response, "ok" | "text"> & {
  status?: number;
  statusText?: string;
};

export async function throwLoggedRequestError(method: string, url: string, response: ResponseLike): Promise<never> {
  const body = await response.text();
  const status = response.status ?? 0;
  const statusText = response.statusText ?? "";

  console.error("API request failed", {
    method,
    url,
    status,
    statusText,
    body
  });

  throw new Error(`${method} ${url} failed ${status} ${statusText}: ${body}`.trim());
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) : null;
  const telegramInitData =
    typeof window !== "undefined" && "Telegram" in window
      ? (window as Partial<Window> & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData
      : null;
  const url = `${API_BASE}${path}`;
  const method = options.method ?? "GET";
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      [NGROK_SKIP_BROWSER_WARNING_HEADER]: NGROK_SKIP_BROWSER_WARNING_VALUE,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(telegramInitData ? { [TELEGRAM_INIT_DATA_HEADER]: telegramInitData } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    await throwLoggedRequestError(method, url, response);
  }

  return (await response.json()) as T;
}
