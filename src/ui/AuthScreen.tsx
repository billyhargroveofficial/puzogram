/**
 * AuthScreen — phone number → code → 2FA password flow.
 */
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppStore } from '../store/app.js';

interface AuthScreenProps {
  onSendCode: (phone: string) => Promise<void>;
  onSignIn: (code: string) => Promise<void>;
  onPassword: (password: string) => Promise<void>;
}

export function AuthScreen({ onSendCode, onSignIn, onPassword }: AuthScreenProps) {
  const authPhase = useAppStore((s) => s.authPhase);
  const authError = useAppStore((s) => s.authError);
  const statusMessage = useAppStore((s) => s.statusMessage);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  useInput(async (input, key) => {
    if (busy) return;

    if (key.return) {
      if (!value.trim()) return;
      setBusy(true);
      try {
        if (authPhase === 'phone') {
          await onSendCode(value.trim());
        } else if (authPhase === 'code') {
          await onSignIn(value.trim());
        } else if (authPhase === 'password') {
          await onPassword(value.trim());
        }
      } finally {
        setBusy(false);
        setValue('');
      }
      return;
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      return;
    }

    if (key.escape) {
      setValue('');
      return;
    }

    // Ignore control characters
    if (input && !key.ctrl && !key.meta) {
      setValue((v) => v + input);
    }
  });

  const prompt =
    authPhase === 'phone'
      ? 'Phone number (e.g. +1234567890):'
      : authPhase === 'code'
        ? 'Enter the code from Telegram:'
        : 'Enter your 2FA password:';

  const masked = authPhase === 'password' ? '•'.repeat(value.length) : value;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ╔══════════════════════════════════════╗
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ║{'  '}
        </Text>
        <Text bold color="white">
          billytelega
        </Text>
        <Text color="gray"> — terminal Telegram client</Text>
        <Text bold color="cyan">
          {'  '}║
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ╚══════════════════════════════════════╝
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">{prompt}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="green">❯ </Text>
        <Text>{masked}</Text>
        <Text color="gray" dimColor>
          ▌
        </Text>
      </Box>

      {(busy || statusMessage) && (
        <Box marginTop={1}>
          <Text color="yellow">⏳ {statusMessage ?? 'Working…'}</Text>
        </Box>
      )}

      {authError && (
        <Box marginTop={1}>
          <Text color="red">✖ {authError}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press Enter to submit · Esc to clear
        </Text>
      </Box>
    </Box>
  );
}
