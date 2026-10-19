import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapDocument, PlayerDocument } from "../src/domain/types";
import { translate } from "../src/i18n/translation";
import type { GameData } from "../src/map/catalog";
import { activeProfile } from "../src/profiles/profiles";
import {
  AUTO_IMPORT_INTERVAL,
  AutoImport,
  AutoImportSwitch,
} from "../src/progress/AutoImport";
import { summarizeChanges } from "../src/progress/importSave";
import { initialDocuments } from "../src/storage/schema";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const data = {
  catalog: {
    items: [],
    graces: [
      {
        id: "grace/1",
        name: { en: "The First Step", "zh-TW": "起始之地" },
        dlc: false,
        layer: "overworld",
        x: 0,
        y: 0,
        flag: 71000,
        legacy: false,
      },
    ],
    bosses: [
      {
        id: "boss/10000800",
        name: { en: "Godrick the Grafted", "zh-TW": "Godrick" },
        dlc: false,
        flag: 10000800,
      },
    ],
    places: [],
    npcs: [],
  },
} as unknown as GameData;

const doc: MapDocument = {
  schemaVersion: 4,
  nodes: [
    {
      id: "grace/1",
      layer: "overworld",
      x: 0,
      y: 0,
      kind: "grace",
      label: "",
      ref: "grace/1",
      bosses: ["boss/10000800"],
    },
  ],
  edges: [],
};

/**
 * Render the automatic import for a linked character. The save answers with
 * `save()` each time, and its stamp is `stamp()`.
 */
function setup(
  save: () => { name: string; set: number[] } | Response,
  stamp: () => string,
  autoImport = true,
  flags: number[] = [],
) {
  const initial = initialDocuments().player;
  let player: PlayerDocument = {
    ...initial,
    autoImport,
    saveLocation: "/saves/ER0000.sl2",
    profiles: initial.profiles.map((p) => ({
      ...p,
      progress: { ...p.progress, flags },
      save: { steamId: "1", slot: 0, name: "Tarnished" },
    })),
  };
  const fetch = vi.fn(async (url: string) => {
    if (url.startsWith("/api/save/stamp"))
      return Response.json({ stamp: stamp() });
    const answer = save();
    return answer instanceof Response ? answer : Response.json(answer);
  });
  vi.stubGlobal("fetch", fetch);
  function Host() {
    const [state, setState] = useState(player);
    player = state;
    return (
      <AutoImport
        t={(key, values) => translate("en", key, values)}
        language="en"
        data={data}
        player={state}
        setPlayer={setState}
        doc={doc}
      />
    );
  }
  render(<Host />);
  return { fetch, player: () => player };
}

const flagReads = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([url]) => url === "/api/save/flags").length;

