/**
 * useMouse — React hook that enables terminal mouse tracking and
 * dispatches decoded mouse events to a callback.
 *
 * Ink owns stdin in raw mode (via useInput), so we simply attach a
 * secondary `data` listener, feed the bytes through `MouseParser`, and
 * forward complete events. Keyboard bytes still reach Ink's own reader
 * untouched. Mouse tracking is a terminal *mode*, toggled once on mount
 * and restored on unmount / process exit.
 */
import { useEffect, useRef } from 'react';
import { useStdin } from 'ink';
import {
  MouseParser,
  MOUSE_ENABLE,
  MOUSE_DISABLE,
  type TerminalMouseEvent,
} from './mouse.js';

export function useMouse(onEvent: (event: TerminalMouseEvent) => void): void {
  const { stdin } = useStdin();
  const callback = useRef(onEvent);
  callback.current = onEvent;

  useEffect(() => {
    if (!stdin || !(stdin as NodeJS.ReadStream).isTTY) return;

    const parser = new MouseParser();
    const out = process.stdout;

    const enable = (): void => {
      try {
        out.write(MOUSE_ENABLE);
      } catch {
        /* stdout closed */
      }
    };
    const disable = (): void => {
      try {
        out.write(MOUSE_DISABLE);
      } catch {
        /* stdout closed */
      }
    };

    const onData = (chunk: Buffer | string): void => {
      const str = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      const events = parser.feed(str);
      for (const event of events) callback.current(event);
    };

    enable();
    stdin.on('data', onData);
    process.on('exit', disable);

    return () => {
      stdin.off('data', onData);
      process.off('exit', disable);
      disable();
      parser.reset();
    };
  }, [stdin]);
}
