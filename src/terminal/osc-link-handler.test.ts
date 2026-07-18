// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryLinkClient } from "./link-client";
import { createOscLinkHandler } from "./osc-link-handler";

vi.mock("../chrome/events", () => ({
  reportPersistError: vi.fn(),
}));

vi.mock("./meta-key", () => {
  let held = false;
  const listeners = new Set<(held: boolean) => void>();
  return {
    isMetaHeld: () => held,
    syncMetaHeld: (next: boolean) => {
      held = next;
    },
    onMetaChange: (listener: (held: boolean) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Test helper — not part of the real module. */
    __setHeld(next: boolean) {
      held = next;
      for (const listener of listeners) {
        listener(held);
      }
    },
  };
});

function mouseEvent(metaKey: boolean): MouseEvent {
  return new MouseEvent("click", { metaKey });
}

/** Mimic Linkifier: install decorations accessors after hover returns. */
function installDecorationsAfterHover(
  hover: NonNullable<ReturnType<typeof createOscLinkHandler>["hover"]>,
  metaKey: boolean,
): { underline: boolean; pointerCursor: boolean } {
  const state = { underline: true, pointerCursor: true };
  hover(mouseEvent(metaKey), "https://example.com", {
    start: { x: 1, y: 1 },
    end: { x: 10, y: 1 },
  });
  // Same shape Linkifier uses — triggers our Object.defineProperties capture.
  const decorations = {} as {
    underline: boolean;
    pointerCursor: boolean;
  };
  Object.defineProperties(decorations, {
    underline: {
      get: () => state.underline,
      set: (v: boolean) => {
        state.underline = v;
      },
      enumerable: true,
      configurable: true,
    },
    pointerCursor: {
      get: () => state.pointerCursor,
      set: (v: boolean) => {
        state.pointerCursor = v;
      },
      enumerable: true,
      configurable: true,
    },
  });
  return state;
}

describe("createOscLinkHandler", () => {
  afterEach(async () => {
    // Flush microtasks from hover decoration sync.
    await Promise.resolve();
    await Promise.resolve();
  });

  it("plain click does not call openUrl", () => {
    const client = createMemoryLinkClient();
    const handler = createOscLinkHandler(client);
    handler.activate(mouseEvent(false), "https://example.com", {
      start: { x: 1, y: 1 },
      end: { x: 1, y: 1 },
    });
    expect(client.openedUrls).toEqual([]);
  });

  it("⌘+click opens the URI via the link client", () => {
    const client = createMemoryLinkClient();
    const handler = createOscLinkHandler(client);
    handler.activate(mouseEvent(true), "https://example.com", {
      start: { x: 1, y: 1 },
      end: { x: 1, y: 1 },
    });
    expect(client.openedUrls).toEqual(["https://example.com"]);
  });

  it.each([
    "file:///Users/me/.ssh/id_rsa",
    "vscode://file/etc/passwd",
    "javascript:alert(1)",
    "not a uri at all",
  ])("refuses to open %s", (uri) => {
    const client = createMemoryLinkClient();
    const handler = createOscLinkHandler(client);
    handler.activate(mouseEvent(true), uri, {
      start: { x: 1, y: 1 },
      end: { x: 1, y: 1 },
    });
    expect(client.openedUrls).toEqual([]);
  });

  it("openUrl rejection does not throw an unhandled rejection", async () => {
    const client = createMemoryLinkClient();
    client.openUrl = () => Promise.reject(new Error("blocked"));
    const handler = createOscLinkHandler(client);
    handler.activate(mouseEvent(true), "https://example.com", {
      start: { x: 1, y: 1 },
      end: { x: 1, y: 1 },
    });
    // Flush the microtask queue so a leaked rejection would surface.
    await Promise.resolve();
    await Promise.resolve();
  });

  it("hover without ⌘ clears underline and pointer decorations", async () => {
    const handler = createOscLinkHandler(createMemoryLinkClient());
    const state = installDecorationsAfterHover(handler.hover!, false);
    await Promise.resolve();
    expect(state.underline).toBe(false);
    expect(state.pointerCursor).toBe(false);
  });

  it("hover with ⌘ keeps underline and pointer decorations", async () => {
    const handler = createOscLinkHandler(createMemoryLinkClient());
    const state = installDecorationsAfterHover(handler.hover!, true);
    await Promise.resolve();
    expect(state.underline).toBe(true);
    expect(state.pointerCursor).toBe(true);
  });
});

