/**
 * MessageList — displays messages with sender grouping, rich styling,
 * and a scrollable history window (driven by `scrollOffset`).
 */
import React from 'react';
import { Box, Text } from 'ink';
import {
  formatTimestamp,
  wrapText,
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
  /** How many message slots fit in the viewport. */
  windowSize?: number;
  /** 0 = show newest; >0 = scroll back into history by N slots. */
  scrollOffset?: number;
}

/** Two messages group (collapse the sender header) when same sender, same
 *  direction, and within 5 minutes of each other. */
function isGrouped(prev: DisplayMessage, curr: DisplayMessage): boolean {
  if (prev.senderName !== curr.senderName) return false;
  if (prev.isOutgoing !== curr.isOutgoing) return false;
  return Math.abs(curr.date.getTime() - prev.date.getTime()) < 5 * 60 * 1000;
}

export function MessageList({
  messages,
  chatTitle,
  chatType,
  width,
  height,
  loading,
  focused,
  windowSize = 20,
  scrollOffset = 0,
}: MessageListProps) {
  const now = new Date();
  const borderColor = focused ? 'green' : 'gray';
  const bodyWidth = width - 6;

  const total = messages.length;
  const end = scrollOffset > 0 ? Math.max(0, total - scrollOffset) : total;
  const startIdx = Math.max(0, end - windowSize);
  const visible = messages.slice(startIdx, end);
  const hasOlder = startIdx > 0;
  const hasNewer = end < total;

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={borderColor}
    >
      {/* ── Header ─ */}
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
        <Box>
          {scrollOffset > 0 && (
            <Text color="yellow" dimColor>
              ↑ history{' '}
            </Text>
          )}
          {loading && <Text color="yellow">⏳</Text>}
        </Box>
      </Box>

      {/* ── Separator ── */}
      <Box paddingX={1}>
        <Text color="gray" dimColor>
          {'─'.repeat(Math.max(width - 4, 10))}
        </Text>
      </Box>

      {/* ── Older-messages marker ── */}
      {hasOlder && (
        <Box paddingX={1}>
          <Text color="gray" dimColor>
            ↑ {startIdx} older message{startIdx === 1 ? '' : 's'} (scroll wheel)
          </Text>
        </Box>
      )}

      {/* ── Messages ── */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visible.map((msg, idx) => {
          const prev = idx > 0 ? visible[idx - 1] : null;
          const grouped = prev !== null && isGrouped(prev, msg);
          const time = formatTimestamp(msg.date, now);
          const bodyLines = wrapText(msg.text, Math.max(bodyWidth, 10));

          const senderColor = msg.isOutgoing ? 'blueBright' : 'magentaBright';
          const arrow = msg.isOutgoing ? '→' : '←';

          return (
            <Box key={msg.id} flexDirection="column">
              {!grouped && (
                <Box>
                  <Text bold color={senderColor}>
                    {arrow} {msg.senderName}
                  </Text>
                  <Text color="gray" dimColor>
                    {'  '}
                    {time}
                  </Text>
                </Box>
              )}

              {bodyLines.map((line, li) => (
                <Box key={li}>
                  {grouped && li === 0 ? (
                    <Text color="gray" dimColor>
                      {'  '}
                      {time}{' '}
                    </Text>
                  ) : (
                    <Text>  </Text>
                  )}
                  <Text color="white">{line}</Text>
                </Box>
              ))}

              {!grouped &&
                idx < visible.length - 1 &&
                visible[idx + 1] !== undefined &&
                !isGrouped(msg, visible[idx + 1]!) && <Text> </Text>}
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

      {/* ── Newer-messages marker ── */}
      {hasNewer && (
        <Box paddingX={1}>
          <Text color="gray" dimColor>
            ↓ {total - end} newer message{total - end === 1 ? '' : 's'} (scroll wheel)
          </Text>
        </Box>
      )}
    </Box>
  );
}
