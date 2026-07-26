/**
 * MessageList — displays messages with sender grouping and rich styling.
 */
import React from 'react';
import { Box, Text } from 'ink';
import {
  formatTimestamp,
  wrapText,
  truncateText,
  type DisplayMessage,
} from '../display/format.js';

interface MessageListProps {
  messages: DisplayMessage[];
  chatTitle: string;
  chatType?: string;
  width: number;
  height: number;
  loading: boolean;
  focused: boolean;
}

/** Check if two messages are from the same sender within 5 minutes. */
function isGrouped(prev: DisplayMessage, curr: DisplayMessage): boolean {
  if (prev.senderName !== curr.senderName) return false;
  if (prev.isOutgoing !== curr.isOutgoing) return false;
  const diffMs = Math.abs(curr.date.getTime() - prev.date.getTime());
  return diffMs < 5 * 60 * 1000;
}

export function MessageList({
  messages,
  chatTitle,
  chatType,
  width,
  height,
  loading,
  focused,
}: MessageListProps) {
  const now = new Date();
  const borderColor = focused ? 'green' : 'gray';
  const bodyWidth = width - 6; // padding + indent

  // Show the last N messages that fit
  const maxLines = Math.max(height - 3, 1);
  // Rough estimate: 3 lines per message
  const maxMessages = Math.max(Math.floor(maxLines / 2), 5);
  const visible = messages.slice(-maxMessages);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={borderColor}
    >
      {/* ── Header ── */}
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text bold color={focused ? 'green' : 'white'}>
            {chatTitle || 'Select a chat'}
          </Text>
          {chatType && (
            <Text color="gray" dimColor>
              {' '}
              {chatType}
            </Text>
          )}
        </Box>
        {loading && <Text color="yellow">⏳</Text>}
      </Box>

      {/* ── Separator ─ */}
      <Box paddingX={1}>
        <Text color="gray" dimColor>
          {'─'.repeat(Math.max(width - 4, 10))}
        </Text>
      </Box>

      {/* ── Messages ─ */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visible.map((msg, idx) => {
          const prev = idx > 0 ? visible[idx - 1] : null;
          const grouped = prev !== null && isGrouped(prev, msg);
          const time = formatTimestamp(msg.date, now);
          const bodyLines = wrapText(msg.text, Math.max(bodyWidth, 10));

          // Sender color
          const senderColor = msg.isOutgoing ? 'blueBright' : 'magentaBright';
          const textColor = msg.isOutgoing ? 'white' : 'white';
          const arrow = msg.isOutgoing ? '→' : '←';

          return (
            <Box key={msg.id} flexDirection="column">
              {/* Sender line (only if not grouped) */}
              {!grouped && (
                <Box>
                  <Text bold color={senderColor}>
                    {arrow} {msg.senderName}
                  </Text>
                  <Text color="gray" dimColor>
                    {'  '}{time}
                  </Text>
                </Box>
              )}

              {/* Body */}
              {bodyLines.map((line, li) => (
                <Box key={li}>
                  {!grouped && li === 0 ? (
                    <Text>  </Text>
                  ) : grouped && li === 0 ? (
                    <Text color="gray" dimColor>
                      {'  '}{time}{' '}
                    </Text>
                  ) : (
                    <Text>  </Text>
                  )}
                  <Text color={textColor}>{line}</Text>
                </Box>
              ))}

              {/* Spacing between message groups */}
              {!grouped && idx < visible.length - 1 && !isGrouped(msg, visible[idx + 1]!) && (
                <Text> </Text>
              )}
            </Box>
          );
        })}

        {!loading && messages.length === 0 && (
          <Box paddingY={1}>
            <Text color="gray" dimColor>
              No messages yet — say hello 👋
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
