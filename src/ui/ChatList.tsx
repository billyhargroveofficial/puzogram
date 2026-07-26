/**
 * ChatList — sidebar with folder tabs, initials avatars, and mouse metrics.
 *
 * After each render it measures the on-screen positions of the folder tabs
 * and the chat-list container (via Ink's `measureElement`) and reports them
 * through `onLayout`, so the parent can hit-test mouse clicks/scrolls.
 */
import React, { useEffect, useRef } from 'react';
import { Box, Text, measureElement } from 'ink';
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

/** Each chat entry renders as exactly this many terminal rows. */
export const CHAT_ITEM_HEIGHT = 2;

export interface ChatListLayout {
  /** 0-based row of the first chat entry. */
  listY: number;
  /** 0-based row of the folder-tabs line, or null when there are no folders. */
  tabsY: number | null;
  /** Index into the sorted/filtered list of the first visible chat. */
  start: number;
  /** How many chat entries are visible in the viewport. */
  visibleCount: number;
  /** Horizontal span of each folder tab, in 0-based columns. */
  tabRects: Array<{ x: number; width: number }>;
}

interface ChatListProps {
  chats: DisplayChat[];
  folders: DisplayFolder[];
  selectedFolderIndex: number;
  selectedIndex: number;
  width: number;
  height: number;
  focused: boolean;
  onLayout?: (layout: ChatListLayout) => void;
}

const noop = (): void => {};

export function ChatList({
  chats,
  folders,
  selectedFolderIndex,
  selectedIndex,
  width,
  height,
  focused,
  onLayout = noop,
}: ChatListProps) {
  const now = new Date();
  const currentFolder = folders[selectedFolderIndex] ?? folders[0];
  const filtered = currentFolder ? filterChatsByFolder(chats, currentFolder) : chats;
  const sorted = sortChats(filtered);

  // Viewport windowing
  const hasTabs = folders.length > 0;
  // outer round border = 2 rows; tabs = 1; header = 1
  const chrome = 2 + (hasTabs ? 1 : 0) + 1;
  const visibleCount = Math.max(height - chrome, 1);
  let start = 0;
  if (selectedIndex >= visibleCount) {
    start = selectedIndex - visibleCount + 1;
  }
  const visible = sorted.slice(start, start + visibleCount);

  const borderColor = focused ? 'cyan' : 'gray';
  const innerWidth = width - 2;

  // Refs for mouse hit-testing
  const tabsRef = useRef<any>(null);
  const listRef = useRef<any>(null);
  const tabRefs = useRef<any[]>([]);
  const onLayoutRef = useRef(onLayout);
  onLayoutRef.current = onLayout;

  useEffect(() => {
    const measure = (el: any): { x: number; y: number; width: number } => {
      if (!el) return { x: 0, y: 0, width: 0 };
      try {
        const m = measureElement(el);
        return { x: m.x, y: m.y, width: m.width };
      } catch {
        return { x: 0, y: 0, width: 0 };
      }
    };

    const tabsM = hasTabs ? measure(tabsRef.current) : null;
    const listM = measure(listRef.current);
    const tabRects = folders.map((_, i) => {
      const r = measure(tabRefs.current[i]);
      return { x: r.x, width: r.width };
    });

    onLayoutRef.current({
      listY: listM.y,
      tabsY: tabsM ? tabsM.y : null,
      start,
      visibleCount,
      tabRects,
    });
  }, [sorted.length, selectedIndex, selectedFolderIndex, hasTabs, folders.length, width, height]);

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={borderColor}
    >
      {/* ── Folder tabs ── */}
      {hasTabs && (
        <Box ref={tabsRef} paddingX={1}>
          {folders.map((folder, i) => {
            const isActive = i === selectedFolderIndex;
            const unread = folderUnreadCount(chats, folder);
            const label = folder.emoji ? `${folder.emoji} ${folder.title}` : folder.title;
            const badge = unread > 0 ? ` ${unread}` : '';
            const setTabRef = (el: any): void => {
              tabRefs.current[i] = el;
            };
            return (
              <Box key={folder.id} ref={setTabRef}>
                {isActive ? (
                  <Text bold color="black" backgroundColor="cyan">
                    {' '}
                    {truncateText(label, 8)}
                    {badge}{' '}
                  </Text>
                ) : (
                  <Text color="gray">
                    {' '}
                    {truncateText(label, 8)}
                    {badge}{' '}
                  </Text>
                )}
              </Box>
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
      <Box ref={listRef} flexDirection="column">
        {visible.map((chat, i) => {
          const globalIndex = start + i;
          const isSelected = globalIndex === selectedIndex;
          const hasUnread = chat.unreadCount > 0;
          const initials = getInitials(chat.title);
          const aColor = avatarColor(chat.id);
          const time = formatChatTimestamp(chat.lastMessageDate, now);
          const typeIcon = chat.isChannel ? '📢' : chat.isGroup ? '👥' : chat.isBot ? '🤖' : '';
          const titleMaxLen = innerWidth - 6;
          const previewMaxLen = innerWidth - 3;

          return (
            <Box key={chat.id} flexDirection="column" paddingX={1}>
              {/* Row 1: avatar + title + time/unread */}
              <Box>
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
                {isSelected ? (
                  <Text bold color="black" backgroundColor="cyan">
                    {typeIcon ? typeIcon + ' ' : ''}
                    {truncateText(chat.title, titleMaxLen - (typeIcon ? 2 : 0))}
                  </Text>
                ) : (
                  <Text bold={hasUnread} color={hasUnread ? 'white' : 'gray'}>
                    {typeIcon ? typeIcon + ' ' : ''}
                    {truncateText(chat.title, titleMaxLen - (typeIcon ? 2 : 0))}
                  </Text>
                )}
                <Box flexGrow={1} />
                {hasUnread ? (
                  <Text bold color="black" backgroundColor="green">
                    {' '}
                    {chat.unreadCount}{' '}
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
      </Box>

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
