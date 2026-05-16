import type { SupportedLanguage } from "../lib/i18n";
import { t } from "../lib/i18n";

const labels: Record<SupportedLanguage, string> = {
  en: "EN",
  uk: "UA",
  ru: "RU"
};

export function LanguageSelector({ language, onChange }: { language: SupportedLanguage; onChange: (language: SupportedLanguage) => void }) {
  return (
    <label className="language-selector">
      <span className="muted">{t(language, "language") as string}</span>
      <select value={language} onChange={(event) => onChange(event.target.value as SupportedLanguage)}>
        {Object.entries(labels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
