import { useCallback, useId, useRef, useState } from "react";
import { LAYERS, type LayerId } from "../domain/types";
import type { Translate } from "../i18n/translation";
import { LayersIcon } from "../layout/icons";
import { useDismiss } from "../layout/useDismiss";
import { LAYER_NAMES } from "./labels";

/** Map layer picker that sits on the map, for narrow windows. */
export function LayerButton({
  t,
  layer,
  onChange,
}: {
  t: Translate;
  layer: LayerId;
  onChange(layer: LayerId): void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(container, open, close);
  const listId = useId();
  return (
    <div
      ref={container}
      className="absolute bottom-3 left-3 z-[800] flex flex-col items-start gap-1 text-sm"
    >
      {open && (
        <div
          id={listId}
          role="group"
          aria-label={t("Map layer")}
          className="flex flex-col gap-0.5 rounded border border-line bg-panel p-1 shadow-xl"
        >
          {LAYERS.map((id) => (
            <button
              key={id}
              className="chip min-h-9 border-transparent text-left"
              aria-pressed={id === layer}
              onClick={() => {
                onChange(id);
                setOpen(false);
              }}
            >
              {t(LAYER_NAMES[id])}
            </button>
          ))}
        </div>
      )}
      <button
        className="flex h-8 items-center gap-1.5 rounded-full bg-ink/80 px-3 text-xs shadow-lg hover:text-gold"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen(!open)}
      >
        <span className="text-gold">
          <LayersIcon />
        </span>
        <span className="sr-only">{t("Map layer")}: </span>
        {t(LAYER_NAMES[layer])}
      </button>
    </div>
  );
}
