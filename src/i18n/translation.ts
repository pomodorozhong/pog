import type { Language } from "../domain/types";
import uiTranslations from "../../data/localization/ui.zh-TW.json" with { type: "json" };

export const chinese: Record<string, string> = uiTranslations;

/** Interface text is written in English; the English string is the key for its zh-TW translation. */
export function translate(
  language: Language,
  key: string,
  values: Record<string, string | number> = {},
): string {
  const value = language === "zh-TW" ? (chinese[key] ?? key) : key;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    String(values[name] ?? match),
  );
}

export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;
