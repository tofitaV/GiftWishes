import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputPath = path.join(rootDir, "apps", "web", "src", "data", "gift-catalog.json");
const baseUrl = "https://gift-satellite.dev/api/gift";
const requestDelayMs = 550;

function parseEnv(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

async function loadToken() {
  if (process.env.GIFT_SATELLITE_TOKEN) return process.env.GIFT_SATELLITE_TOKEN;

  try {
    const env = parseEnv(await readFile(path.join(rootDir, ".env"), "utf8"));
    return env.GIFT_SATELLITE_TOKEN;
  } catch {
    return undefined;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Satellite returned ${response.status} for ${url}`);
  }

  return response.json();
}

function cleanName(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function cleanAttribute(item) {
  const name = cleanName(item?.name);
  if (!name) return null;

  return {
    id: cleanName(item?._id) ?? cleanName(item?.id) ?? name,
    name,
    imageUrl: cleanName(item?.imageUrl) ?? cleanName(item?.image) ?? cleanName(item?.photoUrl) ?? cleanName(item?.thumbnailUrl),
    rarityPermille: typeof item?.rarityPermille === "number" && Number.isFinite(item.rarityPermille) ? item.rarityPermille : null
  };
}

function cleanAttributes(items) {
  if (!Array.isArray(items)) return [];
  return items.map(cleanAttribute).filter(Boolean);
}

async function main() {
  const token = await loadToken();
  if (!token) {
    throw new Error("GIFT_SATELLITE_TOKEN is required in the environment or .env");
  }

  const collections = await fetchJson(`${baseUrl}/collections?premarket=0`, token);
  if (!Array.isArray(collections)) {
    throw new Error("Satellite collections response is not an array");
  }

  const catalogCollections = [];
  for (const [index, collection] of collections.entries()) {
    const name = cleanName(collection?.name);
    if (!name) continue;

    await wait(requestDelayMs);

    let detail = {};
    try {
      detail = await fetchJson(`${baseUrl}/collection/${encodeURIComponent(name)}`, token);
      console.log(`[${index + 1}/${collections.length}] ${name}`);
    } catch (error) {
      console.warn(`[${index + 1}/${collections.length}] ${name}: ${error.message}`);
    }

    catalogCollections.push({
      id: cleanName(collection?._id) ?? cleanName(collection?.id) ?? cleanName(collection?.telegramId) ?? name,
      name,
      telegramId: cleanName(collection?.telegramId),
      imageUrl: cleanName(collection?.imageUrl) ?? cleanName(collection?.image) ?? cleanName(collection?.photoUrl) ?? cleanName(collection?.thumbnailUrl),
      models: cleanAttributes(detail?.models),
      backdrops: cleanAttributes(detail?.backdrops),
      patterns: cleanAttributes(detail?.patterns)
    });
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: "gift-satellite.dev",
    collections: catalogCollections
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Wrote ${catalogCollections.length} collections to ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
