import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_LANGUAGE, normalizeLanguage, type SupportedLanguage } from "@gift-wishes/shared";
import { Telegraf } from "telegraf";
import { PrismaService } from "../prisma/prisma.service.js";
import { StarsService } from "../stars/stars.service.js";
import { WishlistService } from "../wishlist/wishlist.service.js";
import { lookupGiftBackdropEmoji } from "./gift-backdrop-emojis.js";
import { lookupGiftModelEmoji } from "./gift-model-emojis.js";
import { addTelegramNftGiftFromMessage, extractTelegramNftUrl, type TelegramNftGift } from "./telegram-nft.js";

type InlineWishlistItem = {
  collectionName: string;
  modelName: string;
  backdropName: string | null;
  symbolName: string | null;
  sourceUrl?: string | null;
};

type TelegramMessageEntity =
  | {
      type: "custom_emoji";
      offset: number;
      length: number;
      custom_emoji_id: string;
    }
  | {
      type: "text_link";
      offset: number;
      length: number;
      url: string;
    };

type FormattedTelegramMessage = {
  text: string;
  entities: TelegramMessageEntity[];
};

type InlineWishlistResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  input_message_content: {
    message_text: string;
    entities?: TelegramMessageEntity[];
    link_preview_options: { is_disabled: true };
    disable_web_page_preview: true;
  };
  reply_markup: {
    inline_keyboard: [[{ text: string; url: string }]];
  };
};

type InlineAddGiftResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  input_message_content: {
    message_text: string;
    link_preview_options: { is_disabled: true };
    disable_web_page_preview: true;
  };
  reply_markup: {
    inline_keyboard: [[{ text: string; url: string }]];
  };
};

type InlineHelpResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  input_message_content: {
    message_text: string;
    link_preview_options: { is_disabled: true };
    disable_web_page_preview: true;
  };
};

type InlineDeleteGiftResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  input_message_content: {
    message_text: string;
    link_preview_options: { is_disabled: true };
    disable_web_page_preview: true;
  };
  reply_markup: {
    inline_keyboard: [[{ text: string; url: string }]];
  };
};

type InlineGiftLinkResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  input_message_content: {
    message_text: string;
  };
  reply_markup: {
    inline_keyboard: [[{ text: string; url: string }]];
  };
};

type WishlistProfileReplyMarkup = {
  inline_keyboard: [[{ text: string; web_app: { url: string } }]];
};

type WishlistGiftLinksReplyMarkup = {
  inline_keyboard: { text: string; url: string }[][];
};

type ChosenInlineWishlistResult = {
  result_id: string;
  query?: string;
  from: { id: number };
  inline_message_id?: string;
};

const WISHLIST_START_PREFIX = "wishlist_";
const WISHLIST_PROFILE_START_PREFIX = "profile-";
const DEFAULT_BOT_USERNAME = "giftwishes_bot";
const INLINE_WISHLIST_RESULT_ID = "wishlist";
const INLINE_ADD_GIFT_RESULT_ID = "add_nft";
const INLINE_HELP_RESULT_ID = "help";
const INLINE_DELETE_GIFT_RESULT_ID = "delete_gift";
const INLINE_GIFT_LINK_RESULT_ID_PREFIX = "gift_link";
const INLINE_WISHLIST_THUMBNAIL_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f381.png";
const INLINE_ADD_THUMBNAIL_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2795.png";
const INLINE_DELETE_THUMBNAIL_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2796.png";
const INLINE_HELP_THUMBNAIL_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2753.png";
const INLINE_GIFT_LINK_THUMBNAIL_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f517.png";

