import { describe, expect, it } from "vitest";
import { readLogicalLine, type BufferLike } from "./logical-line";

/** Builds a buffer from rows of text; a row prefixed `>` is a wrap of the one above. */
function fakeBuffer(rows: readonly string[], cols: number): BufferLike {
  const lines = rows.map((row) => ({
    isWrapped: row.startsWith(">"),
    text: row.startsWith(">") ? row.slice(1) : row,
  }));
  return {
    getLine(y) {
      const line = lines[y];
      if (line === undefined) {
        return undefined;
      }
      return {
        isWrapped: line.isWrapped,
        getCell(x) {
          if (x >= cols) {
            return undefined;
          }
          const char = line.text[x] ?? " ";
          return {
            getChars: () => (char === " " ? "" : char),
            // A `#` stands in for a wide character: it owns the next cell too.
            getWidth: () => (char === "#" ? 2 : 1),
          };
        },
      };
    },
  };
}

describe("readLogicalLine", () => {
  it("reads a single row and maps every character to its cell", () => {
    const line = readLogicalLine(fakeBuffer(["ab"], 2), 2, 0);
    expect(line?.text).toBe("ab");
    expect(line?.spans).toEqual([
      { x: 0, y: 0, width: 1 },
      { x: 1, y: 0, width: 1 },
    ]);
  });

  it("joins the rows a line wrapped onto", () => {
    const line = readLogicalLine(fakeBuffer(["ab", ">cd"], 2), 2, 0);
    expect(line?.text).toBe("abcd");
    expect(line?.spans[2]).toEqual({ x: 0, y: 1, width: 1 });
  });

  it("walks back up to the start of a wrapped line", () => {
    const line = readLogicalLine(fakeBuffer(["ab", ">cd"], 2), 2, 1);
    expect(line?.text).toBe("abcd");
  });

  it("stops at the next unwrapped row", () => {
    const line = readLogicalLine(fakeBuffer(["ab", "cd"], 2), 2, 0);
    expect(line?.text).toBe("ab");
  });

  it("keeps blank cells as spaces so indices stay aligned", () => {
    const line = readLogicalLine(fakeBuffer(["a b"], 3), 3, 0);
    expect(line?.text).toBe("a b");
    expect(line?.spans[2]).toEqual({ x: 2, y: 0, width: 1 });
  });

  it("records the cell width of a wide character", () => {
    const line = readLogicalLine(fakeBuffer(["#b"], 2), 2, 0);
    expect(line?.spans[0]).toEqual({ x: 0, y: 0, width: 2 });
  });

  it("returns null past the end of the buffer", () => {
    expect(readLogicalLine(fakeBuffer(["ab"], 2), 2, 5)).toBeNull();
  });
});
