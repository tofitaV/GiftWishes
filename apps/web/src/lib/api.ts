export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
export const AUTH_TOKEN_STORAGE_KEY = "gift-wishes-token";

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
  const url = `${API_BASE}${path}`;
  const method = options.method ?? "GET";
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    await throwLoggedRequestError(method, url, response);
  }

  return (await response.json()) as T;
}
