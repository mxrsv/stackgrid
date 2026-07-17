import { describe, expect, it } from "vitest";
import { renderLandingSections } from "./landing-sections.js";
import { messages } from "./sections-copy.js";

function allValues(locale) {
  return Object.values(messages[locale]);
}

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
