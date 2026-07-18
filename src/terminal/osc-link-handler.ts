import type { ILinkHandler } from "@xterm/xterm";
import { reportPersistError } from "../chrome/events";
import { defaultLinkClient, type LinkClient } from "./link-client";

/**
 * OSC 8 hyperlink handler — routes through Tauri instead of the xterm
 * fallback (`window.confirm` + `window.open`), which WKWebView blocks.
 *
 * Same convention as the custom link provider: only Cmd+click activates;
 * a plain click belongs to the terminal (selection, TUI mouse).
 */
export function createOscLinkHandler(client?: LinkClient): ILinkHandler {
  const linkClient = client ?? defaultLinkClient;
  return {
    activate(event, text) {
      if (!event.metaKey) {
        return;
      }
      linkClient.openUrl(text).catch((err: unknown) => {
        reportPersistError(`Couldn't open the link: ${String(err)}`);
      });
    },
  };
}
