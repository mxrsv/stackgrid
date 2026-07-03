import { render } from "preact";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";
import { initSettings } from "./settings/settings-store";
import { App } from "./ui/app";

async function main(): Promise<void> {
  await initSettings();
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("#root element not found");
  }
  render(<App />, root);
}

void main();
