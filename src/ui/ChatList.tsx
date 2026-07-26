/**
 * ChatList — sidebar with folder tabs and styled chat entries.
 */
import React from 'react';
import { Box, Text } from 'ink';
import {
  formatChatPreview,
  formatChatTimestamp,
  sortChats,
  filterChatsByFolder,
  folderUnreadCount,
  getInitials,
  avatarColor,
  truncateText,
  type DisplayChat,
  type DisplayFolder,
} from '../display/format.js';

interface ChatListProps {
  chats: DisplayChat[];
  folders: DisplayFolder[];
  selectedFolderIndex: number;
  selectedIndex: number;
  width: number;
  height: number;
  focused: boolean;
}

export function ChatList({
  chats,
  folders,
  selectedFolderIndex,
  selectedIndex,
  width,
  height,
  focused,
}: ChatListProps) {
  const now = new Date();
  const currentFolder = folders[selectedFolderIndex] ?? folders[0];
  const filtered = currentFolder ? filterChatsByFolder(chats, currentFolder) : chats;
  const sorted = sortChats(filtered);

  // Viewport
  const headerLines = folders.length > 0 ? 3 : 2; // tabs + header + separator
  const visibleCount = Math.max(height - headerLines, 1);
  let start = 0;
  if (selectedIndex >= visibleCount) {
    start = selectedIndex - visibleCount + 1;
  }
  const visible = sorted.slice(start, start + visibleCount);

  const borderColor = focused ? 'cyan' : 'gray';
  const innerWidth = width - 2; // padding

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={borderColor}
    >
      {/* ── Folder tabs ── */}
      {folders.length > 0 && (
        <Box paddingX={1}>
          {folders.map((folder, i) => {
            const isActive = i === selectedFolderIndex;
            const unread = folderUnreadCount(chats, folder);
            const label = folder.emoji
              ? `${folder.emoji} ${folder.title}`
              : folder.title;
            const badge = unread > 0 ? ` ${unread}` : '';

            if (isActive) {
              return (
                <Text key={folder.id} bold color="black" backgroundColor="cyan">
                  {' '}{truncateText(label, 8)}{badge}{' '}
                </Text>
              );
            }
            return (
              <Text key={folder.id} color="gray">
                {' '}{truncateText(label, 8)}{badge}{' '}
              </Text>
            );
          })}
        </Box>
      )}

      {/* ── Header ── */}
      <Box paddingX={1}>
        <Text bold color={focused ? 'cyan' : 'gray'}>
          Chats
        </Text>
        <Text color="gray"> ({sorted.length})</Text>
      </Box>

      {/* ── Chat entries ── */}
      {visible.map((chat, i) => {
        const globalIndex = start + i;
        const isSelected = globalIndex === selectedIndex;
        const hasUnread = chat.unreadCount > 0;
        const initials = getInitials(chat.title);
        const aColor = avatarColor(chat.id);
        const time = formatChatTimestamp(chat.lastMessageDate, now);
        const typeIcon = chat.isChannel ? '📢' : chat.isGroup ? '👥' : chat.isBot ? '🤖' : '';
        const titleMaxLen = innerWidth - 6; // avatar(3) + space + time(5) + space
        const previewMaxLen = innerWidth - 3;

        return (
          <Box key={chat.id} flexDirection="column" paddingX={1}>
            {/* Row 1: avatar + title + time */}
            <Box>
              {/* Avatar */}
              {isSelected ? (
                <Text bold color="black" backgroundColor="cyan">
                  {initials}
                </Text>
              ) : (
                <Text bold color={aColor}>
                  {initials}
                </Text>
              )}
              <Text> </Text>

              {/* Title */}
              {isSelected ? (
                <Text bold color="black" backgroundColor="cyan">
                  {typeIcon ? typeIcon + ' ' : ''}{truncateText(chat.title, titleMaxLen - (typeIcon ? 2 : 0))}
                </Text>
              ) : (
                <Text bold={hasUnread} color={hasUnread ? 'white' : 'gray'}>
                  {typeIcon ? typeIcon + ' ' : ''}{truncateText(chat.title, titleMaxLen - (typeIcon ? 2 : 0))}
                </Text>
              )}

              {/* Spacer + time + unread badge */}
              <Box flexGrow={1} />
              {hasUnread ? (
                <Text bold color="black" backgroundColor="green">
                  {' '}{chat.unreadCount}{' '}
                </Text>
              ) : (
                <Text color="gray" dimColor>
                  {time}
                </Text>
              )}
            </Box>

            {/* Row 2: preview */}
            <Box>
              <Text>   </Text>
              <Text color="gray" dimColor>
                {formatChatPreview(chat, previewMaxLen)}
              </Text>
            </Box>
          </Box>
        );
      })}

      {sorted.length === 0 && (
        <Box paddingX={1} paddingY={1}>
          <Text color="gray" dimColor>
            No chats in this folder
          </Text>
        </Box>
      )}
    </Box>
  );
}
