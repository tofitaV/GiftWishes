import { Gift, Trash2 } from "lucide-react";
import type { WishlistItemDto } from "@gift-wishes/shared";

type Props = {
  item: WishlistItemDto;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  onBuy?: (id: string) => void;
};

export function GiftCard({ item, canDelete, onDelete, onBuy }: Props) {
  return (
    <article className="card">
      <div className="gift-preview">
        <Gift size={34} />
      </div>
      <h2 className="card-title">{item.modelName}</h2>
      <div className="muted">{item.collectionName}</div>
      <div className="muted">{item.backdropName ?? "Любой фон"}</div>
      <div className="button-row">
        {onBuy ? (
          <button className="button" type="button" onClick={() => onBuy(item.id)}>
            Купить
          </button>
        ) : null}
        {canDelete ? (
          <button className="button danger" type="button" aria-label="Удалить" onClick={() => onDelete?.(item.id)}>
            <Trash2 size={18} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

