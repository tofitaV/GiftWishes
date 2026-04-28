import { throwLoggedRequestError } from "./request-error";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
export const AUTH_TOKEN_STORAGE_KEY = "gift-wishes-token";

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
