import { describe, expect, it } from "vitest";
import { extractLinkCandidates } from "./terminal-links";

describe("extractLinkCandidates", () => {
  it("matches http and https urls", () => {
    const found = extractLinkCandidates(
      "see https://example.com/a?b=1 and http://localhost:5173/",
    );
    expect(found.map((c) => c.target)).toEqual([
      "https://example.com/a?b=1",
      "http://localhost:5173/",
    ]);
    expect(found.every((c) => c.kind === "url")).toBe(true);
  });

  it("drops trailing punctuation from a url", () => {
    const [url] = extractLinkCandidates("open https://example.com/docs.");
    expect(url.target).toBe("https://example.com/docs");
  });

  it("matches absolute, tilde, dot and bare relative paths", () => {
    const found = extractLinkCandidates(
      "/etc/hosts ~/notes.md ./src/a.ts ../b.ts src/foo.ts",
    );
    expect(found.map((c) => c.target)).toEqual([
      "/etc/hosts",
      "~/notes.md",
      "./src/a.ts",
      "../b.ts",
      "src/foo.ts",
    ]);
  });

  it("matches a bare filename with an extension", () => {
    const [file] = extractLinkCandidates("edited pane.ts today");
    expect(file.target).toBe("pane.ts");
  });

  it("parses a line suffix", () => {
    const [file] = extractLinkCandidates("src/foo.ts:12");
    expect(file).toMatchObject({ target: "src/foo.ts", line: 12, col: null });
    expect(file.text).toBe("src/foo.ts:12");
  });

  it("parses a line and column suffix", () => {
    const [file] = extractLinkCandidates("at src/foo.ts:12:34 failed");
    expect(file).toMatchObject({ target: "src/foo.ts", line: 12, col: 34 });
  });

  it("keeps a sentence-final dot out of the path", () => {
    const [file] = extractLinkCandidates("look at src/foo.ts.");
    expect(file.target).toBe("src/foo.ts");
    expect(file.text).toBe("src/foo.ts");
  });

  it("does not match a version number", () => {
    expect(extractLinkCandidates("bumped to v0.2.1 today")).toEqual([]);
  });

  it("does not match a bare word without a dot or slash", () => {
    expect(extractLinkCandidates("the quick brown fox")).toEqual([]);
  });

  it("does not carve a path out of a url", () => {
    const found = extractLinkCandidates("https://github.com/owner/repo.git");
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("url");
  });

  it("reports the source range of each candidate", () => {
    const source = "ok src/foo.ts:9 done";
    const [file] = extractLinkCandidates(source);
    expect(source.slice(file.start, file.end)).toBe(file.text);
  });

  it("caps the number of candidates", () => {
    const source = Array.from({ length: 40 }, (_, i) => `f${i}.ts`).join(" ");
    expect(extractLinkCandidates(source, 5)).toHaveLength(5);
  });

  it("ignores a zero line number", () => {
    const [file] = extractLinkCandidates("src/foo.ts:0");
    expect(file.line).toBeNull();
  });
});
