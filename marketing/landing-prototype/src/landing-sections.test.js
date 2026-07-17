// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mountLandingSections,
  renderLandingSections,
  updateLandingSectionsLocale,
} from "./landing-sections.js";
import { messages } from "./sections-copy.js";

function allValues(locale) {
  return Object.values(messages[locale]);
}

class IntersectionObserverStub {
  static instances = [];

  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    IntersectionObserverStub.instances.push(this);
  }

  trigger(entries) {
    this.callback(entries, this);
  }
}

function installVideoStubs(video) {
  let paused = true;

  Object.defineProperty(video, "paused", {
    configurable: true,
    get: () => paused,
  });

  video.play = vi.fn().mockImplementation(() => {
    paused = false;
    video.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  video.pause = vi.fn().mockImplementation(() => {
    paused = true;
    video.dispatchEvent(new Event("pause"));
  });

  return video;
}

function mountSectionMarkup() {
  const root = document.createElement("div");
  root.innerHTML = renderLandingSections(messages.en);
  document.body.append(root);
  return root;
}

function observerWithThreshold(threshold) {
  return IntersectionObserverStub.instances.find(
    (observer) => observer.options.threshold === threshold,
  );
}

let reducedMotion;

beforeEach(() => {
  IntersectionObserverStub.instances = [];
  globalThis.IntersectionObserver = IntersectionObserverStub;
  window.IntersectionObserver = IntersectionObserverStub;
  reducedMotion = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn(() => reducedMotion);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  delete globalThis.IntersectionObserver;
});

describe("sections-copy", () => {
  it("EN and VI share the same key set", () => {
    expect(Object.keys(messages.en).sort()).toEqual(
      Object.keys(messages.vi).sort(),
    );
  });

  it("does not contain deprecated 45-sec or Macos typos", () => {
    for (const locale of ["en", "vi"]) {
      for (const value of allValues(locale)) {
        expect(value).not.toContain("45-sec");
        expect(value).not.toContain("Macos");
      }
    }
  });
});

describe("mountLandingSections", () => {
  it("reveals section elements once and disposes only its own observers", () => {
    const root = mountSectionMarkup();
    const outsideReveal = document.createElement("div");
    outsideReveal.dataset.reveal = "";
    document.body.append(outsideReveal);

    const dispose = mountLandingSections(root);
    const revealObserver = observerWithThreshold(0.14);
    const videoObserver = observerWithThreshold(0.45);
    const reveal = root.querySelector("[data-reveal]");

    expect(revealObserver.observe).toHaveBeenCalledTimes(4);
    expect(revealObserver.observe).not.toHaveBeenCalledWith(outsideReveal);

    revealObserver.trigger([{ isIntersecting: true, target: reveal }]);

    expect(reveal.classList.contains("is-visible")).toBe(true);
    expect(revealObserver.unobserve).toHaveBeenCalledWith(reveal);

    dispose();

    expect(revealObserver.disconnect).toHaveBeenCalledOnce();
    expect(videoObserver.disconnect).toHaveBeenCalledOnce();
  });

  it("autoplays in-view video, pauses it outside the viewport, and syncs the custom control", async () => {
    const root = mountSectionMarkup();
    const video = installVideoStubs(root.querySelector("[data-workflow-video]"));
    const toggle = root.querySelector("[data-video-toggle]");
    const label = root.querySelector("[data-video-label]");
    const icon = root.querySelector("[data-video-icon]");

    mountLandingSections(root);
    const videoObserver = observerWithThreshold(0.45);
    videoObserver.trigger([
      { isIntersecting: true, intersectionRatio: 0.45, target: video },
    ]);
    await Promise.resolve();

    expect(video.play).toHaveBeenCalledOnce();
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe(
      messages.en.workflowVideoPauseAria,
    );
    expect(label.textContent).toBe(messages.en.workflowVideoPauseLabel);
    expect(icon.textContent).toBe("Ⅱ");

    toggle.click();

    expect(video.pause).toHaveBeenCalledOnce();
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(label.textContent).toBe(messages.en.workflowVideoPlayLabel);
    expect(icon.textContent).toBe("▶");

    videoObserver.trigger([
      { isIntersecting: false, intersectionRatio: 0, target: video },
    ]);

    expect(video.pause).toHaveBeenCalledTimes(2);
  });

  it("reveals immediately and leaves video paused under reduced motion while allowing manual play", async () => {
    reducedMotion.matches = true;
    const root = mountSectionMarkup();
    const video = installVideoStubs(root.querySelector("[data-workflow-video]"));
    const toggle = root.querySelector("[data-video-toggle]");

    mountLandingSections(root);
    const videoObserver = observerWithThreshold(0.45);

    expect(root.querySelectorAll("[data-reveal].is-visible")).toHaveLength(4);
    expect(observerWithThreshold(0.14)).toBeUndefined();

    videoObserver.trigger([
      { isIntersecting: true, intersectionRatio: 1, target: video },
    ]);
    await Promise.resolve();

    expect(video.play).not.toHaveBeenCalled();

    toggle.click();
    await Promise.resolve();

    expect(video.play).toHaveBeenCalledOnce();
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("stops responding to video controls after dispose", () => {
    const root = mountSectionMarkup();
    const video = installVideoStubs(root.querySelector("[data-workflow-video]"));
    const toggle = root.querySelector("[data-video-toggle]");

    const dispose = mountLandingSections(root);
    dispose();
    toggle.click();

    expect(video.play).not.toHaveBeenCalled();
    expect(video.pause).not.toHaveBeenCalled();
  });
});

describe("updateLandingSectionsLocale", () => {
  it("updates scoped section copy and video copy variants without replacing the DOM", () => {
    const root = mountSectionMarkup();
    const video = root.querySelector("[data-workflow-video]");
    const toggle = root.querySelector("[data-video-toggle]");
    const label = root.querySelector("[data-video-label]");
    const outsideCopy = document.createElement("span");
    outsideCopy.dataset.sectionCopy = "workflowEyebrow";
    outsideCopy.textContent = messages.en.workflowEyebrow;
    document.body.append(outsideCopy);

    updateLandingSectionsLocale(root, messages.vi);

    expect(
      root.querySelector('[data-section-copy="workflowEyebrow"]').textContent,
    ).toBe(messages.vi.workflowEyebrow);
    expect(video.getAttribute("aria-label")).toBe(messages.vi.workflowVideoLabel);
    expect(toggle.getAttribute("aria-label")).toBe(
      messages.vi.workflowVideoPlayAria,
    );
    expect(label.textContent).toBe(messages.vi.workflowVideoPlayLabel);
    expect(root.querySelector("[data-workflow-video]")).toBe(video);
    expect(outsideCopy.textContent).toBe(messages.en.workflowEyebrow);
  });
});

describe("renderLandingSections", () => {
  const html = renderLandingSections(messages.en);

  it("contains exactly one workflow section", () => {
    expect(
      [...html.matchAll(/<section[^>]*class="[^"]*a-section-workflow[^"]*"/g)],
    ).toHaveLength(1);
  });

  it("contains a terminal manifest with four rows", () => {
    expect(
      [...html.matchAll(/<article[^>]*class="[^"]*a-section-proof__row[^"]*"/g)],
    ).toHaveLength(4);
  });

  it("contains exactly one footer", () => {
    expect(
      [...html.matchAll(/<footer[^>]*class="[^"]*a-section-footer[^"]*"/g)],
    ).toHaveLength(1);
  });

  it("does not contain demo-only markup or copy", () => {
    expect(html).not.toContain("demo-chip");
    expect(html).not.toContain("hero-stage");
    expect(html).not.toContain("sections demo for layout review");
    expect(html).not.toContain("Live hero");
  });

  it("uses data-section-copy for static locale strings", () => {
    const runtimeKeys = new Set([
      "metaTitle",
      "metaDescription",
      "workflowVideoPlayLabel",
      "workflowVideoPauseLabel",
      "workflowVideoPlayAria",
      "workflowVideoPauseAria",
    ]);
    for (const key of Object.keys(messages.en)) {
      if (runtimeKeys.has(key)) continue;
      expect(html).toContain(`data-section-copy="${key}"`);
    }
    expect(html).toContain('data-section-copy-play="workflowVideoPlayLabel"');
    expect(html).toContain('data-section-copy-pause="workflowVideoPauseLabel"');
    expect(html).toContain('data-section-copy-play-aria="workflowVideoPlayAria"');
    expect(html).toContain('data-section-copy-pause-aria="workflowVideoPauseAria"');
  });

  it("includes workflow video assets and lifecycle hooks", () => {
    expect(html).toContain('poster="/stackgrid-cmd-e-poster.png"');
    expect(html).toContain('src="/stackgrid-cmd-e.webm"');
    expect(html).toContain('src="/stackgrid-cmd-e.mp4"');
    expect(html).toContain('preload="metadata"');
    expect(html).toContain("data-workflow-video");
    expect(html).toContain("data-video-toggle");
    expect(html).toContain("data-reveal");
  });

  it("places GitHub only in footer utility navigation", () => {
    const githubLinks = [...html.matchAll(/href="https:\/\/github\.com\/mxrsv\/stackgrid"/g)];
    expect(githubLinks).toHaveLength(1);
    expect(html).toContain("a-section-footer__bar");
  });
});
