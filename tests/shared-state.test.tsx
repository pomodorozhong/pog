import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  createSharedStore,
  SharedProvider,
  useSharedState,
  type SharedStore,
} from "../src/sync/shared";

afterEach(cleanup);

function Panel() {
  const [open, setOpen] = useSharedState("panel.open", false);
  return (
    <button onClick={() => setOpen(!open)}>{open ? "open" : "closed"}</button>
  );
}

const show = (store: SharedStore) =>
  render(
    <SharedProvider store={store}>
      <Panel />
    </SharedProvider>,
  );

it("shares the app's state, and forgets it when the component goes", () => {
  const store = createSharedStore(false, false);
  const view = show(store);
  expect(store.values()).toEqual({ "panel.open": false });
  act(() => screen.getByRole("button").click());
  expect(screen.getByRole("button")).toHaveTextContent("open");
  expect(store.values()).toEqual({ "panel.open": true });
  view.unmount();
  expect(store.values()).toEqual({});
});

it("shows the app's value on a mirror, and ignores clicks there", () => {
  const store = createSharedStore(true, false);
  show(store);
  expect(screen.getByRole("button")).toHaveTextContent("closed");
  act(() => store.replace({ "panel.open": true }));
  expect(screen.getByRole("button")).toHaveTextContent("open");
  act(() => screen.getByRole("button").click());
  expect(screen.getByRole("button")).toHaveTextContent("open");
  // The app's component went away: back to where it starts.
  act(() => store.replace({}));
  expect(screen.getByRole("button")).toHaveTextContent("closed");
});

it("keeps equal values as they were, so nothing redraws for them", () => {
  const store = createSharedStore(true, false);
  store.replace({ selection: { kind: "node", id: "a" }, tool: "pin" });
  const selection = store.get("selection");
  store.replace({ selection: { kind: "node", id: "a" }, tool: "path" });
  expect(store.get("selection")).toBe(selection);
  expect(store.get("tool")).toBe("path");
});