const BOT_TEXT = {
  en: {
    userFallback: "user",
    ownWishlistHeader: "Your wishlist",
    ownWishlistEmpty: "Your wishlist is empty",
    wishlistEmpty: (displayName: string) => `Wishlist ${displayName} is empty`,
    openProfileBuyGift: (username: string | null) => (username ? `Open @${username}'s profile / Buy gift` : "Open profile / Buy gift"),
    openWishlist: "Open wishlist",
    addGifts: "Add gifts",
    showOwnWishlist: "Show my wishlist",
    giftCount: (count: number) => `${count} gift${count === 1 ? "" : "s"} in wishlist`,
    wishlistIsEmpty: "Wishlist is empty",
    showUserWishlist: (username: string) => `Show @${username}'s wishlist`,
    openUserWishlist: (username: string) => `Open @${username}'s wishlist`,
    addGiftTitle: "Add gift to wishlist",
    addingGift: "Adding gift to wishlist...",
    helpTitle: "Help",
    helpDescription: "How to use Gift Wishes",
    deleteGiftTitle: "Delete gift from wishlist",
    deleteGiftByNumberTitle: (itemNumber: number) => `Delete gift #${itemNumber}`,
    deleteGiftByNumberDescription: (itemNumber: number) => `Remove gift #${itemNumber} from your wishlist`,
    deletingGift: "Removing gift from your wishlist...",
    deletingGiftByNumber: (itemNumber: number) => `Removing gift #${itemNumber} from your wishlist...`,
    sendGiftByNumberTitle: (itemNumber: number) => `Send gift #${itemNumber}`,
    ready: "Gift Wishes is ready.",
    openWishlistButton: "Open wishlist",
    wishlistNotFound: "Wishlist not found.",
    usernameRequired: "Bot cannot see your Telegram username. Add a username in Telegram and open the bot again.",
    giftNotFound: "Gift was not found in your wishlist.",
    giftNumberNotFound: (itemNumber: number) => `Gift #${itemNumber} was not found. Send /wishlist to see your current list.`,
    removed: (gift: { collectionName: string; modelName: string }) => `Removed from wishlist: ${gift.collectionName} - ${gift.modelName}`,
    addFailed: "Could not add gift to wishlist.",
    removeFailed: "Could not remove gift from wishlist.",
    added: (gift: { collectionName: string; modelName: string; backdropName?: string | null; symbolName?: string | null }) => {
      const lines = [`Added to wishlist: ${gift.collectionName} - ${gift.modelName}`];
      if (gift.backdropName) lines.push(`Backdrop: ${gift.backdropName}`);
      if (gift.symbolName) lines.push(`Pattern: ${gift.symbolName}`);
      return lines.join("\n");
    },
    openGift: (index: number, title: string) => `Open ${index}. ${title}`,
    help: [
      "Gift Wishes is a bot for keeping Telegram gift wishlists.",
      "",
      "How to use:",
      "1. Open the Mini App from the bot and build your wishlist.",
      "2. Other users can open your profile and buy a gift when purchasing is available.",
      "",
      "How to add a gift:",
      'Type @giftwishes_bot in any chat, paste a gift link, and choose "Add gift to wishlist".',
      "",
      "How to show gifts in chat:",
      'Send /wishlist or type @giftwishes_bot and choose "Show my wishlist".',
      "",
      "How to send one gift:",
      "Type @giftwishes_bot 1, where 1 is the gift number. The bot will send only that gift link.",
      "",
      "How to delete a gift:",
      'Type @giftwishes_bot 1 and choose "Delete gift #1", or send delete 1.'
    ].join("\n")
  },
  uk: {
    userFallback: "користувача",
    ownWishlistHeader: "Твій wishlist",
    ownWishlistEmpty: "Твій wishlist поки порожній",
    wishlistEmpty: (displayName: string) => `Wishlist ${displayName} поки порожній`,
    openProfileBuyGift: (username: string | null) => (username ? `Відкрити профіль @${username} / Купити гіфт` : "Відкрити профіль / Купити гіфт"),
    openWishlist: "Відкрити wishlist",
    addGifts: "Додати подарунки",
    showOwnWishlist: "Показати мій wishlist",
    giftCount: (count: number) => `${count} подарунків у списку`,
    wishlistIsEmpty: "Wishlist поки порожній",
    showUserWishlist: (username: string) => `Показати wishlist @${username}`,
    openUserWishlist: (username: string) => `Відкрити wishlist @${username}`,
    addGiftTitle: "Додати подарунок у wishlist",
    addingGift: "Додаю подарунок у wishlist...",
    helpTitle: "Допомога",
    helpDescription: "Як користуватися Gift Wishes",
    deleteGiftTitle: "Видалити подарунок із wishlist",
    deleteGiftByNumberTitle: (itemNumber: number) => `Видалити подарунок #${itemNumber}`,
    deleteGiftByNumberDescription: (itemNumber: number) => `Видалити подарунок #${itemNumber} із wishlist`,
    deletingGift: "Видаляю подарунок із wishlist...",
    deletingGiftByNumber: (itemNumber: number) => `Видаляю подарунок #${itemNumber} із wishlist...`,
    sendGiftByNumberTitle: (itemNumber: number) => `Вивести подарунок #${itemNumber}`,
    ready: "Gift Wishes готовий.",
    openWishlistButton: "Відкрити wishlist",
    wishlistNotFound: "Wishlist не знайдено.",
    usernameRequired: "Бот не бачить твій Telegram username. Додай username у Telegram і відкрий бота знову.",
    giftNotFound: "Подарунок не знайдено у твоєму wishlist.",
    giftNumberNotFound: (itemNumber: number) => `Подарунок #${itemNumber} не знайдено. Напиши /wishlist, щоб побачити поточний список.`,
    removed: (gift: { collectionName: string; modelName: string }) => `Видалено з wishlist: ${gift.collectionName} - ${gift.modelName}`,
    addFailed: "Не вдалося додати гіфт у wishlist.",
    removeFailed: "Не вдалося видалити гіфт із wishlist.",
    added: (gift: { collectionName: string; modelName: string; backdropName?: string | null; symbolName?: string | null }) => {
      const lines = [`Додано у wishlist: ${gift.collectionName} - ${gift.modelName}`];
      if (gift.backdropName) lines.push(`Фон: ${gift.backdropName}`);
      if (gift.symbolName) lines.push(`Візерунок: ${gift.symbolName}`);
      return lines.join("\n");
    },
    openGift: (index: number, title: string) => `Відкрити ${index}. ${title}`,
    help: [
      "Gift Wishes — бот для збереження бажаних Telegram-подарунків.",
      "",
      "Як користуватися:",
      "1. Відкрий Mini App із бота і збери свій wishlist.",
      "2. Інші користувачі зможуть відкрити твій профіль і купити подарунок, коли покупка доступна.",
      "",
      "Як додати подарунок:",
      'Напиши в чаті @giftwishes_bot, встав посилання на подарунок і вибери "Додати подарунок у wishlist".',
      "",
      "Як показати подарунки в чаті:",
      'Надішли /wishlist або напиши @giftwishes_bot і вибери "Показати мій wishlist".',
      "",
      "Як вивести один подарунок:",
      "Напиши @giftwishes_bot 1, де 1 — номер подарунка. Бот надішле лише посилання на цей подарунок.",
      "",
      "Як видалити подарунок:",
      'Напиши @giftwishes_bot 1 і вибери "Видалити подарунок #1", або надішли delete 1.'
    ].join("\n")
  },
  ru: {
    userFallback: "пользователя",
    ownWishlistHeader: "Твой wishlist",
    ownWishlistEmpty: "Твой wishlist пока пуст",
    wishlistEmpty: (displayName: string) => `Wishlist ${displayName} пока пуст`,
    openProfileBuyGift: (username: string | null) => (username ? `Открыть профиль @${username} / Купить гифт` : "Открыть профиль / Купить гифт"),
    openWishlist: "Открыть wishlist",
    addGifts: "Добавить подарки",
    showOwnWishlist: "Показать свой wishlist",
    giftCount: (count: number) => `${count} подарков в списке`,
    wishlistIsEmpty: "Wishlist пока пуст",
    showUserWishlist: (username: string) => `Показать wishlist @${username}`,
    openUserWishlist: (username: string) => `Открыть wishlist @${username}`,
    addGiftTitle: "Добавить подарок в wishlist",
    addingGift: "Добавляю подарок в wishlist...",
    helpTitle: "Помощь",
    helpDescription: "Как пользоваться Gift Wishes",
    deleteGiftTitle: "Удалить подарок из wishlist",
    deleteGiftByNumberTitle: (itemNumber: number) => `Удалить подарок #${itemNumber}`,
    deleteGiftByNumberDescription: (itemNumber: number) => `Удалить подарок под номером ${itemNumber} из wishlist`,
    deletingGift: "Удаляю подарок из wishlist...",
    deletingGiftByNumber: (itemNumber: number) => `Удаляю подарок #${itemNumber} из wishlist...`,
    sendGiftByNumberTitle: (itemNumber: number) => `Вывести подарок #${itemNumber}`,
    ready: "Gift Wishes is ready.",
    openWishlistButton: "Open wishlist",
    wishlistNotFound: "Wishlist не найден.",
    usernameRequired: "Bot cannot see your Telegram username. Add a username in Telegram and open the bot again.",
    giftNotFound: "Подарок не найден в твоем wishlist.",
    giftNumberNotFound: (itemNumber: number) => `Подарок с номером ${itemNumber} не найден. Напиши /wishlist, чтобы увидеть текущий список.`,
    removed: (gift: { collectionName: string; modelName: string }) => `Удалено из wishlist: ${gift.collectionName} - ${gift.modelName}`,
    addFailed: "Не удалось добавить гифт в wishlist.",
    removeFailed: "Не удалось удалить гифт из wishlist.",
    added: (gift: { collectionName: string; modelName: string; backdropName?: string | null; symbolName?: string | null }) => {
      const lines = [`Добавлено в wishlist: ${gift.collectionName} - ${gift.modelName}`];
      if (gift.backdropName) lines.push(`Фон: ${gift.backdropName}`);
      if (gift.symbolName) lines.push(`Узор: ${gift.symbolName}`);
      return lines.join("\n");
    },
    openGift: (index: number, title: string) => `Открыть ${index}. ${title}`,
    help: [
      "Gift Wishes — бот для хранения желаемых подарков.",
      "",
      "Как пользоваться:",
      "1. Открой Mini App из бота и собери свой список желаний.",
      "2. Другие пользователи смогут открыть твой профиль и подарить подарок(пока не реализовано).",
      "",
      "Как добавить подарок:",
      'Напиши в чате @giftwishes_bot и вставь ссылку на подарок. Выбери "Добавить подарок в wishlist".',
      "",
      "Как показать подарки в чате:",
      'Напиши @giftwishes_bot или отправь /wishlist и выбери результат "Показать свой wishlist".',
      "",
      "Как вывести один подарок:",
      "Напиши @giftwishes_bot 1, где 1 — номер подарка. Бот отправит только ссылку на этот подарок.",
      "",
      "Как удалить подарок:",
      'Напиши @giftwishes_bot 1 и выбери "Удалить подарок #1", или отправь delete 1.'
    ].join("\n")
  }
} as const;

