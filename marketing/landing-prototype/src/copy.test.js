import { describe, expect, it } from "vitest";
import { messages } from "./copy.js";

describe("hero CTA copy", () => {
  it("uses current macOS and demo-duration labels in both locales", () => {
    expect(messages.en.primaryCta).toBe("Download for macOS");
    expect(messages.en.secondaryCta).toBe("Watch the 16-sec demo");
    expect(messages.vi.primaryCta).toBe("Tải về cho macOS");
    expect(messages.vi.secondaryCta).toBe("Xem demo 16 giây");
  });
});
