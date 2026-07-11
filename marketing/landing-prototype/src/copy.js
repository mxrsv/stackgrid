export const messages = {
  en: {
    navProduct: "Stackgrid",
    navGithub: "GitHub",
    eyebrow: "A native macOS terminal for AI agent CLIs",
    headlineLead: "Run the grid.",
    headlineTail: "Keep every agent in sight.",
    subhead:
      "Stackgrid is a native macOS terminal built to launch, watch, and steer AI coding agents in parallel.",
    primaryCta: "Watch the 45-sec demo",
    secondaryCta: "View on GitHub",
    stagePreset: "Preset",
    stageWorkspace: "agent-workspace",
    stageFocus: "Focus 65%",
    sampleSessionLabel: "Sample session",
    localeLabel: "Language",
  },
  vi: {
    navProduct: "Stackgrid",
    navGithub: "GitHub",
    eyebrow: "Terminal macOS native cho các AI agent CLI",
    headlineLead: "Vận hành cả đội hình.",
    headlineTail: "Không agent nào rời khỏi tầm mắt.",
    subhead:
      "Stackgrid là terminal macOS native để khởi chạy, quan sát và điều phối nhiều AI coding agent song song.",
    primaryCta: "Xem demo 45 giây",
    secondaryCta: "Xem trên GitHub",
    stagePreset: "Bố cục",
    stageWorkspace: "agent-workspace",
    stageFocus: "Tập trung 65%",
    sampleSessionLabel: "Phiên minh hoạ",
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