function botText(language?: string | null) {
  return BOT_TEXT[normalizeLanguage(language)];
}

export function formatInlineWishlistMessage({ username, items, language = DEFAULT_LANGUAGE }: { username: string | null; items: InlineWishlistItem[]; language?: SupportedLanguage }) {
  return formatInlineWishlistReply({ username, items, language }).text;
}

export function formatInlineWishlistReply({ username, items, language = DEFAULT_LANGUAGE }: { username: string | null; items: InlineWishlistItem[]; language?: SupportedLanguage }): FormattedTelegramMessage {
  const text = botText(language);
  const displayName = username ? `@${username}` : text.userFallback;
  return formatWishlistReply({
    header: `Wishlist ${displayName}`,
    emptyMessage: text.wishlistEmpty(displayName),
    items
  });
}

export function formatOwnWishlistMessage({ items, language = DEFAULT_LANGUAGE }: { items: InlineWishlistItem[]; language?: SupportedLanguage }) {
  return formatOwnWishlistReply({ items, language }).text;
}

export function formatOwnWishlistReply({ items, language = DEFAULT_LANGUAGE }: { items: InlineWishlistItem[]; language?: SupportedLanguage }): FormattedTelegramMessage {
  const text = botText(language);
  return formatWishlistReply({
    header: text.ownWishlistHeader,
    emptyMessage: text.ownWishlistEmpty,
    items
  });
}

function formatWishlistReply({ header, emptyMessage, items }: { header: string; emptyMessage: string; items: InlineWishlistItem[] }): FormattedTelegramMessage {
  const builder = createTelegramMessageBuilder();
  if (items.length === 0) {
    builder.append(emptyMessage);
    return builder.build();
  }

  builder.append(header);
  builder.append("\n\n");
  items.forEach((item, index) => {
    if (index > 0) builder.append("\n");

    builder.append(`${index + 1}. `);
    appendGiftTitle(builder, item);
  });

  return builder.build();
}

function appendGiftTitle(builder: TelegramMessageBuilder, item: Pick<InlineWishlistItem, "collectionName" | "modelName" | "backdropName" | "sourceUrl">) {
  const emoji = lookupGiftModelEmoji(item.collectionName, item.modelName);
  if (emoji) {
    const offset = builder.length;
    builder.append(emoji.fallback);
    builder.addEntity({
      type: "custom_emoji",
      offset,
      length: emoji.fallback.length,
      custom_emoji_id: emoji.emojiId
    });
    builder.append(" ");
  }

  const title = `${item.collectionName} - ${item.modelName}`;
  const offset = builder.length;
  builder.append(title);
  if (item.sourceUrl) {
    builder.addEntity({
      type: "text_link",
      offset,
      length: title.length,
      url: item.sourceUrl
    });
  }

  if (item.backdropName) {
    const backdropEmoji = lookupGiftBackdropEmoji(item.backdropName);
    builder.append(" ");

    if (backdropEmoji) {
      const backdropOffset = builder.length;
      builder.append(backdropEmoji.fallback);
      builder.addEntity({
        type: "custom_emoji",
        offset: backdropOffset,
        length: backdropEmoji.fallback.length,
        custom_emoji_id: backdropEmoji.emojiId
      });
      builder.append(" ");
    }

    builder.append(item.backdropName);
  }
}

