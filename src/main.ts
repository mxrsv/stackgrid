import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";

const EVENT_OUTPUT = "pty:output";
const EVENT_EXIT = "pty:exit";

const term = new Terminal({
  cursorBlink: true,
  fontSize: 13,
  fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Monaco, monospace',
  lineHeight: 1.25,
  scrollback: 10_000,
  macOptionIsMeta: true,
  theme: {
    background: "#16161e",
    foreground: "#c0caf5",
    cursor: "#c0caf5",
    cursorAccent: "#16161e",
    selectionBackground: "#33467c",
    black: "#15161e",
    red: "#f7768e",
    green: "#9ece6a",
    yellow: "#e0af68",
    blue: "#7aa2f7",
    magenta: "#bb9af7",
    cyan: "#7dcfff",
    white: "#a9b1d6",
    brightBlack: "#414868",
    brightRed: "#f7768e",
    brightGreen: "#9ece6a",
    brightYellow: "#e0af68",
    brightBlue: "#7aa2f7",
    brightMagenta: "#bb9af7",
    brightCyan: "#7dcfff",
    brightWhite: "#c0caf5",
  },
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

async function main(): Promise<void> {
  const container = document.getElementById("terminal");
  if (!container) {
    throw new Error("Không tìm thấy phần tử #terminal");
  }

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

void main();
