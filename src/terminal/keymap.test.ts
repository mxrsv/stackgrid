import { describe, expect, it } from "vitest";
import { matchBinding, selectTabIndex } from "./keymap";

function keyEvent(
  key: string,
  mods: Partial<
    Pick<KeyboardEvent, "metaKey" | "shiftKey" | "altKey" | "ctrlKey">
  > = {},
): KeyboardEvent {
  return {
    key,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    ...mods,
  } as KeyboardEvent;
}

describe("matchBinding", () => {
  it("keeps the existing pane bindings", () => {
    expect(matchBinding(keyEvent("d", { metaKey: true }))).toBe("split-row");
    expect(matchBinding(keyEvent("d", { metaKey: true, shiftKey: true }))).toBe(
      "split-column",
    );
    expect(matchBinding(keyEvent("w", { metaKey: true, shiftKey: true }))).toBe(
      "close-pane",
    );
    expect(matchBinding(keyEvent("]", { metaKey: true }))).toBe("focus-next");
    expect(matchBinding(keyEvent("[", { metaKey: true }))).toBe("focus-prev");
  });

  it("matches the new tab bindings", () => {
    expect(matchBinding(keyEvent("t", { metaKey: true }))).toBe("new-tab");
    expect(matchBinding(keyEvent("w", { metaKey: true }))).toBe("close-tab");
    // On a US layout Shift+] produces "}" and Shift+[ produces "{"
    expect(matchBinding(keyEvent("}", { metaKey: true, shiftKey: true }))).toBe(
      "next-tab",
    );
    expect(matchBinding(keyEvent("{", { metaKey: true, shiftKey: true }))).toBe(
      "prev-tab",
    );
  });

  it("matches Cmd+1..9 to select-tab actions", () => {
    expect(matchBinding(keyEvent("1", { metaKey: true }))).toBe("select-tab-1");
    expect(matchBinding(keyEvent("9", { metaKey: true }))).toBe("select-tab-9");
  });

  it("returns null when modifiers do not match exactly", () => {
    expect(matchBinding(keyEvent("t"))).toBeNull();
    expect(
      matchBinding(keyEvent("t", { metaKey: true, shiftKey: true })),
    ).toBeNull();
    expect(
      matchBinding(keyEvent("d", { metaKey: true, ctrlKey: true })),
    ).toBeNull();
    expect(matchBinding(keyEvent("0", { metaKey: true }))).toBeNull();
  });
});

describe("selectTabIndex", () => {
  it("parses select-tab actions into a 0-based index", () => {
    expect(selectTabIndex("select-tab-1")).toBe(0);
    expect(selectTabIndex("select-tab-9")).toBe(8);
  });

  it("returns null for every other action", () => {
    expect(selectTabIndex("new-tab")).toBeNull();
    expect(selectTabIndex("split-row")).toBeNull();
  });
});
