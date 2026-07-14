/**
 * Reassembles one *logical* terminal line — a row plus the rows it wrapped
 * onto — into a string, keeping a cell position for every character so a match
 * can be mapped back to a buffer range.
 *
 * The types are structural on purpose: xterm's IBufferLine / IBufferCell
 * satisfy them, and a test can pass a plain fake.
 */

/** A wrapped line longer than this is not worth linkifying. */
const MAX_ROWS = 40;

export interface CellLike {
  getChars(): string;
  getWidth(): number;
}

export interface BufferLineLike {
  readonly isWrapped: boolean;
  getCell(x: number): CellLike | undefined;
}

export interface BufferLike {
  getLine(y: number): BufferLineLike | undefined;
}

/** Buffer position of one character; `width` is the cells it occupies. */
export interface CellSpan {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export interface LogicalLine {
  readonly text: string;
  /** `spans[i]` is where `text[i]` sits — same length as `text`. */
  readonly spans: readonly CellSpan[];
}

/** The logical line containing 0-based row `row`, or null when it is empty. */
export function readLogicalLine(
  buffer: BufferLike,
  cols: number,
  row: number,
): LogicalLine | null {
  let start = row;
  for (let step = 0; step < MAX_ROWS; step += 1) {
    if (start === 0) {
      break;
    }
    const line = buffer.getLine(start);
    if (!line || !line.isWrapped) {
      break;
    }
    start -= 1;
  }

  let text = "";
  const spans: CellSpan[] = [];
  for (let y = start; y < start + MAX_ROWS; y += 1) {
    const line = buffer.getLine(y);
    if (!line || (y > start && !line.isWrapped)) {
      break;
    }
    for (let x = 0; x < cols; x += 1) {
      const cell = line.getCell(x);
      if (!cell) {
        continue;
      }
      const width = cell.getWidth();
      if (width === 0) {
        continue; // right half of a wide character — already emitted
      }
      // A blank cell reads as "" — keep it as a space so indices stay aligned
      // with the cells and so a path never fuses with the next word.
      const chars = cell.getChars() || " ";
      for (const char of chars) {
        text += char;
        spans.push({ x, y, width });
      }
    }
  }

  return spans.length === 0 ? null : { text, spans };
}
