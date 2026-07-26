/**
 * App — top-level component: auth screen ↔ main chat layout.
 * Features folder tabs, keyboard navigation, rich status bar.
 */
import React from 'react';
import { Box, Text, useInput, useApp, useWindowSize } from 'ink';
import { useAppStore } from '../store/app.js';
import { AuthScreen } from './AuthScreen.js';
import { ChatList } from './ChatList.js';
import { MessageList } from './MessageList.js';
import { MessageInput } from './MessageInput.js';
import { filterChatsByFolder, sortChats } from '../display/format.js';

interface AppProps {
  onSendCode: (phone: string) => Promise<void>;
  onSignIn: (code: string) => Promise<void>;
  onPassword: (password: string) => Promise<void>;
  onSelectChat: (index: number) => void;
  onSendMessage: (text: string) => void;
}

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
  const inputText = useAppStore((s) => s.inputText);
  const focusedPane = useAppStore((s) => s.focusedPane);
  const statusMessage = useAppStore((s) => s.statusMessage);

  const setFocusedPane = useAppStore((s) => s.setFocusedPane);
  const setSelectedChatIndex = useAppStore((s) => s.setSelectedChatIndex);
  const setSelectedFolderIndex = useAppStore((s) => s.setSelectedFolderIndex);
  const setInputText = useAppStore((s) => s.setInputText);

  const { exit } = useApp();
  const { columns, rows } = useWindowSize();

  // Derived: filtered chats for current folder
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

  // Sidebar width: ~30% of terminal, min 25, max 45
  const sidebarWidth = Math.min(Math.max(Math.floor(columns * 0.3), 25), 45);
  const mainHeight = Math.max(rows - 4, 10); // header + input + status + padding

  // Global keyboard navigation (active only in main layout)
  useInput(
    (input, key) => {
      // Ctrl+C — quit
      if (key.ctrl && input === 'c') {
        exit();
        return;
      }

      // Tab / Shift+Tab — cycle panes
      if (key.tab) {
        const panes: Array<'chatList' | 'messages' | 'input'> = [
          'chatList',
          'messages',
          'input',
        ];
        const idx = panes.indexOf(focusedPane);
        const next = key.shift
          ? panes[(idx - 1 + panes.length) % panes.length]
          : panes[(idx + 1) % panes.length];
        setFocusedPane(next);
        return;
      }

      // Chat list navigation
      if (focusedPane === 'chatList') {
        if (key.upArrow) {
          const next = Math.max(0, selectedChatIndex - 1);
          setSelectedChatIndex(next);
          onSelectChat(next);
        } else if (key.downArrow) {
          const next = Math.min(sortedFiltered.length - 1, selectedChatIndex + 1);
          setSelectedChatIndex(next);
          onSelectChat(next);
        } else if (key.return) {
          setFocusedPane('input');
        } else if (key.leftArrow && folders.length > 1) {
          // Switch folder left
          const prev = (selectedFolderIndex - 1 + folders.length) % folders.length;
          setSelectedFolderIndex(prev);
          setSelectedChatIndex(0);
          onSelectChat(0);
        } else if (key.rightArrow && folders.length > 1) {
          // Switch folder right
          const next = (selectedFolderIndex + 1) % folders.length;
          setSelectedFolderIndex(next);
          setSelectedChatIndex(0);
          onSelectChat(0);
        }
      }

      // Escape from any pane → back to chat list
      if (key.escape && focusedPane !== 'chatList') {
        setFocusedPane('chatList');
      }
    },
    { isActive: authPhase === 'ready' },
  );

  // ---- Auth phase ----
  if (authPhase !== 'ready') {
    return (
      <AuthScreen
        onSendCode={onSendCode}
        onSignIn={onSignIn}
        onPassword={onPassword}
      />
    );
  }

  // ---- Main layout ----
  return (
    <Box flexDirection="column" height="100%">
      {/* ── Top bar ── */}
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text bold color="cyan">
            ✈ billytelega
          </Text>
          <Text color="gray" dimColor>
            {' '}v0.1
          </Text>
        </Box>
        <Box>
          <Text color="gray" dimColor>
            Tab:pane  ←→:folder  ↑↓:chat  Enter:open  Esc:back  ^C:quit
          </Text>
        </Box>
      </Box>

      {/* ── Main area: sidebar + messages ── */}
      <Box flexDirection="row" flexGrow={1}>
        <ChatList
          chats={chats}
          folders={folders}
          selectedFolderIndex={selectedFolderIndex}
          selectedIndex={selectedChatIndex}
          width={sidebarWidth}
          height={mainHeight}
          focused={focusedPane === 'chatList'}
        />

        <Box flexDirection="column" flexGrow={1}>
          <MessageList
            messages={messages}
            chatTitle={chatTitle}
            chatType={chatType}
            width={columns - sidebarWidth - 2}
            height={mainHeight - 2}
            loading={messagesLoading}
            focused={focusedPane === 'messages'}
          />
        </Box>
      </Box>

      {/* ── Input ─ */}
      <MessageInput
        value={inputText}
        onChange={setInputText}
        onSubmit={(text) => {
          onSendMessage(text);
          setInputText('');
        }}
        focused={focusedPane === 'input'}
      />

      {/* ── Status bar (always visible) ── */}
      <Box paddingX={1} justifyContent="space-between">
        <Text color="gray" dimColor>
          {statusMessage ?? `${chats.length} chats · ${folders.length} folders`}
        </Text>
        <Box>
          <Text color={focusedPane === 'chatList' ? 'cyan' : 'gray'} dimColor={focusedPane !== 'chatList'}>
            [chats]
          </Text>
          <Text color={focusedPane === 'messages' ? 'green' : 'gray'} dimColor={focusedPane !== 'messages'}>
            {' '}[msgs]{' '}
          </Text>
          <Text color={focusedPane === 'input' ? 'yellow' : 'gray'} dimColor={focusedPane !== 'input'}>
            [input]
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
