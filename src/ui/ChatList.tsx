/**
 * ChatList — sidebar with a clean tab bar and two-line chat rows.
 *
 * Design (per research of real TUI messengers — tele, tg, nchat, Telegram
 * Desktop): one chat = two aligned lines. Line 1 holds the avatar chip, bold
 * title and a right-aligned timestamp; line 2 holds an indented dim preview
 * and a right-aligned compact unread counter. The selected chat gets a subtle
 * full-width panel background + accent title instead of a garish inversion.
 * Mouse press/wheel uses @ink-tools/ink-mouse (per-element bounding rects).
 */
import React, { useRef } from 'react';
import { Box, Text, type DOMElement } from 'ink';
import { useOnPress, useOnWheel } from '@ink-tools/ink-mouse';
import { theme, avatarBg } from '../display/theme.js';
import {
  formatChatTimestamp,
  sortChats,
  filterChatsByFolder,
  folderUnreadCount,
  avatarGlyph,
  truncateToWidth,
  displayWidth,
  capCount,
  toText,
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
  onSelectChat: (chatId: number) => void;
  onSwitchFolder: (index: number) => void;
  onScrollChats: (delta: number) => void;
  /** Fired when the pane itself is pressed (click-to-focus). */
  onFocusPane?: () => void;
}

// ---------------------------------------------------------------------------
// Folder tab
// ---------------------------------------------------------------------------

interface FolderTabProps {
  folder: DisplayFolder;
  index: number;
  isActive: boolean;
  /** Pre-capped unread count string ('' when zero). */
  count: string;
  /** Max display width allowed for the title so the whole tab bar fits. */
  maxTitleWidth: number;
  onSwitch: (index: number) => void;
}