describe("importing automatically when the game saves", () => {
  it("applies the save quietly and says what changed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let set = [71000];
    let stamp = "a";
    const { fetch, player } = setup(
      () => ({ name: "Tarnished", set }),
      () => stamp,
    );
    expect(
      await screen.findByText("Imported from the save: +1 graces discovered"),
    ).toBeInTheDocument();
    expect(activeProfile(player()).progress.flags).toEqual([71000]);

    // Unchanged save: no read.
    await act(() => vi.advanceTimersByTimeAsync(AUTO_IMPORT_INTERVAL * 2));
    expect(flagReads(fetch)).toBe(1);

    set = [71000, 10000800];
    stamp = "b";
    await act(() => vi.advanceTimersByTimeAsync(AUTO_IMPORT_INTERVAL));
    expect(flagReads(fetch)).toBe(2);
    expect(activeProfile(player()).progress.flags).toEqual([71000, 10000800]);
    expect(
      screen.getByText("Imported from the save: +1 bosses beaten"),
    ).toBeInTheDocument();
  });

  it("reads again after a checksum mismatch, and waits for a change after other failures", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let status = 409;
    let stamp = "a";
    const { fetch, player } = setup(
      () =>
        status === 200
          ? { name: "Tarnished", set: [71000] }
          : Response.json({ error: "No." }, { status }),
      () => stamp,
    );
    await act(() => vi.advanceTimersByTimeAsync(AUTO_IMPORT_INTERVAL * 2));
    // The game was writing: each check reads again.
    expect(flagReads(fetch)).toBe(3);

    status = 422;
    await act(() => vi.advanceTimersByTimeAsync(AUTO_IMPORT_INTERVAL * 3));
    // A save that can't be read is read once, until it changes.
    expect(flagReads(fetch)).toBe(4);

    status = 200;
    stamp = "b";
    await act(() => vi.advanceTimersByTimeAsync(AUTO_IMPORT_INTERVAL));
    expect(flagReads(fetch)).toBe(5);
    expect(activeProfile(player()).progress.flags).toEqual([71000]);
  });

  it("never takes a grace away, but follows the save for bosses", async () => {
    const { player } = setup(
      () => ({ name: "Tarnished", set: [] }),
      () => "a",
      true,
      [71000, 10000800],
    );
    expect(
      await screen.findByText(
        "Imported from the save: 1 bosses no longer beaten",
      ),
    ).toBeInTheDocument();
    // The grace marked by hand stays; the boss the save hasn't beaten goes.
    expect(activeProfile(player()).progress.flags).toEqual([71000]);
  });

  it("reads nothing while switched off", async () => {
    const { fetch } = setup(
      () => ({ name: "Tarnished", set: [71000] }),
      () => "a",
      false,
    );
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("pauses and asks when the slot holds another character", async () => {
    const { fetch, player } = setup(
      () => ({ name: "Someone", set: [71000] }),
      () => "a",
    );
    expect(
      await screen.findByText(
        /Automatic import paused: slot 1 now holds “Someone”, not “Tarnished”/,
      ),
    ).toBeInTheDocument();
    expect(activeProfile(player()).progress.flags).toEqual([]);

    fireEvent.click(screen.getByText("Import from “Someone”"));
    expect(
      await screen.findByText("Imported from the save: +1 graces discovered"),
    ).toBeInTheDocument();
    expect(activeProfile(player()).save?.name).toBe("Someone");
    expect(flagReads(fetch)).toBe(2);
  });
});

describe("the automatic import's switch", () => {
  function Host({ linked }: { linked: boolean }) {
    const initial = initialDocuments().player;
    const [player, setPlayer] = useState<PlayerDocument>({
      ...initial,
      profiles: initial.profiles.map((p) => ({
        ...p,
        save: linked ? { steamId: "1", slot: 0, name: "Tarnished" } : null,
      })),
    });
    return (
      <AutoImportSwitch
        t={(key, values) => translate("en", key, values)}
        player={player}
        setPlayer={setPlayer}
      />
    );
  }

  it("says what it watches, and turns off", () => {
    render(<Host linked />);
    expect(
      screen.getByText("On: watching Tarnished (slot 1)."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Graces are only added, never taken away/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("switch", { name: "Import automatically" }),
    );
    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(screen.getByText(/^Off: progress changes only/)).toBeInTheDocument();
  });

  it("says it waits for a linked character", () => {
    render(<Host linked={false} />);
    expect(
      screen.getByText(/^On: starts once this playthrough is linked/),
    ).toBeInTheDocument();
  });
});

describe("the automatic import's note", () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    translate("en", key, values);
  const isBoss = (flag: number) => flag === 10000800;
  it("leaves out what didn't change", () => {
    expect(
      summarizeChanges(t, { added: [71000], removed: [], flags: [] }, isBoss),
    ).toBe("+1 graces discovered");
    expect(
      summarizeChanges(
        t,
        { added: [10000800], removed: [71000], flags: [] },
        isBoss,
      ),
    ).toBe("1 graces no longer discovered · +1 bosses beaten");
  });
});
