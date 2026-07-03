import { describe, expect, it } from "vitest";
import { SESSION_VERSION, validateSession } from "./session-schema";

const validRaw = {
  version: 1,
  activeTab: 1,
  tabs: [
    { layout: { type: "leaf" } },
    {
      layout: {
        type: "split",
        direction: "row",
        ratio: 0.5,
        first: { type: "leaf" },
        second: { type: "leaf" },
      },
    },
  ],
};

describe("validateSession", () => {
  it("accepts a valid session", () => {
    expect(validateSession(validRaw)).toEqual(validRaw);
  });

  it("rejects missing or non-object input", () => {
    expect(validateSession(undefined)).toBeNull();
    expect(validateSession(null)).toBeNull();
    expect(validateSession("nope")).toBeNull();
  });

  it("rejects a version mismatch", () => {
    expect(validateSession({ ...validRaw, version: 2 })).toBeNull();
    expect(
      validateSession({ ...validRaw, version: SESSION_VERSION + 1 }),
    ).toBeNull();
  });

  it("rejects empty or malformed tab lists", () => {
    expect(validateSession({ ...validRaw, tabs: [] })).toBeNull();
    expect(validateSession({ ...validRaw, tabs: "x" })).toBeNull();
    expect(validateSession({ ...validRaw, tabs: [{ layout: 42 }] })).toBeNull();
  });

  it("rejects corrupt layouts", () => {
    const badRatio = {
      version: 1,
      activeTab: 0,
      tabs: [
        {
          layout: {
            type: "split",
            direction: "row",
            ratio: 1.5,
            first: { type: "leaf" },
            second: { type: "leaf" },
          },
        },
      ],
    };
    expect(validateSession(badRatio)).toBeNull();
    const badDirection = {
      version: 1,
      activeTab: 0,
      tabs: [
        {
          layout: {
            type: "split",
            direction: "diagonal",
            ratio: 0.5,
            first: { type: "leaf" },
            second: { type: "leaf" },
          },
        },
      ],
    };
    expect(validateSession(badDirection)).toBeNull();
  });

  it("clamps an out-of-range activeTab to 0", () => {
    expect(validateSession({ ...validRaw, activeTab: 99 })?.activeTab).toBe(0);
    expect(validateSession({ ...validRaw, activeTab: -1 })?.activeTab).toBe(0);
    expect(validateSession({ ...validRaw, activeTab: "x" })?.activeTab).toBe(0);
  });
});
