// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = {
  mountHero: vi.fn(),
  mountSections: vi.fn(),
  mountDialog: vi.fn(),
};

vi.mock("./directions/a.js", () => ({
  renderDirectionA: () => ({
    markup: `<section class="direction-a"></section>`,
    mount: (...args) => hooks.mountHero(...args),
  }),
  updateDirectionALocale: vi.fn(),
}));

vi.mock("./landing-sections.js", () => ({
  renderLandingSections: () => `<div class="a-landing-sections"></div>`,
  mountLandingSections: (...args) => hooks.mountSections(...args),
  updateLandingSectionsLocale: vi.fn(),
}));

vi.mock("./product-stage.js", () => ({
  mountDemoDialog: (...args) => hooks.mountDialog(...args),
}));

const noop = () => {};

/** Load main.js fresh — it mounts the page as a top-level side effect. */
async function loadMain() {
  vi.resetModules();
  document.body.innerHTML = `<main id="specimen-root"></main><div id="demo-root"></div>`;
  document.documentElement.className = "";
  await import("./main.js");
}

function hasJs() {
  return document.documentElement.classList.contains("has-js");
}

beforeEach(() => {
  hooks.mountHero = vi.fn(() => noop);
  hooks.mountSections = vi.fn(() => noop);
  hooks.mountDialog = vi.fn(() => noop);
  vi.spyOn(console, "error").mockImplementation(noop);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("main", () => {
  it("hides reveal content up front so it never flashes in", async () => {
    await loadMain();

    expect(hasJs()).toBe(true);
  });

  it("still mounts the landing sections when the hero renderer throws", async () => {
    hooks.mountHero = vi.fn(() => {
      throw new Error("WebGL context unavailable");
    });

    await loadMain();

    expect(hooks.mountSections).toHaveBeenCalledOnce();
    expect(hooks.mountDialog).toHaveBeenCalledOnce();
    expect(hasJs()).toBe(true);
  });

  it("drops has-js so content stays visible when the sections cannot mount", async () => {
    hooks.mountSections = vi.fn(() => {
      throw new Error("Landing sections root is missing.");
    });

    await loadMain();

    expect(hasJs()).toBe(false);
  });
});
