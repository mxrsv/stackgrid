import type { ILinkHandler } from "@xterm/xterm";
import { reportPersistError } from "../chrome/events";
import { isBrowsableUrl } from "../lib/terminal-links";
import { defaultLinkClient, type LinkClient } from "./link-client";

/**
 * OSC 8 hyperlink handler — routes through Tauri instead of the xterm
 * fallback (`window.confirm` + `window.open`), which WKWebView blocks.
 *
 * Same convention as the custom link provider: only Cmd+click activates;
 * a plain click belongs to the terminal (selection, TUI mouse).
 *
 * Unlike a detected link, the URI here is whatever the output wrote, so it
 * goes through the same http/https gate the detector applies.
 */
export function createOscLinkHandler(client?: LinkClient): ILinkHandler {
  const linkClient = client ?? defaultLinkClient;
  return {
    activate(event, text) {
      if (!event.metaKey) {
        return;
      }
      if (!isBrowsableUrl(text)) {
        reportPersistError(`Only http/https links can be opened: ${text}`);
        return;
      }
      linkClient.openUrl(text).catch((err: unknown) => {
        reportPersistError(`Couldn't open the link: ${String(err)}`);
      });
    },
  };
}
