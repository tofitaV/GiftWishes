import { describe, expect, it } from "vitest";
import { DEFAULT_LANGUAGE, normalizeLanguage, t } from "./i18n";

describe("web i18n", () => {
  it("uses English as the default language", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
    expect(t(undefined, "addGift")).toBe("Add");
  });

  it("normalizes supported languages and falls back to English", () => {
    expect(normalizeLanguage("uk")).toBe("uk");
    expect(normalizeLanguage("ru")).toBe("ru");
    expect(normalizeLanguage("de")).toBe("en");
  });
});
