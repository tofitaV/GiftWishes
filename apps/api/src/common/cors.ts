const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "https://tofitav.github.io",
  "https://gift-wishes-api.vercel.app"
];

function normalizeOrigin(origin: string) {
  return new URL(origin.trim()).origin;
}

export function buildAllowedOrigins(configuredOrigins = "") {
  const allowedOrigins = new Set(DEFAULT_ALLOWED_ORIGINS);

  for (const origin of configuredOrigins.split(",")) {
    const trimmedOrigin = origin.trim();
    if (!trimmedOrigin) continue;

    allowedOrigins.add(trimmedOrigin.replace(/\/$/, ""));
    allowedOrigins.add(normalizeOrigin(trimmedOrigin));
  }

  return allowedOrigins;
}