type TelegramMessageBuilder = ReturnType<typeof createTelegramMessageBuilder>;

function createTelegramMessageBuilder() {
  let text = "";
  const entities: TelegramMessageEntity[] = [];
  return {
    get length() {
      return text.length;
    },
    append(value: string) {
      text += value;
    },
    addEntity(entity: TelegramMessageEntity) {
      entities.push(entity);
    },
    build(): FormattedTelegramMessage {
      return { text, entities };
    }
  };
}

function messageEntitiesOption(message: FormattedTelegramMessage) {
  return message.entities.length > 0 ? message.entities : undefined;
}

export function parseWishlistStartPayload(payload: string | undefined) {
  if (!payload?.startsWith(WISHLIST_START_PREFIX)) return null;

  const ownerUserId = payload.slice(WISHLIST_START_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(ownerUserId)) return null;
  return ownerUserId;
}

export function createBotWishlistDeepLink({ botUsername, appShortName, ownerUserId }: { botUsername: string; appShortName?: string; ownerUserId: string }) {
  const username = botUsername.replace(/^@/, "");
  const appPath = appShortName ? `/${appShortName.replace(/^\//, "")}` : "";
  return `https://t.me/${username}${appPath}?startapp=${WISHLIST_PROFILE_START_PREFIX}${ownerUserId}`;
}

export function isOwnWishlistCommand(text: string) {
  const normalized = text.trim().toLowerCase();
  return (
    /^\/(?:wishlist|list)(?:@\w+)?$/.test(normalized) ||
    normalized === "wishlist" ||
    normalized === "список" ||
    normalized === "показать список" ||
    normalized === "покажи список" ||
    normalized === "показать wishlist" ||
    normalized === "покажи wishlist"
  );
}

export function isHelpCommand(text: string) {
  const normalized = text.trim().toLowerCase();
  return /^\/help(?:@\w+)?$/.test(normalized) || normalized === "help" || normalized === "помощь" || normalized === "допомога";
}

export function parseWishlistItemRemovalCommand(text: string) {
  const normalized = text.trim().toLowerCase();
  const match = normalized.match(/^(?:(?:\/)?(?:remove|delete)(?:@\w+)?|удалить|видалити)\s+(\d+)$/);
  if (!match) return null;

  const itemNumber = Number(match[1]);
  return Number.isInteger(itemNumber) && itemNumber > 0 ? itemNumber : null;
}

export function parseWishlistItemNumberQuery(text: string) {
  const normalized = text.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const itemNumber = Number(normalized);
  return Number.isInteger(itemNumber) && itemNumber >= 1 && itemNumber <= 100 ? itemNumber : null;
}

export function parseInlineUsernameQuery(text: string) {
  const normalized = text.trim();
  const match = normalized.match(/^@([A-Za-z0-9_]{5,32})$/);
  if (!match) return null;

  const username = match[1];
  return username.toLowerCase() === DEFAULT_BOT_USERNAME.toLowerCase() ? null : username;
}

export function formatHelpMessage(language: SupportedLanguage = DEFAULT_LANGUAGE) {
  return botText(language).help;
}

export function parseInlineDeleteGiftResultId(resultId: string) {
  if (resultId === INLINE_DELETE_GIFT_RESULT_ID) return null;
  const match = resultId.match(new RegExp(`^${INLINE_DELETE_GIFT_RESULT_ID}_(\\d+)$`));
  if (!match) return null;
  const itemNumber = Number(match[1]);
  return Number.isInteger(itemNumber) && itemNumber > 0 ? itemNumber : null;
}

export function createWishlistProfileReplyMarkup({ ownerUsername, webAppUrl, language = DEFAULT_LANGUAGE }: { ownerUsername: string | null; webAppUrl: string; language?: SupportedLanguage }): WishlistProfileReplyMarkup {
  const label = botText(language).openProfileBuyGift(ownerUsername);

  return {
    inline_keyboard: [[{ text: label, web_app: { url: webAppUrl } }]]
  };
}

export function createWishlistGiftLinksReplyMarkup({ items, language = DEFAULT_LANGUAGE }: { items: InlineWishlistItem[]; language?: SupportedLanguage }): WishlistGiftLinksReplyMarkup | undefined {
  const text = botText(language);
  const buttons = items.flatMap((item, index) => {
    if (!item.sourceUrl) return [];
    return [
      [
        {
          text: text.openGift(index + 1, `${item.collectionName} - ${item.modelName}`),
          url: item.sourceUrl
        }
      ]
    ];
  });

  return buttons.length > 0 ? { inline_keyboard: buttons } : undefined;
}

export function createInlineWishlistResult({ wishlistLink, message, itemCount, language = DEFAULT_LANGUAGE }: { wishlistLink: string; message: FormattedTelegramMessage; itemCount: number; language?: SupportedLanguage }): InlineWishlistResult {
  const text = botText(language);
  return {
    type: "article",
    id: INLINE_WISHLIST_RESULT_ID,
    title: text.showOwnWishlist,
    description: itemCount > 0 ? text.giftCount(itemCount) : text.wishlistIsEmpty,
    thumbnail_url: INLINE_WISHLIST_THUMBNAIL_URL,
    input_message_content: {
      message_text: message.text,
      entities: messageEntitiesOption(message),
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true
    },
    reply_markup: {
      inline_keyboard: [[{ text: itemCount > 0 ? text.openWishlist : text.addGifts, url: wishlistLink }]]
    }
  };
}

