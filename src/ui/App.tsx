/**
 * App — top-level component: auth screen ↔ main chat layout.
 */
import React from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useAppStore } from '../store/app.js';
import { AuthScreen } from './AuthScreen.js';
import { ChatList } from './ChatList.js';
import { MessageList } from './MessageList.js';
import { MessageInput } from './MessageInput.js';

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
  const selectedChatIndex = useAppStore((s) => s.selectedChatIndex);
  const messages = useAppStore((s) => s.messages);
  const messagesLoading = useAppStore((s) => s.messagesLoading);
  const inputText = useAppStore((s) => s.inputText);
  const focusedPane = useAppStore((s) => s.focusedPane);
  const statusMessage = useAppStore((s) => s.statusMessage);

  const setFocusedPane = useAppStore((s) => s.setFocusedPane);
  const setSelectedChatIndex = useAppStore((s) => s.setSelectedChatIndex);
  const setInputText = useAppStore((s) => s.setInputText);

  const { exit } = useApp();

  // Global keyboard navigation (active only in main layout)
  useInput(
    (input, key) => {
      // Ctrl+C — quit
      if (key.ctrl && input === 'c') {
        exit();
        return;
      }

      // Tab — cycle panes
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
          const next = Math.min(chats.length - 1, selectedChatIndex + 1);
          setSelectedChatIndex(next);
          onSelectChat(next);
        } else if (key.return) {
          setFocusedPane('input');
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
  const selectedChat = chats[selectedChatIndex];
  const chatTitle = selectedChat?.title ?? '';

  return (
    <Box flexDirection="column" height="100%">
      {/* Top bar */}
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color="cyan">
          billytelega
        </Text>
        <Text color="gray" dimColor>
          Tab: switch pane · ↑↓: navigate · Ctrl+C: quit
        </Text>
      </Box>

      {/* Main area: sidebar + messages */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Sidebar */}
        <ChatList
          chats={chats}
          selectedIndex={selectedChatIndex}
          width={30}
          height={20}
          focused={focusedPane === 'chatList'}
        />

        {/* Message area */}
        <Box flexDirection="column" flexGrow={1}>
          <MessageList
            messages={messages}
            chatTitle={chatTitle}
            width={60}
            height={18}
            loading={messagesLoading}
            focused={focusedPane === 'messages'}
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
      {statusMessage && (
        <Box paddingX={1}>
          <Text color="yellow" dimColor>
            {statusMessage}
          </Text>
        </Box>
      )}
    </Box>
  );
}
