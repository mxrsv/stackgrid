import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

let prompting = false;

async function promptQuit(): Promise<void> {
  if (prompting) {
    return;
  }
  prompting = true;
  try {
    const ok = await ask("Bạn có chắc muốn thoát Stackgrid?", {
      title: "Thoát Stackgrid",
      kind: "warning",
      okLabel: "Thoát",
      cancelLabel: "Huỷ",
    });
    if (ok) {
      await invoke("confirm_quit");
    }
  } catch (err: unknown) {
    console.error("Quit prompt failed:", err);
  } finally {
    prompting = false;
  }
}

/** Cài guard cho cả nút đóng cửa sổ lẫn ⌘Q. Trả về hàm gỡ listener. */
export async function installQuitGuard(): Promise<UnlistenFn> {
  const unlistenClose = await getCurrentWindow().onCloseRequested((event) => {
    event.preventDefault();
    void promptQuit();
  });
  const unlistenQuit = await listen("quit-requested", () => {
    void promptQuit();
  });
  return () => {
    unlistenClose();
    unlistenQuit();
  };
}
