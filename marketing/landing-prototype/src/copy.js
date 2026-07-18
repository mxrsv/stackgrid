export const messages = {
  en: {
    navProduct: "Stackgrid",
    navGithub: "GitHub",
    headlineLead: "Run the grid.",
    headlineTail: "Keep every agent in sight.",
    subhead:
      "Stackgrid is a native macOS terminal built to launch, watch, and steer AI coding agents in parallel.",
    primaryCta: "Download for macOS",
    secondaryCta: "Watch the 16-sec demo",
    localeLabel: "Language",
  },
  vi: {
    navProduct: "Stackgrid",
    navGithub: "GitHub",
    headlineLead: "Vận hành cả đội hình.",
    headlineTail: "Không agent nào rời khỏi tầm mắt.",
    subhead:
      "Stackgrid là terminal macOS native để khởi chạy, quan sát và điều phối nhiều AI coding agent song song.",
    primaryCta: "Tải về cho macOS",
    secondaryCta: "Xem demo 16 giây",
    localeLabel: "Ngôn ngữ",
  },
};

export function resolveLocale(search, navigatorLanguage) {
  const override = new URLSearchParams(search).get("lang");

  if (override === "en" || override === "vi") {
    return override;
  }

  return navigatorLanguage.toLowerCase().startsWith("vi") ? "vi" : "en";
}
