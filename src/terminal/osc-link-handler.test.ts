// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createMemoryLinkClient } from "./link-client";
import { createOscLinkHandler } from "./osc-link-handler";

vi.mock("../chrome/events", () => ({
  reportPersistError: vi.fn(),
}));

function mouseEvent(metaKey: boolean): MouseEvent {
  return new MouseEvent("click", { metaKey });
}

describe("createOscLinkHandler", () => {
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
});
