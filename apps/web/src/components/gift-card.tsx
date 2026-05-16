import { Gift, Trash2 } from "lucide-react";
import { useState } from "react";
import type { WishlistItemDto } from "@gift-wishes/shared";
import giftCatalog from "../data/gift-catalog.json";
import { findWishlistGiftImageUrl, normalizeCatalog } from "../lib/gift-picker-data";
import { DEFAULT_LANGUAGE, t, type SupportedLanguage } from "../lib/i18n";
import { publicAssetHref } from "../lib/routing";

type Props = {
  item: WishlistItemDto;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  onBuy?: (id: string) => void;
  language?: SupportedLanguage;
};

const catalogCollections = normalizeCatalog(giftCatalog);

export function GiftCard({ item, canDelete, onDelete, onBuy, language = DEFAULT_LANGUAGE }: Props) {
  const imageSrc = publicAssetHref(findWishlistGiftImageUrl(catalogCollections, item.collectionName, item.modelName));
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className="card">
      <div className="gift-preview">
        {imageSrc && !imageFailed ? <img src={imageSrc} alt="" loading="lazy" onError={() => setImageFailed(true)} /> : <Gift size={34} />}
      </div>
      <h2 className="card-title">{item.modelName}</h2>
      <div className="muted">{item.collectionName}</div>
      <div className="muted">
        {t(language, "backdrop") as string}: {item.backdropName ?? (t(language, "anyBackdrop") as string)}
      </div>
      <div className="button-row">
        {onBuy ? (
          <button className="button" type="button" onClick={() => onBuy(item.id)}>
            {t(language, "give") as string}
          </button>
        ) : null}
        {canDelete ? (
          <button className="button danger" type="button" aria-label={t(language, "delete") as string} onClick={() => onDelete?.(item.id)}>
            <Trash2 size={18} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
