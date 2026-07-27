/**
 * MessageInput — the text input field for composing messages.
 */
import React, { useRef } from 'react';
import { Box, Text, useInput, type DOMElement } from 'ink';
import { useOnPress } from '@ink-tools/ink-mouse';
import { theme } from '../display/theme.js';

interface MessageInputProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
  focused: boolean;
  disabled?: boolean;
  /** Fired when the input is pressed (click-to-focus). */
  onFocusPane?: () => void;
}

/**
 * SGR mouse escape fragments. The mouse library only *listens* on stdin — the
 * sequences still reach Ink's input parser, which strips just the leading ESC
 * and hands us literal junk like "[<0;85;33M" (or a batched motion blob).
 * Strip those fragments so clicks/wheel/movement never type into the field.
 */
const MOUSE_SEQ_RE = /\x1b?\[<\d+;\d+;\d+[Mm]/g;

export function MessageInput({
  value,
  onChange,
  onSubmit,
  focused,
  disabled = false,
  onFocusPane,
}: MessageInputProps) {
  const rootRef = useRef<DOMElement>(null);
  // Clicking the input focuses it (so typing works without Tab).
  useOnPress(rootRef, () => onFocusPane?.());
  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        if (value.trim()) {
          onSubmit(value.trim());
        }
        return;
      }

      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }

      // Ctrl+U — clear line
      if (key.ctrl && input === 'u') {
        onChange('');
        return;
      }

      // Ctrl+W — delete word
      if (key.ctrl && input === 'w') {
        onChange(value.replace(/\S+\s*$/, ''));
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        const clean = input.replace(MOUSE_SEQ_RE, '');
        if (clean) onChange(value + clean);
      }
    },
    { isActive: focused },
  );

  const borderColor = focused ? theme.borderFocus : theme.border;

  return (
    <Box ref={rootRef} width="100%" flexShrink={0} borderStyle="round" borderColor={borderColor} paddingX={1}>
      <Text bold color={focused ? theme.accent : theme.textFaint}>
        ❯{' '}
      </Text>
      <Text color={theme.text}>{value}</Text>
      {focused && (
        <Text color={theme.textFaint} dimColor>
          ▌
        </Text>
      )}
      {!focused && !value && (
        <Text color={theme.textGhost} dimColor>
          Tab to focus · Type to send
        </Text>
      )}
    </Box>
  );
}
