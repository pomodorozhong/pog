import { useCallback, useId, useRef } from "react";
import { LAYERS, type LayerId } from "../domain/types";
import type { Translate } from "../i18n/translation";
import { LayersIcon } from "../layout/icons";
import { useDismiss } from "../layout/useDismiss";
import { LAYER_NAMES } from "./labels";
import { useSharedState } from "../sync/shared";

/** Map layer picker that sits on the map. */
export function LayerButton({
  t,
  layer,
  onChange,
}: {
  t: Translate;
  layer: LayerId;
  onChange(layer: LayerId): void;
}) {
  const [open, setOpen] = useSharedState("layer-menu.open", false);
  const container = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
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
          className="popover flex flex-col gap-0.5"
        >
          {LAYERS.map((id) => (
            <button
              key={id}
              className="popover-item"
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
