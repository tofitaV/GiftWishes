const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function appBasePath() {
  return configuredBasePath.replace(/\/$/, "");
}

export function publicWishlistHref(userId: string, basePath = appBasePath()) {
  const prefix = basePath ? `${basePath}/` : "/";
  return `${prefix}?${new URLSearchParams({ owner: userId }).toString()}`;
}

export function appHref(path: string, basePath = appBasePath()) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const withTrailingSlash = normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`;
  return `${basePath}${withTrailingSlash}`;
}
