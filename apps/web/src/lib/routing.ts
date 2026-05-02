const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const publicWishlistStartPrefix = "profile-";

export function appBasePath() {
  return configuredBasePath.replace(/\/$/, "");
}

export function publicWishlistHref(userId: string, basePath = appBasePath()) {
  const prefix = basePath ? `${basePath}/` : "/";
  return `${prefix}?${new URLSearchParams({ owner: userId }).toString()}`;
}

export function parsePublicWishlistStartParam(startParam: string | null | undefined) {
  if (!startParam?.startsWith(publicWishlistStartPrefix)) return null;

  const ownerUserId = startParam.slice(publicWishlistStartPrefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(ownerUserId)) return null;
  return ownerUserId;
}

export function appHref(path: string, basePath = appBasePath()) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const withTrailingSlash = normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`;
  return `${basePath}${withTrailingSlash}`;
}

export function publicAssetHref(path: string | null, basePath = appBasePath()) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}
