/**
 * ChatList — sidebar showing the dialog list.
 */
import React from 'react';
import { Box, Text } from 'ink';
import {
  formatChatTitle,
  formatChatPreview,
  formatChatTimestamp,
  sortChats,
  type DisplayChat,
} from '../display/format.js';

interface ChatListProps {
  chats: DisplayChat[];
  selectedIndex: number;
  width: number;
  height: number;
  focused: boolean;
}

export function ChatList({ chats, selectedIndex, width, height, focused }: ChatListProps) {
  const sorted = sortChats(chats);
  const now = new Date();

  // Simple viewport: show `height - 2` items around the selection
  const visibleCount = Math.max(height - 2, 1);
  let start = 0;
  if (selectedIndex >= visibleCount) {
    start = selectedIndex - visibleCount + 1;
  }
  const visible = sorted.slice(start, start + visibleCount);

  const borderColor = focused ? 'cyan' : 'gray';

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={borderColor}
    >
      <Box paddingX={1}>
        <Text bold color={focused ? 'cyan' : 'gray'}>
          Chats
        </Text>
        <Text color="gray"> ({sorted.length})</Text>
      </Box>

      {visible.map((chat, i) => {
        const globalIndex = start + i;
        const isSelected = globalIndex === selectedIndex;
        const titleWidth = width - 4;
        const previewWidth = width - 4;

        return (
          <Box key={chat.id} flexDirection="column" paddingX={1}>
            <Box>
              {isSelected ? (
                <Text color="cyan" bold inverse>
                  {formatChatTitle(chat, titleWidth)}
                </Text>
              ) : (
                <Text color={chat.unreadCount > 0 ? 'white' : 'gray'} bold={chat.unreadCount > 0}>
                  {formatChatTitle(chat, titleWidth)}
                </Text>
              )}
            </Box>
            <Box>
              <Text color="gray" dimColor>
                {formatChatPreview(chat, previewWidth - 6)}
              </Text>
              <Text color="gray" dimColor>
                {' '}
                {formatChatTimestamp(chat.lastMessageDate, now)}
              </Text>
            </Box>
          </Box>
        );
      })}

      {sorted.length === 0 && (
        <Box paddingX={1}>
          <Text color="gray" dimColor>
            No chats yet…
          </Text>
        </Box>
      )}
    </Box>
  );
}
