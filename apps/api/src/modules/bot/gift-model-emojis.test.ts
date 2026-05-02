import { describe, expect, it } from "vitest";
import { parseGiftModelEmojiPosts } from "./gift-model-emojis.js";

describe("parseGiftModelEmojiPosts", () => {
  it("extracts model custom emoji ids from a GiftChangesModels post", () => {
    const html = `
      <div class="tgme_widget_message_text js-message_text" dir="auto">
        <b>Plush Pepe</b> Models <tg-emoji emoji-id="5359622339296256165"><i class="emoji"><b>🎁</b></i></tg-emoji><br/><br/>
        <tg-emoji emoji-id="5456658853242365136"><i class="emoji"><b>🎁</b></i></tg-emoji> <code>Raphael</code> — 1%<br/>
        <tg-emoji emoji-id="5453884987268949248"><i class="emoji"><b>🎁</b></i></tg-emoji> <code>Ninja Mike</code> — 1%
      </div>
    `;

    expect(parseGiftModelEmojiPosts(html)).toContainEqual({
      collectionName: "Plush Pepe",
      modelName: "Raphael",
      emojiId: "5456658853242365136",
      fallback: "🎁"
    });
  });
});
