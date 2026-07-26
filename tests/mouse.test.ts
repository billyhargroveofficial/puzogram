import { describe, it, expect } from 'vitest';
import {
  MouseParser,
  parseMouse,
  MOUSE_ENABLE,
  MOUSE_DISABLE,
  type TerminalMouseEvent,
} from '../src/ui/mouse.js';

describe('MouseParser', () => {
  it('decodes a left-button press', () => {
    const { events } = parseMouse('\x1b[<0;5;3M');
    expect(events).toEqual<TerminalMouseEvent[]>([
      { type: 'press', button: 'left', col: 4, row: 2 },
    ]);
  });

  it('decodes a left-button release', () => {
    const { events } = parseMouse('\x1b[<0;5;3m');
    expect(events[0].type).toBe('release');
  });

  it('decodes middle and right buttons', () => {
    const { events } = parseMouse('\x1b[<1;1;1M\x1b[<2;1;1M');
    expect(events[0].button).toBe('middle');
    expect(events[1].button).toBe('right');
  });

  it('decodes wheel up and wheel down', () => {
    const { events } = parseMouse('\x1b[<64;10;4M\x1b[<65;10;4M');
    expect(events[0]).toMatchObject({ button: 'wheel-up', type: 'press' });
    expect(events[1]).toMatchObject({ button: 'wheel-down', type: 'press' });
  });

  it('decodes motion events (drag bit)', () => {
    const { events } = parseMouse('\x1b[<32;7;8M');
    expect(events[0]).toMatchObject({ type: 'motion', button: 'left' });
  });

  it('handles multiple sequences in one chunk', () => {
    const { events } = parseMouse('\x1b[<0;1;1M\x1b[<64;1;1M\x1b[<0;1;1m');
    expect(events).toHaveLength(3);
  });

  it('buffers a sequence split across two feeds', () => {
    const p = new MouseParser();
    const first = p.feed('\x1b[<0;5');
    expect(first).toEqual([]);
    const second = p.feed(';3M');
    expect(second).toEqual<TerminalMouseEvent[]>([
      { type: 'press', button: 'left', col: 4, row: 2 },
    ]);
  });

  it('ignores interleaved non-mouse text', () => {
    const p = new MouseParser();
    const events = p.feed('hello\x1b[<0;2;2Mworld');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ col: 1, row: 1 });
  });

  it('does not buffer unrelated CSI sequences (arrow keys)', () => {
    const p = new MouseParser();
    // up-arrow = ESC [ A  — not a mouse seq, must not linger in buffer
    const events = p.feed('\x1b[A');
    expect(events).toEqual([]);
    // a following real event must still parse cleanly (no leftover)
    const next = p.feed('\x1b[<0;1;1M');
    expect(next).toHaveLength(1);
  });

  it('reset() clears a partial buffer', () => {
    const p = new MouseParser();
    p.feed('\x1b[<0;1');
    p.reset();
    const events = p.feed('\x1b[<0;9;9M');
    expect(events[0]).toMatchObject({ col: 8, row: 8 });
  });

  it('converts coordinates to 0-based', () => {
    const { events } = parseMouse('\x1b[<0;1;1M');
    expect(events[0]).toMatchObject({ col: 0, row: 0 });
  });
});

describe('control sequences', () => {
  it('enable/disable contain the expected modes', () => {
    expect(MOUSE_ENABLE).toContain('?1000h');
    expect(MOUSE_ENABLE).toContain('?1006h');
    expect(MOUSE_DISABLE).toContain('?1000l');
    expect(MOUSE_DISABLE).toContain('?1006l');
  });
});
