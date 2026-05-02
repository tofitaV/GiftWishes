import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const catalogPath = path.join(rootDir, "apps", "web", "src", "data", "gift-catalog.json");
const publicDir = path.join(rootDir, "apps", "web", "public");
const concurrency = Number.parseInt(process.env.GIFT_ASSET_CONCURRENCY ?? "12", 10);
const force = process.argv.includes("--force");

function giftAssetSlug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function satelliteGiftAssetSlug(name) {
  return String(name).replace(/[/\\?%*:|"'<>\u2018-\u201F ]/g, "").toLowerCase();
}

function localCollectionPath(collectionName) {
  return path.join(publicDir, "gifts", "collections", giftAssetSlug(collectionName), "thumb.webp");
}

function localModelPath(collectionName, modelName) {
  return path.join(publicDir, "gifts", "models", satelliteGiftAssetSlug(collectionName), `${satelliteGiftAssetSlug(modelName)}.webp`);
}

function remoteCollectionUrl(collectionName) {
  return `https://fragment.com/file/gifts/${giftAssetSlug(collectionName)}/thumb.webp`;
}

function remoteModelUrl(collectionName, modelName) {
  return encodeURI(`https://gift-satellite.dev/models/${satelliteGiftAssetSlug(collectionName)}/${satelliteGiftAssetSlug(modelName)}.webp`);
}

async function downloadAsset(asset) {
  if (!force && existsSync(asset.filePath)) {
    return { status: "skipped", asset };
  }

  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("image/") && !contentType.includes("octet-stream")) {
    throw new Error(`Unexpected content-type ${contentType || "unknown"}`);
  }

  await mkdir(path.dirname(asset.filePath), { recursive: true });
  await writeFile(asset.filePath, Buffer.from(await response.arrayBuffer()));
  return { status: "downloaded", asset };
}

async function runQueue(assets) {
  let nextIndex = 0;
  let downloaded = 0;
  let skipped = 0;
  const failed = [];

  async function worker() {
    while (nextIndex < assets.length) {
      const asset = assets[nextIndex];
      nextIndex += 1;

      try {
        const result = await downloadAsset(asset);
        if (result.status === "downloaded") downloaded += 1;
        if (result.status === "skipped") skipped += 1;
      } catch (error) {
        failed.push({
          type: asset.type,
          name: asset.name,
          url: asset.url,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      const processed = downloaded + skipped + failed.length;
      if (processed % 100 === 0 || processed === assets.length) {
        console.log(`[${processed}/${assets.length}] downloaded=${downloaded} skipped=${skipped} failed=${failed.length}`);
      }
    }
  }

  const workerCount = Math.max(1, Math.min(Number.isFinite(concurrency) ? concurrency : 12, assets.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return { downloaded, skipped, failed };
}

async function main() {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const collections = Array.isArray(catalog.collections) ? catalog.collections : [];
  const assets = [];

  for (const collection of collections) {
    const collectionName = typeof collection?.name === "string" ? collection.name : null;
    if (!collectionName || !giftAssetSlug(collectionName)) continue;

    assets.push({
      type: "collection",
      name: collectionName,
      url: remoteCollectionUrl(collectionName),
      filePath: localCollectionPath(collectionName)
    });

    const models = Array.isArray(collection.models) ? collection.models : [];
    for (const model of models) {
      const modelName = typeof model?.name === "string" ? model.name : null;
      if (!modelName || !giftAssetSlug(modelName)) continue;

      assets.push({
        type: "model",
        name: `${collectionName} / ${modelName}`,
        url: remoteModelUrl(collectionName, modelName),
        filePath: localModelPath(collectionName, modelName)
      });
    }
  }

  console.log(`Downloading ${assets.length} gift assets with concurrency=${concurrency}`);
  const result = await runQueue(assets);

  if (result.failed.length > 0) {
    console.warn(`Failed to download ${result.failed.length} assets:`);
    for (const failure of result.failed.slice(0, 30)) {
      console.warn(`- ${failure.type} ${failure.name}: ${failure.error} (${failure.url})`);
    }
    if (result.failed.length > 30) {
      console.warn(`...and ${result.failed.length - 30} more`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Done. downloaded=${result.downloaded} skipped=${result.skipped}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
