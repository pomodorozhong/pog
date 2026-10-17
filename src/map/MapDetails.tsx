import { useEffect, useId, useRef } from "react";
import {
  GRACE_NAME_MODES,
  type GraceNameMode,
  type PlayerDocument,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import { GraceOffIcon, SlidersIcon } from "../layout/icons";

const ROUND =
  "grid size-8 place-items-center rounded-full bg-ink/80 shadow-lg hover:text-gold aria-pressed:text-gold aria-expanded:text-gold";

type Settings = Pick<PlayerDocument, "graceNames" | "hideUnusedGraces">;
const NAME_MODES: Record<GraceNameMode, string> = {
  auto: "Automatic",
  hover: "On hover",
  always: "Always",
};

export function MapDetails({
  t,
  settings,
  onChange,
  open,
  onOpenChange,
  compact = false,
}: {
  t: Translate;
  settings: Settings;
  onChange(changes: Partial<Settings>): void;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Round icon buttons instead of labelled ones, for narrow windows. */
  compact?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node))
        onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onOpenChange(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange]);

  return (
    <div
      ref={container}
      className="absolute right-3 top-3 z-[800] flex flex-col items-end text-sm"
    >
      <div className={`flex ${compact ? "gap-1.5" : "gap-2"}`}>
        <button
          className={compact ? ROUND : "chip bg-panel shadow-lg"}
          aria-pressed={settings.hideUnusedGraces}
          aria-label={compact ? t("Hide graces without paths") : undefined}
          title={compact ? t("Hide graces without paths") : undefined}
          onClick={() =>
            onChange({ hideUnusedGraces: !settings.hideUnusedGraces })
          }
        >
          {compact ? <GraceOffIcon /> : t("Hide graces without paths")}
        </button>
        <button
          ref={button}
          className={compact ? ROUND : "chip bg-panel shadow-lg"}
          aria-label={compact ? t("Details") : undefined}
          title={compact ? t("Details") : undefined}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => onOpenChange(!open)}
        >
          {compact ? <SlidersIcon /> : t("Details")}
        </button>
      </div>
      {open && (
        <section
          id={panelId}
          aria-label={t("Map details")}
          className="mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded border border-line bg-panel p-3 shadow-xl"
        >
          <GraceNameFields t={t} settings={settings} onChange={onChange} />
        </section>
      )}
    </div>
  );
}

function GraceNameFields({
  t,
  settings,
  onChange,
}: {
  t: Translate;
  settings: Settings;
  onChange(changes: Partial<Settings>): void;
}) {
  return (
    <>
      <label className="flex items-center justify-between gap-3">
        <span>{t("Grace names")}</span>
        <select
          className="field"
          value={settings.graceNames}
          onChange={(event) =>
            onChange({ graceNames: event.target.value as GraceNameMode })
          }
        >
          {GRACE_NAME_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t(NAME_MODES[mode])}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted">
        {t("Automatic names appear only when zoomed in very close.")}
      </p>
      <p className="text-xs text-muted">
        {t("Position, selection and planned-route names stay visible.")}
      </p>
    </>
  );
}
