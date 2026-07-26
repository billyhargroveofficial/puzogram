/**
 * MessageList — displays messages for the selected chat.
 */
import React from 'react';
import { Box, Text } from 'ink';
import { formatMessage, type DisplayMessage } from '../display/format.js';

interface MessageListProps {
  messages: DisplayMessage[];
  chatTitle: string;
  width: number;
  height: number;
  loading: boolean;
  focused: boolean;
}

export function MessageList({
  messages,
  chatTitle,
  width,
  height,
  loading,
  focused,
}: MessageListProps) {
  const now = new Date();
  const borderColor = focused ? 'green' : 'gray';
  const bodyWidth = width - 4;

  // Show the last N messages that fit in the viewport
  const maxMessages = Math.max(height - 3, 1);
  const visible = messages.slice(-maxMessages);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={borderColor}
    >
      {/* Header */}
      <Box paddingX={1}>
        <Text bold color={focused ? 'green' : 'gray'}>
          {chatTitle || 'No chat selected'}
        </Text>
        {loading && <Text color="yellow"> ⏳</Text>}
      </Box>

      {/* Messages */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visible.map((msg) => {
          const { senderLine, bodyLines } = formatMessage(msg, bodyWidth, now);
          return (
            <Box key={msg.id} flexDirection="column" marginBottom={0}>
              <Text
                bold
                color={msg.isOutgoing ? 'blue' : 'magenta'}
              >
                {senderLine}
              </Text>
              {bodyLines.map((line, i) => (
                <Text key={i} color={msg.isOutgoing ? 'blueBright' : 'white'}>
                  {line}
                </Text>
              ))}
            </Box>
          );
        })}

        {!loading && messages.length === 0 && (
          <Text color="gray" dimColor>
            No messages yet. Say hello! 👋
          </Text>
        )}
      </Box>
    </Box>
  );
}
