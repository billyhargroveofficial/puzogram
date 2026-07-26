/**
 * MessageInput — the text input field for composing messages.
 */
import React from 'react';
import { Box, Text, useInput } from 'ink';

interface MessageInputProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
  focused: boolean;
  disabled?: boolean;
}

export function MessageInput({
  value,
  onChange,
  onSubmit,
  focused,
  disabled = false,
}: MessageInputProps) {
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

      if (key.escape) {
        onChange('');
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
        onChange(value + input);
      }
    },
    { isActive: focused },
  );

  const borderColor = focused ? 'yellow' : 'gray';

  return (
    <Box borderStyle="round" borderColor={borderColor} paddingX={1}>
      <Text color={focused ? 'yellow' : 'gray'}>❯ </Text>
      <Text>{value}</Text>
      {focused && (
        <Text color="gray" dimColor>
          ▌
        </Text>
      )}
      {!focused && !value && (
        <Text color="gray" dimColor>
          Tab to focus · Type to send
        </Text>
      )}
    </Box>
  );
}