export function createInlineUserWishlistResult({
  username,
  wishlistLink,
  message,
  itemCount,
  language = DEFAULT_LANGUAGE
}: {
  username: string;
  wishlistLink: string;
  message: FormattedTelegramMessage;
  itemCount: number;
  language?: SupportedLanguage;
}): InlineWishlistResult {
  const text = botText(language);
  return {
    type: "article",
    id: `wishlist_user_${username}`,
    title: text.showUserWishlist(username),
    description: itemCount > 0 ? text.giftCount(itemCount) : text.wishlistIsEmpty,
    thumbnail_url: INLINE_WISHLIST_THUMBNAIL_URL,
    input_message_content: {
      message_text: message.text,
      entities: messageEntitiesOption(message),
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true
    },
    reply_markup: {
      inline_keyboard: [[{ text: text.openUserWishlist(username), url: wishlistLink }]]
    }
  };
}

export function createInlineAddGiftResult({ wishlistLink, sourceUrl, language = DEFAULT_LANGUAGE }: { wishlistLink: string; sourceUrl: string; language?: SupportedLanguage }): InlineAddGiftResult {
  const text = botText(language);
  return {
    type: "article",
    id: INLINE_ADD_GIFT_RESULT_ID,
    title: text.addGiftTitle,
    description: sourceUrl,
    thumbnail_url: INLINE_ADD_THUMBNAIL_URL,
    input_message_content: {
      message_text: text.addingGift,
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true
    },
    reply_markup: {
      inline_keyboard: [[{ text: text.openWishlist, url: wishlistLink }]]
    }
  };
}

export function createInlineHelpResult(language: SupportedLanguage = DEFAULT_LANGUAGE): InlineHelpResult {
  const text = botText(language);
  return {
    type: "article",
    id: INLINE_HELP_RESULT_ID,
    title: text.helpTitle,
    description: text.helpDescription,
    thumbnail_url: INLINE_HELP_THUMBNAIL_URL,
    input_message_content: {
      message_text: formatHelpMessage(language),
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true
    }
  };
}

export function createInlineDeleteGiftResult({ itemNumber, sourceUrl, wishlistLink, language = DEFAULT_LANGUAGE }: { itemNumber?: number; sourceUrl?: string; wishlistLink: string; language?: SupportedLanguage }): InlineDeleteGiftResult {
  const text = botText(language);
  const title = sourceUrl ? text.deleteGiftTitle : text.deleteGiftByNumberTitle(itemNumber ?? 0);
  const description = sourceUrl ?? text.deleteGiftByNumberDescription(itemNumber ?? 0);
  const messageText = sourceUrl ? text.deletingGift : text.deletingGiftByNumber(itemNumber ?? 0);

  return {
    type: "article",
    id: sourceUrl ? INLINE_DELETE_GIFT_RESULT_ID : `${INLINE_DELETE_GIFT_RESULT_ID}_${itemNumber}`,
    title,
    description,
    thumbnail_url: INLINE_DELETE_THUMBNAIL_URL,
    input_message_content: {
      message_text: messageText,
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true
    },
    reply_markup: {
      inline_keyboard: [[{ text: text.openWishlist, url: wishlistLink }]]
    }
  };
}

export function createInlineGiftLinkResult({ itemNumber, sourceUrl, wishlistLink, language = DEFAULT_LANGUAGE }: { itemNumber: number; sourceUrl: string; wishlistLink: string; language?: SupportedLanguage }): InlineGiftLinkResult {
  const text = botText(language);
  return {
    type: "article",
    id: `${INLINE_GIFT_LINK_RESULT_ID_PREFIX}_${itemNumber}`,
    title: text.sendGiftByNumberTitle(itemNumber),
    description: sourceUrl,
    thumbnail_url: INLINE_GIFT_LINK_THUMBNAIL_URL,
    input_message_content: {
      message_text: sourceUrl
    },
    reply_markup: {
      inline_keyboard: [[{ text: text.openWishlist, url: wishlistLink }]]
    }
  };
}

export async function editChosenInlineWishlistResult({
  chosenInlineResult,
  findUserByTelegramId,
  createWishlistLink,
  editMessageText,
  language = DEFAULT_LANGUAGE
}: {
  chosenInlineResult: ChosenInlineWishlistResult;
  findUserByTelegramId: (telegramId: string) => Promise<{ id: string; username: string | null; wishlistItems: InlineWishlistItem[] } | null>;
  createWishlistLink: (userId: string) => string;
  language?: SupportedLanguage;
  editMessageText: (
    text: string,
    extra: {
      entities?: TelegramMessageEntity[];
      link_preview_options: { is_disabled: true };
      disable_web_page_preview: true;
      reply_markup: InlineWishlistResult["reply_markup"];
    }
  ) => Promise<unknown>;
}) {
  if (chosenInlineResult.result_id !== INLINE_WISHLIST_RESULT_ID) return false;
  if (!chosenInlineResult.inline_message_id) return false;

  const user = await findUserByTelegramId(String(chosenInlineResult.from.id));
  if (!user) return false;

  const message = formatInlineWishlistReply({
    username: user.username,
    items: user.wishlistItems,
    language
  });
  const result = createInlineWishlistResult({
    wishlistLink: createWishlistLink(user.id),
    message,
    itemCount: user.wishlistItems.length,
    language
  });

  await editMessageText(message.text, {
    entities: messageEntitiesOption(message),
    link_preview_options: { is_disabled: true },
    disable_web_page_preview: true,
    reply_markup: result.reply_markup
  });
  return true;
}