function FolderTab({ folder, index, isActive, count, maxTitleWidth, onSwitch }: FolderTabProps) {
  const ref = useRef<DOMElement>(null);
  useOnPress(ref, () => onSwitch(index));

  const bg = isActive ? theme.bgPanel : undefined;
  return (
    <Box ref={ref}>
      <Text bold={isActive} color={isActive ? theme.accent : theme.textDim} backgroundColor={bg}>
        {` ${truncateToWidth(folder.title, maxTitleWidth)}`}
      </Text>
      {count ? (
        <Text bold color={isActive ? theme.accent2 : theme.textFaint} backgroundColor={bg}>
          {` ${count}`}
        </Text>
      ) : null}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Chat row (two lines)
// ---------------------------------------------------------------------------

interface ChatRowProps {
  chat: DisplayChat;
  isSelected: boolean;
  focused: boolean;
  width: number;
  now: Date;
  onSelect: (chatId: number) => void;
}

function ChatRow({ chat, isSelected, focused, width, now, onSelect }: ChatRowProps) {
  const ref = useRef<DOMElement>(null);
  useOnPress(ref, () => onSelect(chat.id));

  const hasUnread = chat.unreadCount > 0;
  const glyph = avatarGlyph(chat);
  const time = formatChatTimestamp(chat.lastMessageDate, now);
  const badge = capCount(chat.unreadCount);
  const preview = toText(chat.lastMessageText).replace(/\n/g, ' ');

  // Avatar column is 3 cells wide (2-wide glyph + 1 space). The preview line
  // uses the same 3-cell indent so it starts exactly under the title.
  const innerWidth = width - 2; // inside the rounded border
  const titleWidth = Math.max(innerWidth - 2 /*pad*/ - 3 /*avatar*/ - displayWidth(time) - 1, 4);
  const previewWidth = Math.max(innerWidth - 2 /*pad*/ - 3 /*indent*/ - displayWidth(badge) - 1, 4);

  const rowBg = isSelected ? theme.bgPanel : undefined;
  const titleColor = isSelected ? theme.accent : hasUnread ? theme.text : theme.textDim;

  return (
    <Box ref={ref} flexDirection="column" width={innerWidth} paddingX={1} backgroundColor={rowBg}>
      {/* Line 1: avatar glyph + title + time */}
      <Box height={1}>
        <Text backgroundColor={avatarBg(chat.id)}>{glyph}</Text>
        <Text> </Text>
        <Text bold={hasUnread || isSelected} color={titleColor}>
          {truncateToWidth(chat.title, titleWidth)}
        </Text>
        <Box flexGrow={1} />
        <Text color={theme.textFaint}>{time}</Text>
      </Box>

      {/* Line 2: preview + unread counter (indent matches the avatar column) */}
      <Box height={1}>
        <Box width={3} flexShrink={0} />
        <Text color={isSelected ? theme.textDim : theme.textFaint}>
          {truncateToWidth(preview, previewWidth)}
        </Text>
        <Box flexGrow={1} />
        {badge ? (
          <Text bold color={theme.accent2}>
            {badge}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ChatList
// ---------------------------------------------------------------------------

export function ChatList({
  chats,
  folders,
  selectedFolderIndex,
  selectedIndex,
  width,
  height,
  focused,
  onSelectChat,
  onSwitchFolder,
  onScrollChats,
  onFocusPane,
}: ChatListProps) {
  const now = new Date();
  const currentFolder = folders[selectedFolderIndex] ?? folders[0];
  const filtered = currentFolder ? filterChatsByFolder(chats, currentFolder) : chats;
  const sorted = sortChats(filtered);

  // Viewport: tabs row(1) + divider(1) + border(2) = 4 chrome rows; each chat
  // takes 2 lines. The window follows the selection.
  const hasTabs = folders.length > 0;
  const chrome = 2 + (hasTabs ? 2 : 0);
  const visibleCount = Math.max(Math.floor((height - chrome) / 2), 1);
  let start = 0;
  if (selectedIndex >= visibleCount) {
    start = selectedIndex - visibleCount + 1;
  }
  const visible = sorted.slice(start, start + visibleCount);

  const borderColor = focused ? theme.borderFocus : theme.border;
  const innerWidth = width - 2;

  const rootRef = useRef<DOMElement>(null);
  const tabsRef = useRef<DOMElement>(null);
  const listRef = useRef<DOMElement>(null);

  // Clicking anywhere in the sidebar focuses the chat-list pane. Nested
  // handlers (chat rows, folder tabs) still fire for their own actions.
  useOnPress(rootRef, () => onFocusPane?.());

  // Wheel over the tab strip switches folders.
  useOnWheel(tabsRef, (e) => {
    if (folders.length < 2) return;
    const dir = e.button === 'wheel-up' ? -1 : e.button === 'wheel-down' ? 1 : 0;
    if (dir !== 0) onSwitchFolder((selectedFolderIndex + dir + folders.length) % folders.length);
  });

  // Wheel over the chat list scrolls the selection.
  useOnWheel(listRef, (e) => {
    const dir = e.button === 'wheel-up' ? -1 : e.button === 'wheel-down' ? 1 : 0;
    if (dir !== 0) onScrollChats(dir);
  });

  return (
    <Box
      ref={rootRef}
      flexDirection="column"
      width={width}
      height={height}
      overflow="hidden"
      borderStyle="round"
      borderColor={borderColor}
    >
      {/* ── Folder tabs (widths computed so the bar always fits) + divider ── */}
      {hasTabs && (() => {
        const counts = folders.map((f) => capCount(folderUnreadCount(chats, f)));
        const naturalW = folders.map((f) => displayWidth(f.title));
        const countsW = counts.reduce((s, c) => s + (c ? displayWidth(c) + 1 : 0), 0);
        const sepsW = folders.length; // 1 leading space per tab title
        // Largest title cap that still lets the whole bar fit: short titles keep
        // their full width, only the longest titles get truncated, and only when
        // the bar would otherwise overflow.
        let cap = Math.max(...naturalW, 1);
        const totalAt = (c: number): number =>
          naturalW.reduce((s, w) => s + Math.min(w, c), 0) + sepsW + countsW;
        while (cap > 1 && totalAt(cap) > innerWidth) cap--;
        const perTab = cap;
        return (
          <>
            <Box ref={tabsRef} flexWrap="nowrap" overflow="hidden">
              {folders.map((folder, i) => (
                <FolderTab
                  key={folder.id}
                  folder={folder}
                  index={i}
                  isActive={i === selectedFolderIndex}
                  count={counts[i]!}
                  maxTitleWidth={perTab}
                  onSwitch={onSwitchFolder}
                />
              ))}
            </Box>
            <Box paddingX={1}>
              <Text color={theme.border}>{'─'.repeat(Math.max(innerWidth - 2, 4))}</Text>
            </Box>
          </>
        );
      })()}

      {/* ── Chat rows ── */}
      <Box ref={listRef} flexDirection="column">
        {visible.map((chat, i) => (
          <ChatRow
            key={chat.id}
            chat={chat}
            isSelected={start + i === selectedIndex}
            focused={focused}
            width={width}
            now={now}
            onSelect={onSelectChat}
          />
        ))}
      </Box>

      {sorted.length === 0 && (
        <Box paddingX={1} paddingY={1}>
          <Text color={theme.textGhost} dimColor>
            No chats in this folder
          </Text>
        </Box>
      )}
    </Box>
  );
}
