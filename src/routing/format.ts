import type { Translate } from "../i18n/translation";

/** Play time, rounded to minutes. */
export function formatDuration(t: Translate, seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return t("under a minute");
  if (minutes < 60) return t("{minutes} min", { minutes });
  return t("{hours} h {minutes} min", {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  });
}
