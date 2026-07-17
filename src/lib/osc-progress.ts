/**
 * OSC 9;4 progress-report parsing (ConEmu convention, emitted by Claude Code
 * and rendered natively by Ghostty / iTerm2 / Windows Terminal):
 *
 *   ESC ] 9 ; 4 ; <state> [; <progress>] (BEL | ESC \)
 *
 * States: 0 = clear/idle, 1 = normal progress, 2 = error, 3 = indeterminate
 * (busy), 4 = warning. Anything non-zero means "the app is working".
 */

/** A sequence with no state param means "clear" by convention. */
const CLEAR = 0;

const OSC_9_4 = /\x1b\]9;4(?:;(\d+)(?:;\d*)?)?(?:\x07|\x1b\\)/g;

/**
 * Last OSC 9;4 state in `text`, or null when the text has none. Pure — feed
 * it raw PTY output; later sequences in the same chunk win.
 */
export function lastProgressState(text: string): number | null {
  let state: number | null = null;
  for (const match of text.matchAll(OSC_9_4)) {
    state = match[1] === undefined ? CLEAR : Number.parseInt(match[1], 10);
  }
  return state;
}

/**
 * Longest OSC 9;4 sequence is ~16 bytes ("\x1b]9;4;<s>;<100>\x1b\\") — keep
 * this many trailing bytes of each chunk so a sequence split across two PTY
 * reads is still seen when the next chunk arrives.
 */
export const OSC_CARRY_LENGTH = 24;