export async function editChosenInlineUserWishlistResult({
  chosenInlineResult,
  findUserByUsername,
  createWishlistLink,
  editMessageText,
  language = DEFAULT_LANGUAGE
}: {
  chosenInlineResult: ChosenInlineWishlistResult;
  findUserByUsername: (username: string) => Promise<{ id: string; username: string | null; wishlistItems: InlineWishlistItem[] } | null>;
  createWishlistLink: (userId: string) => string;
  language?: SupportedLanguage;
  editMessageText: (
    text: string,
    extra: {
      entities?: TelegramMessageEntity[];
      link_preview_options: { is_disabled: true };
      disable_web_page_preview: true;
      reply_markup: InlineWishlistResult["reply_markup"];
    }
  ) => Promise<unknown>;
}) {
  if (!chosenInlineResult.inline_message_id) return false;

  const username = parseInlineUsernameQuery(chosenInlineResult.query ?? "");
  if (!username) return false;

  const user = await findUserByUsername(username);
  if (!user?.username) return false;

  const message = formatInlineWishlistReply({
    username: user.username,
    items: user.wishlistItems,
    language
  });
  const result = createInlineUserWishlistResult({
    username: user.username,
    wishlistLink: createWishlistLink(user.id),
    message,
    itemCount: user.wishlistItems.length,
    language
  });

  await editMessageText(message.text, {
    entities: messageEntitiesOption(message),
    link_preview_options: { is_disabled: true },
    disable_web_page_preview: true,
    reply_markup: result.reply_markup
  });
  return true;
}

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private bot?: Telegraf;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly wishlist: WishlistService,
    private readonly stars: StarsService
  ) {}

  private appUrl(path = "") {
    const base = this.config.getOrThrow<string>("WEB_APP_URL").replace(/\/$/, "");
    return `${base}${path}`;
  }

  private publicWishlistUrl(userId: string) {
    return `${this.appUrl("/")}?${new URLSearchParams({ owner: userId }).toString()}`;
  }

  private botUsername() {
    return this.config.get<string>("BOT_USERNAME") ?? DEFAULT_BOT_USERNAME;
  }

  private botWishlistUrl(userId: string) {
    return createBotWishlistDeepLink({
      botUsername: this.botUsername(),
      appShortName: this.config.get<string>("BOT_APP_SHORT_NAME"),
      ownerUserId: userId
    });
  }

  private async fetchTelegramNftHtml(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Telegram NFT page request failed ${response.status}`);
    }
    return response.text();
  }

  private async upsertTelegramUser(from: { id: number; username?: string; first_name?: string; last_name?: string; language_code?: string }) {
    return this.prisma.user.upsert({
      where: { telegramId: String(from.id) },
      update: {
        username: from.username,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        languageCode: from.language_code ?? null,
        isUsernameVisible: true
      },
      create: {
        telegramId: String(from.id),
        username: from.username,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        languageCode: from.language_code ?? null,
        isUsernameVisible: true
      }
    });
  }

  private formatAddedGiftMessage(gift: { collectionName: string; modelName: string; backdropName?: string | null; symbolName?: string | null }, language: SupportedLanguage) {
    return botText(language).added(gift);
  }

  onModuleInit() {
    const token = this.config.get<string>("BOT_TOKEN");
    if (!token) {
      this.logger.warn("BOT_TOKEN is not configured; Telegram bot is disabled");
      return;
    }

    this.bot = new Telegraf(token);
    this.bot.catch((error) => {
      this.logger.error("Telegram bot update failed", error instanceof Error ? error.stack : String(error));
    });

    this.bot.on("pre_checkout_query", async (ctx) => {
      const query = ctx.preCheckoutQuery;
      const decision = await this.stars.validateWishlistSlotPreCheckout({
        payload: query.invoice_payload,
        telegramUserId: String(query.from.id),
        currency: query.currency,
        totalAmount: query.total_amount
      });
      await ctx.answerPreCheckoutQuery(decision.ok, decision.ok ? undefined : decision.errorMessage);
    });

    this.bot.on("successful_payment", async (ctx) => {
      const message = ctx.message as {
        from?: { id: number; username?: string; first_name?: string; last_name?: string; language_code?: string };
        successful_payment?: {
          invoice_payload: string;
          currency: string;
          total_amount: number;
          telegram_payment_charge_id: string;
        };
      };
      const payment = message.successful_payment;
      const from = message.from ?? ctx.from;
      if (!payment || !from) return;

      const user = await this.upsertTelegramUser(from);
      const language = normalizeLanguage(user.preferredLanguage);
      try {
        await this.stars.confirmWishlistSlotPayment({
          payload: payment.invoice_payload,
          telegramUserId: String(from.id),
          currency: payment.currency,
          totalAmount: payment.total_amount,
          telegramPaymentChargeId: payment.telegram_payment_charge_id
        });
        await ctx.reply(
          {
            en: "Payment received. One wishlist slot was added.",
            uk: "Оплату отримано. Один слот wishlist додано.",
            ru: "Оплата получена. Один слот wishlist добавлен."
          }[language]
        );
      } catch (error) {
        this.logger.warn("Telegram Stars slot fulfillment failed", error instanceof Error ? error.stack : String(error));
        await ctx.reply(
          {
            en: "Payment was received, but the slot could not be added automatically. Please contact support.",
            uk: "Оплату отримано, але слот не вдалося додати автоматично. Звернися до підтримки.",
            ru: "Оплата получена, но слот не удалось добавить автоматически. Обратитесь в поддержку."
          }[language]
        );
      }
    });

    this.bot.start(async (ctx) => {
      const from = ctx.from;
      if (!from) {
        return;
      }

      const viewer = await this.upsertTelegramUser(from);
      const language = normalizeLanguage(viewer.preferredLanguage);

      const ownerUserId = parseWishlistStartPayload((ctx as { payload?: string }).payload);
      if (ownerUserId) {
        const owner = await this.prisma.user.findUnique({
          where: { id: ownerUserId },
          include: { wishlistItems: { orderBy: { createdAt: "asc" } } }
        });

        if (!owner) {
          await ctx.reply(botText(language).wishlistNotFound);
          return;
        }

        const reply = formatInlineWishlistReply({ username: owner.username, items: owner.wishlistItems, language });
        await ctx.reply(reply.text, {
          entities: messageEntitiesOption(reply),
          reply_markup: createWishlistProfileReplyMarkup({
            ownerUsername: owner.username,
            webAppUrl: this.publicWishlistUrl(owner.id),
            language
          })
        });
        return;
      }

      if (!from.username) {
        await ctx.reply(botText(language).usernameRequired);
        return;
      }

      await ctx.reply(botText(language).ready, {
        reply_markup: { inline_keyboard: [[{ text: botText(language).openWishlistButton, web_app: { url: this.appUrl() } }]] }
      });
    });

    this.bot.on("inline_query", async (ctx) => {
      const from = ctx.from;
      const itemNumberToSend = parseWishlistItemNumberQuery(ctx.inlineQuery.query ?? "");
      if (itemNumberToSend) {
        const user = await this.prisma.user.findUnique({
          where: { telegramId: String(from.id) },
          include: { wishlistItems: { orderBy: { createdAt: "asc" } } }
        });
        if (!user) return ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });

        const language = normalizeLanguage(user.preferredLanguage);
        const item = user?.wishlistItems[itemNumberToSend - 1];
        const results = item
          ? [
              ...(item.sourceUrl ? [createInlineGiftLinkResult({ itemNumber: itemNumberToSend, sourceUrl: item.sourceUrl, wishlistLink: this.botWishlistUrl(user.id), language })] : []),
              createInlineDeleteGiftResult({ itemNumber: itemNumberToSend, wishlistLink: this.botWishlistUrl(user.id), language })
            ]
          : [];
        return ctx.answerInlineQuery(results, { cache_time: 0, is_personal: true });
      }

      const itemNumberToRemove = parseWishlistItemRemovalCommand(ctx.inlineQuery.query ?? "");
      if (itemNumberToRemove) {
        const user = await this.upsertTelegramUser(from);
        const language = normalizeLanguage(user.preferredLanguage);
        return ctx.answerInlineQuery([createInlineDeleteGiftResult({ itemNumber: itemNumberToRemove, wishlistLink: this.botWishlistUrl(user.id), language }), createInlineHelpResult(language)], {
          cache_time: 0,
          is_personal: true
        });
      }

      const sourceUrl = extractTelegramNftUrl(ctx.inlineQuery.query ?? "");
      if (sourceUrl) {
        const user = await this.upsertTelegramUser(from);
        const language = normalizeLanguage(user.preferredLanguage);
        return ctx.answerInlineQuery(
          [
            createInlineAddGiftResult({
              wishlistLink: this.botWishlistUrl(user.id),
              sourceUrl,
              language
            }),
            createInlineDeleteGiftResult({ sourceUrl, wishlistLink: this.botWishlistUrl(user.id), language }),
            createInlineHelpResult(language)
          ],
          { cache_time: 0, is_personal: true }
        );
      }

      const usernameToShow = parseInlineUsernameQuery(ctx.inlineQuery.query ?? "");
      if (usernameToShow) {
        const viewer = await this.upsertTelegramUser(from);
        const language = normalizeLanguage(viewer.preferredLanguage);
        const owner = await this.prisma.user.findFirst({
          where: { username: { equals: usernameToShow, mode: "insensitive" } },
          include: { wishlistItems: { orderBy: { createdAt: "asc" } } }
        });

        if (!owner?.username) {
          return ctx.answerInlineQuery([createInlineHelpResult(language)], { cache_time: 0, is_personal: true });
        }

        const message = formatInlineWishlistReply({
          username: owner.username,
          items: owner.wishlistItems,
          language
        });

        return ctx.answerInlineQuery(
          [
            createInlineUserWishlistResult({
              username: owner.username,
              wishlistLink: this.botWishlistUrl(owner.id),
              message,
              itemCount: owner.wishlistItems.length,
              language
            }),
            createInlineHelpResult(language)
          ],
          { cache_time: 0, is_personal: true }
        );
      }

      const registeredUser = await this.upsertTelegramUser(from);
      const user = await this.prisma.user.findUnique({
        where: { id: registeredUser.id },
        include: { wishlistItems: { orderBy: { createdAt: "asc" } } }
      });
      const language = normalizeLanguage(registeredUser.preferredLanguage);
      if (!user) return ctx.answerInlineQuery([createInlineHelpResult(language)], { cache_time: 0, is_personal: true });

      const wishlistLink = this.botWishlistUrl(user.id);
      const message = formatInlineWishlistReply({
        username: user.username,
        items: user.wishlistItems,
        language
      });

      return ctx.answerInlineQuery(
        [
          createInlineWishlistResult({
            wishlistLink,
            message,
            itemCount: user.wishlistItems.length,
            language
          }),
          createInlineHelpResult(language)
        ],
        { cache_time: 0, is_personal: true }
      );
    });

    this.bot.on("chosen_inline_result", async (ctx) => {
      if (ctx.chosenInlineResult.result_id === INLINE_DELETE_GIFT_RESULT_ID || parseInlineDeleteGiftResultId(ctx.chosenInlineResult.result_id)) {
        const query = ctx.chosenInlineResult.query ?? "";
        const sourceUrlToRemove = extractTelegramNftUrl(query);
        const itemNumberToRemove = parseInlineDeleteGiftResultId(ctx.chosenInlineResult.result_id) ?? parseWishlistItemRemovalCommand(query);
        if (!sourceUrlToRemove && !itemNumberToRemove) return;

        let language: SupportedLanguage = DEFAULT_LANGUAGE;
        try {
          const user = await this.upsertTelegramUser(ctx.chosenInlineResult.from);
          language = normalizeLanguage(user.preferredLanguage);
          const wishlist = await this.wishlist.getMine(user.id);
          const item = sourceUrlToRemove ? wishlist.items.find((wishlistItem) => wishlistItem.sourceUrl === sourceUrlToRemove) : wishlist.items[(itemNumberToRemove ?? 1) - 1];
          if (!item) {
            if (ctx.chosenInlineResult.inline_message_id) {
              await ctx.editMessageText(botText(language).giftNotFound, {
                link_preview_options: { is_disabled: true }
              });
            }
            return;
          }

          await this.wishlist.remove(user.id, item.id);
          if (ctx.chosenInlineResult.inline_message_id) {
            await ctx.editMessageText(botText(language).removed(item), {
              link_preview_options: { is_disabled: true }
            });
          }
        } catch (error) {
          this.logger.warn("Telegram NFT inline wishlist removal failed", error instanceof Error ? error.stack : String(error));
          if (ctx.chosenInlineResult.inline_message_id) {
            await ctx.editMessageText(error instanceof Error ? error.message : botText(language).removeFailed, {
              link_preview_options: { is_disabled: true }
            });
          }
        }
        return;
      }

      if (ctx.chosenInlineResult.result_id === INLINE_ADD_GIFT_RESULT_ID) {
        const query = ctx.chosenInlineResult.query ?? "";
        let language: SupportedLanguage = DEFAULT_LANGUAGE;
        try {
          const user = await this.upsertTelegramUser(ctx.chosenInlineResult.from);
          language = normalizeLanguage(user.preferredLanguage);
          const createdGift = await addTelegramNftGiftFromMessage({
            text: query,
            fetchHtml: (url) => this.fetchTelegramNftHtml(url),
            createWishlistItem: (input) => this.wishlist.create(user.id, input)
          });

          if (createdGift && ctx.chosenInlineResult.inline_message_id) {
            await ctx.editMessageText(this.formatAddedGiftMessage(createdGift, language), {
              link_preview_options: { is_disabled: true },
              reply_markup: { inline_keyboard: [[{ text: botText(language).openWishlist, url: this.botWishlistUrl(user.id) }]] }
            });
          }
        } catch (error) {
          this.logger.warn("Telegram NFT inline wishlist import failed", error instanceof Error ? error.stack : String(error));
          if (ctx.chosenInlineResult.inline_message_id) {
            await ctx.editMessageText(error instanceof Error ? error.message : botText(language).addFailed, {
              link_preview_options: { is_disabled: true }
            });
          }
        }
        return;
      }

      const chosenUser = await this.upsertTelegramUser(ctx.chosenInlineResult.from);
      const chosenLanguage = normalizeLanguage(chosenUser.preferredLanguage);
      const editedUserWishlist = await editChosenInlineUserWishlistResult({
        chosenInlineResult: ctx.chosenInlineResult,
        findUserByUsername: (username) =>
          this.prisma.user.findFirst({
            where: { username: { equals: username, mode: "insensitive" } },
            include: { wishlistItems: { orderBy: { createdAt: "asc" } } }
          }),
        createWishlistLink: (userId) => this.botWishlistUrl(userId),
        editMessageText: (text, extra) => ctx.editMessageText(text, extra),
        language: chosenLanguage
      });
      if (editedUserWishlist) return;

      await editChosenInlineWishlistResult({
        chosenInlineResult: ctx.chosenInlineResult,
        findUserByTelegramId: (telegramId) =>
          this.prisma.user.findUnique({
            where: { telegramId },
            include: { wishlistItems: { orderBy: { createdAt: "asc" } } }
          }),
        createWishlistLink: (userId) => this.botWishlistUrl(userId),
        editMessageText: (text, extra) => ctx.editMessageText(text, extra),
        language: chosenLanguage
      });
    });

    this.bot.on("text", async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const message = ctx.message as { text?: string };
      const text = message.text ?? "";
      let language: SupportedLanguage = DEFAULT_LANGUAGE;
      try {
        const user = await this.upsertTelegramUser(from);
        language = normalizeLanguage(user.preferredLanguage);
        if (isHelpCommand(text)) {
          await ctx.reply(formatHelpMessage(language), {
            link_preview_options: { is_disabled: true }
          });
          return;
        }

        const itemNumberToRemove = parseWishlistItemRemovalCommand(text);
        if (itemNumberToRemove) {
          const wishlist = await this.wishlist.getMine(user.id);
          const item = wishlist.items[itemNumberToRemove - 1];
          if (!item) {
            await ctx.reply(botText(language).giftNumberNotFound(itemNumberToRemove));
            return;
          }

          await this.wishlist.remove(user.id, item.id);
          await ctx.reply(botText(language).removed(item));
          return;
        }

        if (isOwnWishlistCommand(text)) {
          const wishlist = await this.wishlist.getMine(user.id);
          const reply = formatOwnWishlistReply({ items: wishlist.items, language });
          await ctx.reply(reply.text, {
            entities: messageEntitiesOption(reply),
            link_preview_options: { is_disabled: true },
            reply_markup: createWishlistGiftLinksReplyMarkup({ items: wishlist.items, language })
          });
          return;
        }

        const createdGift = await addTelegramNftGiftFromMessage({
          text,
          fetchHtml: (url) => this.fetchTelegramNftHtml(url),
          createWishlistItem: (input) => this.wishlist.create(user.id, input)
        });

        if (!createdGift) return;
        await ctx.reply(this.formatAddedGiftMessage(createdGift, language));
      } catch (error) {
        this.logger.warn("Telegram NFT wishlist import failed", error instanceof Error ? error.stack : String(error));
        await ctx.reply(error instanceof Error ? error.message : botText(language).addFailed);
      }
    });

    void this.bot.launch();
  }

  async notifyGiftReceived(recipientTelegramId: string, text: string) {
    if (!this.bot) return;
    await this.bot.telegram.sendMessage(recipientTelegramId, text);
  }
}
