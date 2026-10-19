import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapDocument, PlayerDocument } from "../src/domain/types";
import { translate } from "../src/i18n/translation";
import type { CatalogBoss, GameData } from "../src/map/catalog";
import { activeProfile } from "../src/profiles/profiles";
import { SaveImport } from "../src/progress/SaveImport";
import { initialDocuments } from "../src/storage/schema";

afterEach(cleanup);

const boss = (id: number, en: string, flag = id): CatalogBoss => ({
  id: `boss/${id}`,
  name: { en, "zh-TW": en },
  dlc: false,
  flag,
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
      boss(10000800, "Godrick the Grafted"),
      boss(1043530800, "Bell Bearing Hunter"),
      // A boss whose param row shares another boss's flag.
      boss(1039510800, "Night's Cavalry", 1043530800),
      boss(14000800, "Rennala, Queen of the Full Moon"),
    ],
    places: [],
    npcs: [],
  },
} as unknown as GameData;

/** A map with these bosses at a pin, and the rest at a grace. */
const mapWith = (bosses: string[]): MapDocument => ({
  schemaVersion: 4,
  nodes: [
    {
      id: "j",
      layer: "overworld",
      x: 0,
      y: 0,
      kind: "junction",
      label: "",
      ref: null,
      bosses: bosses.slice(0, 1),
    },
    {
      id: "grace/1",
      layer: "overworld",
      x: 0,
      y: 0,
      kind: "grace",
      label: "",
      ref: "grace/1",
      bosses: bosses.slice(1),
    },
  ],
  edges: [],
});
const ALL_BOSSES = [
  "boss/10000800",
  "boss/1043530800",
  "boss/1039510800",
  "boss/14000800",
];

function setup(
  progressFlags: number[],
  set: number[],
  doc = mapWith(ALL_BOSSES),
) {
  const initial = initialDocuments().player;
  let player: PlayerDocument = {
    ...initial,
    profiles: initial.profiles.map((p) => ({
      ...p,
      progress: { ...p.progress, flags: progressFlags },
      save: { steamId: "1", slot: 0, name: "Tarnished" },
    })),
  };
  const fetch = vi.fn(async () => Response.json({ name: "Tarnished", set }));
  vi.stubGlobal("fetch", fetch);
  render(
    <SaveImport
      t={(key, values) => translate("en", key, values)}
      language="en"
      data={data}
      player={player}
      setPlayer={(next) => (player = next)}
      doc={doc}
    />,
  );
  return { fetch, player: () => player };
}

describe("importing progress with bosses", () => {
  it("asks about boss flags too and lists bosses beaten", async () => {
    const { fetch, player } = setup([14000800], [71000, 10000800, 1043530800]);
    fireEvent.click(screen.getByText("Import progress from save"));

    const asked = JSON.parse(
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    ).flags;
    expect([...asked].sort()).toEqual(
      [71000, 10000800, 1043530800, 14000800].sort(),
    );
    expect(
      await screen.findByText(
        "+1 graces discovered, −0 not discovered · +2 bosses beaten, −1 not beaten",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Beaten Godrick the Grafted/)).toBeInTheDocument();
    expect(
      screen.getByText(/Beaten Bell Bearing Hunter \/ Night's Cavalry/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Not beaten: Rennala, Queen of the Full Moon/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Apply"));
    expect(activeProfile(player()).progress.flags).toEqual([
      71000, 10000800, 1043530800,
    ]);
  });

  it("only asks about, and changes, bosses at the map's pins and graces", async () => {
    const { fetch, player } = setup(
      [14000800],
      [71000, 10000800],
      mapWith(["boss/10000800"]),
    );
    fireEvent.click(screen.getByText("Import progress from save"));
    const asked = JSON.parse(
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    ).flags;
    expect([...asked].sort()).toEqual([71000, 10000800].sort());
    expect(
      await screen.findByText(
        "+1 graces discovered, −0 not discovered · +1 bosses beaten, −0 not beaten",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply"));
    // Rennala isn't on the map, so the flag marked by hand stays.
    expect(activeProfile(player()).progress.flags).toEqual([
      71000, 10000800, 14000800,
    ]);
  });

  it("leaves out the boss summary when no boss changed", async () => {
    setup([], [71000]);
    fireEvent.click(screen.getByText("Import progress from save"));
    expect(
      await screen.findByText("+1 graces discovered, −0 not discovered"),
    ).toBeInTheDocument();
  });
});
