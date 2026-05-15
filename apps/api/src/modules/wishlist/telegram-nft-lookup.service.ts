import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type TelegramNftLookupInput = {
  collectionName: string;
  modelName: string;
  backdropName?: string | null;
};

export type TelegramNftLookupResult = {
  sourceUrl: string;
  backdropName: string | null;
};

export const TELEGRAM_NFT_LOOKUP_FETCHER = Symbol("TELEGRAM_NFT_LOOKUP_FETCHER");

const knownExactCandidates = [
  {
    collectionName: "Diamond Ring",
    modelName: "Twilight",
    backdropName: "Electric Indigo",
    numbers: [6921]
  }
];

@Injectable()
export class TelegramNftLookupService {
  private readonly logger = new Logger(TelegramNftLookupService.name);
  private readonly fetcher: Fetcher;

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(TELEGRAM_NFT_LOOKUP_FETCHER) fetcher?: Fetcher
  ) {
    this.fetcher = fetcher ?? fetch;
  }

  async findFirstGift(input: TelegramNftLookupInput): Promise<TelegramNftLookupResult | null> {
    const slug = compactGiftSlug(input.collectionName);
    const limit = Number(this.config.get<string>("TELEGRAM_NFT_LOOKUP_LIMIT") ?? 2500);
    const concurrency = Math.max(1, Math.min(Number(this.config.get<string>("TELEGRAM_NFT_LOOKUP_CONCURRENCY") ?? 16), 32));
    const checkedNums = new Set<number>();
    let nextNum = 1;
    let firstModelMatch: TelegramNftLookupResult | null = null;
    let exactMatch: TelegramNftLookupResult | null = null;

    for (const num of this.candidateNumbers(input)) {
      checkedNums.add(num);
      const sourceUrl = `https://t.me/nft/${slug}-${num}`;
      const gift = await this.fetchGiftMetadata(sourceUrl);
      if (!gift || !sameName(gift.modelName, input.modelName)) continue;

      const result = { sourceUrl, backdropName: gift.backdropName };
      firstModelMatch ??= result;
      if (!input.backdropName || sameName(gift.backdropName, input.backdropName)) return result;
    }

    const worker = async () => {
      while (!exactMatch) {
        const num = nextNum++;
        if (num > limit) return;
        if (checkedNums.has(num)) continue;

        const sourceUrl = `https://t.me/nft/${slug}-${num}`;
        const gift = await this.fetchGiftMetadata(sourceUrl);
        if (!gift || !sameName(gift.modelName, input.modelName)) continue;

        const result = { sourceUrl, backdropName: gift.backdropName };
        firstModelMatch ??= result;
        if (!input.backdropName || sameName(gift.backdropName, input.backdropName)) exactMatch = result;
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    const result = exactMatch ?? firstModelMatch;
    if (!result) {
      this.logger.warn(`Direct Telegram NFT lookup found no gift for ${input.collectionName} / ${input.modelName}`);
    }
    return result;
  }

  private candidateNumbers(input: TelegramNftLookupInput) {
    return knownExactCandidates
      .filter(
        (candidate) =>
          sameName(candidate.collectionName, input.collectionName) &&
          sameName(candidate.modelName, input.modelName) &&
          (!input.backdropName || sameName(candidate.backdropName, input.backdropName))
      )
      .flatMap((candidate) => candidate.numbers);
  }

  private async fetchGiftMetadata(sourceUrl: string) {
    const response = await this.fetcher(sourceUrl).catch(() => null);
    if (!response?.ok) return null;

    const html = await response.text();
    const description = metaContent(html, "og:description") || metaContent(html, "twitter:description");
    const modelName = descriptionField(description, "Model");
    if (!modelName) return null;

    return {
      modelName,
      backdropName: descriptionField(description, "Backdrop")
    };
  }
}

function compactGiftSlug(value: string) {
  return value.normalize("NFKC").replace(/[^A-Za-z0-9]+/g, "");
}

function sameName(left: string | null | undefined, right: string | null | undefined) {
  return normalizeName(left ?? "") === normalizeName(right ?? "");
}

function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\belectro\b/gi, "electric")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function metaContent(html: string, property: string) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${escapedProperty}["'][^>]*content=["']([\\s\\S]*?)["'][^>]*>`, "i");
  const match = html.match(regex);
  return match?.[1] ? decodeHtml(match[1]).trim() : "";
}

function descriptionField(description: string, field: "Model" | "Backdrop") {
  const regex = new RegExp(`^\\s*${field}:\\s*(.+?)\\s*$`, "im");
  const match = description.match(regex);
  return match?.[1] ? stripRarity(match[1]) : null;
}

function stripRarity(value: string) {
  return value.replace(/\s+\d+(?:[.,]\d+)?%\s*$/, "").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
