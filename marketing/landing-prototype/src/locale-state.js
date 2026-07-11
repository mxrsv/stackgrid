import { resolveLocale } from "./copy.js";

export const LOCALES = ["en", "vi"];

export function readLocale(location) {
  const url = new URL(location.href);
  const navigatorLanguage = globalThis.navigator?.language ?? "";

  return resolveLocale(url.search, navigatorLanguage);
}

export function writeLocale(locale) {
  const url = new URL(window.location.href);

  url.searchParams.set("lang", LOCALES.includes(locale) ? locale : "en");
  window.history.replaceState(window.history.state, "", url);
}
