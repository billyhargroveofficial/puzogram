/**
 * App — top-level component: auth screen ↔ main chat layout.
 *
 * Features: folder tabs, keyboard navigation, mouse support (click + wheel),
 * scrollable message history, rich status bar. Mouse hit-testing uses the
 * layout metrics reported by `<ChatList>` (measured in alternate-screen
 * coordinates, which equal viewport coordinates).
 */
import React, { useRef } from 'react';
import { Box, Text, useInput, useApp, useWindowSize } from 'ink';
import { useAppStore } from '../store/app.js';
import { AuthScreen } from './AuthScreen.js';
import { ChatList, CHAT_ITEM_HEIGHT, type ChatListLayout } from './ChatList.js';
import { MessageList } from './MessageList.js';
import { MessageInput } from './MessageInput.js';
import { useMouse } from './useMouse.js';
import { filterChatsByFolder, sortChats } from '../display/format.js';
import type { TerminalMouseEvent as MouseEvent } from '../ui/mouse.js';

interface AppProps {
  onSendCode: (phone: string) => Promise<void>;
  onSignIn: (code: string) => Promise<void>;
  onPassword: (password: string) => Promise<void>;
  onSelectChat: (index: number) => void;
  onSendMessage: (text: string) => void;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(Math.max(n, lo), hi);

export function App({
  onSendCode,
  onSignIn,
  onPassword,
  onSelectChat,
  onSendMessage,
}: AppProps) {
  const authPhase = useAppStore((s) => s.authPhase);
  const chats = useAppStore((s) => s.chats);
  const folders = useAppStore((s) => s.folders);
  const selectedFolderIndex = useAppStore((s) => s.selectedFolderIndex);
  const selectedChatIndex = useAppStore((s) => s.selectedChatIndex);
  const messages = useAppStore((s) => s.messages);
  const messagesLoading = useAppStore((s) => s.messagesLoading);
  const messagesScrollOffset = useAppStore((s) => s.messagesScrollOffset);
  const inputText = useAppStore((s) => s.inputText);
  const focusedPane = useAppStore((s) => s.focusedPane);
  const statusMessage = useAppStore((s) => s.statusMessage);

  const setFocusedPane = useAppStore((s) => s.setFocusedPane);
  const setSelectedChatIndex = useAppStore((s) => s.setSelectedChatIndex);
  const setSelectedFolderIndex = useAppStore((s) => s.setSelectedFolderIndex);
  const setMessagesScrollOffset = useAppStore((s) => s.setMessagesScrollOffset);
  const setInputText = useAppStore((s) => s.setInputText);

  const { exit } = useApp();
  const { columns, rows } = useWindowSize();

  // Layout geometry
  const sidebarWidth = clamp(Math.floor(columns * 0.3), 25, 45);
  const mainHeight = Math.max(rows - 5, 8); // top(1)+input(3)+status(1)
  const inputY = rows - 4; // input box top row
  const msgWindow = Math.max(Math.floor((mainHeight - 4) / 2), 5);

  // Derived chat list for the active folder
  const currentFolder = folders[selectedFolderIndex] ?? folders[0];
  const filteredChats = currentFolder ? filterChatsByFolder(chats, currentFolder) : chats;
  const sortedFiltered = sortChats(filteredChats);

  const selectedChat = sortedFiltered[selectedChatIndex];
  const chatTitle = selectedChat?.title ?? '';
  const chatType = selectedChat
    ? selectedChat.isChannel
      ? 'channel'
      : selectedChat.isGroup
        ? 'group'
        : selectedChat.isBot
          ? 'bot'
          : 'private'
    : undefined;

  // Mouse hit-test metrics, reported by <ChatList> after each render.
  const layout = useRef<ChatListLayout>({
    listY: 0,
    tabsY: null,
    start: 0,
    visibleCount: 0,
    tabRects: [],
  });

  // Select a chat and reset history scroll in one go.
  const selectChat = (idx: number): void => {
    setSelectedChatIndex(idx);
    setMessagesScrollOffset(0);
    onSelectChat(idx);
  };

  const switchFolder = (idx: number): void => {
    setSelectedFolderIndex(idx);
    setSelectedChatIndex(0);
    setMessagesScrollOffset(0);
    onSelectChat(0);
  };

  // ---- Mouse handling -----------------------------------------------------
  const onMouse = (e: MouseEvent): void => {
    const m = layout.current;
    const inSidebar = e.col < sidebarWidth;

    if (e.button === 'wheel-up' || e.button === 'wheel-down') {
      const dir = e.button === 'wheel-up' ? -1 : 1;
      if (inSidebar) {
        if (m.tabsY !== null && e.row === m.tabsY) {
          if (folders.length < 2) return;
          switchFolder((selectedFolderIndex + dir + folders.length) % folders.length);
        } else if (e.row >= m.listY) {
          const next = clamp(selectedChatIndex + dir, 0, sortedFiltered.length - 1);
          if (next !== selectedChatIndex) selectChat(next);
        }
      } else if (e.row < inputY) {
        const maxOff = Math.max(0, messages.length - msgWindow);
        // wheel up → older → larger offset
        setMessagesScrollOffset(clamp(messagesScrollOffset - dir, 0, maxOff));
      }
      return;
    }

    if (e.type === 'press' && e.button === 'left') {
      if (inSidebar) {
        if (m.tabsY !== null && e.row === m.tabsY) {
          const idx = m.tabRects.findIndex((r) => e.col >= r.x && e.col < r.x + r.width);
          if (idx >= 0 && idx !== selectedFolderIndex) switchFolder(idx);
        } else if (e.row >= m.listY) {
          const i = Math.floor((e.row - m.listY) / CHAT_ITEM_HEIGHT);
          const global = m.start + i;
          if (global >= 0 && global < sortedFiltered.length) {
            selectChat(global);
            setFocusedPane('messages');
          }
        }
      } else if (e.row >= inputY) {
        setFocusedPane('input');
      } else {
        setFocusedPane('messages');
      }
    }
  };

  useMouse(onMouse);

  // ---- Keyboard navigation ------------------------------------------------
  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') {
        exit();
        return;
      }
      if (key.tab) {
        const panes: Array<'chatList' | 'messages' | 'input'> = ['chatList', 'messages', 'input'];
        const idx = panes.indexOf(focusedPane);
        const next = key.shift
          ? panes[(idx - 1 + panes.length) % panes.length]
          : panes[(idx + 1) % panes.length];
        setFocusedPane(next);
        return;
      }
      if (focusedPane === 'chatList') {
        if (key.upArrow) {
          selectChat(Math.max(0, selectedChatIndex - 1));
        } else if (key.downArrow) {
          selectChat(Math.min(sortedFiltered.length - 1, selectedChatIndex + 1));
        } else if (key.return) {
          setFocusedPane('input');
        } else if (key.leftArrow && folders.length > 1) {
          switchFolder((selectedFolderIndex - 1 + folders.length) % folders.length);
        } else if (key.rightArrow && folders.length > 1) {
          switchFolder((selectedFolderIndex + 1) % folders.length);
        }
      } else if (focusedPane === 'messages') {
        const maxOff = Math.max(0, messages.length - msgWindow);
        if (key.upArrow) setMessagesScrollOffset(clamp(messagesScrollOffset + 1, 0, maxOff));
        else if (key.downArrow) setMessagesScrollOffset(clamp(messagesScrollOffset - 1, 0, maxOff));
      }
      if (key.escape && focusedPane !== 'chatList') {
        setFocusedPane('chatList');
      }
    },
    { isActive: authPhase === 'ready' },
  );

  // ---- Auth phase ---------------------------------------------------------
  if (authPhase !== 'ready') {
    return (
      <AuthScreen onSendCode={onSendCode} onSignIn={onSignIn} onPassword={onPassword} />
    );
  }

  // ---- Main layout --------------------------------------------------------
  return (
    <Box flexDirection="column" height="100%">
      {/* Top bar */}
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text bold color="cyan">
            ✈ billytelega
          </Text>
          <Text color="gray" dimColor>
            {' '}
            v0.2
          </Text>
        </Box>
        <Text color="gray" dimColor>
          Tab:pane ←→:folder ↑↓:chat wheel:scroll click:select ^C:quit
        </Text>
      </Box>

      {/* Sidebar + messages */}
      <Box flexDirection="row" flexGrow={1}>
        <ChatList
          chats={chats}
          folders={folders}
          selectedFolderIndex={selectedFolderIndex}
          selectedIndex={selectedChatIndex}
          width={sidebarWidth}
          height={mainHeight}
          focused={focusedPane === 'chatList'}
          onLayout={(info) => {
            layout.current = info;
          }}
        />
        <Box flexDirection="column" flexGrow={1}>
          <MessageList
            messages={messages}
            chatTitle={chatTitle}
            chatType={chatType}
            width={columns - sidebarWidth - 2}
            height={mainHeight}
            loading={messagesLoading}
            focused={focusedPane === 'messages'}
            windowSize={msgWindow}
            scrollOffset={messagesScrollOffset}
          />
        </Box>
      </Box>

      {/* Input */}
      <MessageInput
        value={inputText}
        onChange={setInputText}
        onSubmit={(text) => {
          onSendMessage(text);
          setInputText('');
        }}
        focused={focusedPane === 'input'}
      />

      {/* Status bar */}
      <Box paddingX={1} justifyContent="space-between">
        <Text color="gray" dimColor>
          {statusMessage ?? `${chats.length} chats · ${folders.length} folders`}
        </Text>
        <Box>
          <Text
            color={focusedPane === 'chatList' ? 'cyan' : 'gray'}
            dimColor={focusedPane !== 'chatList'}
          >
            [chats]
          </Text>
          <Text
            color={focusedPane === 'messages' ? 'green' : 'gray'}
            dimColor={focusedPane !== 'messages'}
          >
            {' '}
            [msgs]{' '}
          </Text>
          <Text
            color={focusedPane === 'input' ? 'yellow' : 'gray'}
            dimColor={focusedPane !== 'input'}
          >
            [input]
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
