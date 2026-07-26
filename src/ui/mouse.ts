/**
 * Terminal mouse support — SGR (1006) mouse-event parser.
 *
 * Terminals (Kitty, Ghostty, xterm, …) report mouse events as escape
 * sequences when tracking is enabled. We enable button + wheel tracking
 * with SGR extended coordinates:
 *
 *   enable  = ESC [ ? 1000 h  ESC [ ? 1006 h
 *   disable = ESC [ ? 1000 l  ESC [ ? 1006 l
 *
 * An event looks like:  ESC [ < Pb ; Px ; Py M   (press / wheel)
 *                       ESC [ < Pb ; Px ; Py m   (release)
 *
 * Coordinates in the sequence are 1-based; we convert to 0-based.
 *
 * The parser is stream-safe: a sequence split across two `feed()` calls
 * is buffered and decoded once complete. Non-mouse bytes are ignored
 * (Ink's own stdin reader still sees them for keyboard handling).
 */

// ---------------------------------------------------------------------------
// Control sequences
// ---------------------------------------------------------------------------

/** Enable button-press + wheel tracking with SGR extended coords. */
export const MOUSE_ENABLE = '\x1b[?1000h\x1b[?1006h';
/** Disable mouse tracking. */
export const MOUSE_DISABLE = '\x1b[?1000l\x1b[?1006l';

// ---------------------------------------------------------------------------
// Event model
// ---------------------------------------------------------------------------

export type MouseButton = 'left' | 'middle' | 'right' | 'wheel-up' | 'wheel-down';
export type MouseEventType = 'press' | 'release' | 'motion';

export interface TerminalMouseEvent {
  type: MouseEventType;
  button: MouseButton;
  /** 0-based column (x). */
  col: number;
  /** 0-based row (y). */
  row: number;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const SGR_MOUSE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

function decodeMatch(m: RegExpExecArray): TerminalMouseEvent {
  const cb = Number(m[1]);
  const col = Number(m[2]) - 1;
  const row = Number(m[3]) - 1;
  const final = m[4];

  const isWheel = (cb & 64) !== 0;
  const isMotion = (cb & 32) !== 0;

  let button: MouseButton;
  if (isWheel) {
    button = (cb & 3) === 0 ? 'wheel-up' : 'wheel-down';
  } else {
    button = (['left', 'middle', 'right'] as const)[cb & 3] ?? 'left';
  }

  const type: MouseEventType = isMotion
    ? 'motion'
    : final === 'M'
      ? 'press'
      : 'release';

  return { type, button, col, row };
}

/**
 * Stateful, stream-safe SGR mouse parser.
 *
 * Feed it raw stdin chunks; it returns any complete mouse events decoded
 * from the accumulated buffer. Incomplete trailing sequences are kept
 * until the next `feed()`.
 */
export class MouseParser {
  private buf = '';

  feed(chunk: string): TerminalMouseEvent[] {
    this.buf += chunk;
    const events: TerminalMouseEvent[] = [];

    let match: RegExpExecArray | null;
    let lastEnd = 0;
    SGR_MOUSE.lastIndex = 0;
    while ((match = SGR_MOUSE.exec(this.buf)) !== null) {
      lastEnd = match.index + match[0].length;
      events.push(decodeMatch(match));
    }

    // Keep only a possible incomplete mouse sequence at the tail.
    let tail = this.buf.slice(lastEnd);
    const esc = tail.lastIndexOf('\x1b');
    if (esc === -1) {
      tail = '';
    } else {
      const after = tail.slice(esc);
      if (after.length >= 3) {
        tail = after[1] === '[' && after[2] === '<' ? after : '';
      } else if (after.length === 2) {
        tail = after[1] === '[' ? after : '';
      } else {
        // after.length === 1 → bare ESC, might start a sequence
        tail = after;
      }
    }

    // Safety cap so a non-mouse stream can't grow the buffer forever.
    this.buf = tail.length > 128 ? '' : tail;
    return events;
  }

  /** Drop any buffered partial sequence. */
  reset(): void {
    this.buf = '';
  }
}

/**
 * One-shot parse: decode all complete mouse sequences in `input`.
 * Returns the events and the unconsumed tail (a possible partial sequence).
 * Handy for tests and simple non-streaming use.
 */
export function parseMouse(input: string): { events: TerminalMouseEvent[]; rest: string } {
  const parser = new MouseParser();
  const events = parser.feed(input);
  return { events, rest: (parser as unknown as { buf: string }).buf };
}
