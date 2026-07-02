import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FONT_FALLBACK, type Settings } from "../settings/settings-schema";
import { resolveTheme } from "../settings/themes";

const EVENT_OUTPUT = "pty:output";
const EVENT_EXIT = "pty:exit";

export interface TerminalController {
  attach(container: HTMLElement): Promise<void>;
  applySettings(next: Settings): void;
  focus(): void;
}

function toFontStack(family: string): string {
  // Người dùng có thể nhập cả chuỗi fallback riêng — khi đó dùng nguyên văn
  if (family.includes(",")) {
    return family;
  }
  return `"${family}", ${FONT_FALLBACK}`;
}

export function createTerminalController(
  initial: Settings,
): TerminalController {
  const term = new Terminal({
    cursorBlink: true,
    fontSize: initial.fontSize,
    fontFamily: toFontStack(initial.fontFamily),
    lineHeight: 1.25,
    scrollback: 10_000,
    macOptionIsMeta: true,
    theme: resolveTheme(initial),
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());

  let shellExited = false;

  async function spawnShell(): Promise<void> {
    shellExited = false;
    try {
      await invoke("spawn_shell", { cols: term.cols, rows: term.rows });
    } catch (err) {
      term.writeln(`\r\n\x1b[31mKhông khởi động được shell: ${err}\x1b[0m`);
      shellExited = true;
    }
  }

  async function attach(container: HTMLElement): Promise<void> {
    term.open(container);
    fitAddon.fit();
    term.focus();

    await listen<string>(EVENT_OUTPUT, (event) => {
      term.write(event.payload);
    });

    await listen(EVENT_EXIT, () => {
      shellExited = true;
      term.writeln(
        "\r\n\x1b[33m[Phiên đã kết thúc — nhấn Enter để mở phiên mới]\x1b[0m",
      );
    });

    term.onData((data) => {
      if (shellExited) {
        if (data === "\r") {
          term.clear();
          void spawnShell();
        }
        return;
      }
      invoke("write_pty", { data }).catch((err) => {
        console.error("write_pty thất bại:", err);
      });
    });

    term.onResize(({ cols, rows }) => {
      invoke("resize_pty", { cols, rows }).catch(() => {
        // Chưa có phiên nào — bỏ qua
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);

    await spawnShell();
  }

  function applySettings(next: Settings): void {
    term.options.fontFamily = toFontStack(next.fontFamily);
    term.options.fontSize = next.fontSize;
    term.options.theme = resolveTheme(next);
    fitAddon.fit();
  }

  return {
    attach,
    applySettings,
    focus: () => term.focus(),
  };
}
