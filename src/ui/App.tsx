/**
 * App — top-level component: auth screen ↔ main chat layout.
 *
 * Interaction model (keyboard-first, per the patterns used by real Ink TUIs):
 *  - an explicit `focusedPane` state gates which pane's keys are live;
 *  - the chat list uses clamped (non-wrapping) navigation with vim j/k/h/l;
 *  - the message feed scrolls itself (line-based viewport in <MessageList>);
 *  - mouse press/wheel is handled inside <ChatList>/<MessageList> via
 *    @ink-tools/ink-mouse and funnelled back through the same callbacks.
 */
import React from 'react';
import { Box, Text, useInput, useApp, useWindowSize } from 'ink';
import { useAppStore } from '../store/app.js';
import { AuthScreen } from './AuthScreen.js';
import { ChatList } from './ChatList.js';
import { MessageList } from './MessageList.js';
import { MessageInput } from './MessageInput.js';
import { filterChatsByFolder, sortChats } from '../display/format.js';
import { theme } from '../display/theme.js';

interface AppProps {
  onSendCode: (phone: string) => Promise<void>;
  onSignIn: (code: string) => Promise<void>;
  onPassword: (password: string) => Promise<void>;
  /** Open a chat by its id (mouse press or keyboard both go through here). */
  onSelectChat: (chatId: number) => void;
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
  const inputText = useAppStore((s) => s.inputText);
  const focusedPane = useAppStore((s) => s.focusedPane);
  const statusMessage = useAppStore((s) => s.statusMessage);

  const setFocusedPane = useAppStore((s) => s.setFocusedPane);
  const setSelectedChatIndex = useAppStore((s) => s.setSelectedChatIndex);
  const setSelectedFolderIndex = useAppStore((s) => s.setSelectedFolderIndex);
  const setInputText = useAppStore((s) => s.setInputText);

  const { exit } = useApp();
  const { columns, rows } = useWindowSize();

  // Layout geometry. The root is pinned to the terminal height so neither pane
  // can grow past the screen (which, in alternate-screen mode, would push the
  // whole layout off-screen). top(1) + status(1) = 2 chrome rows; the sidebar
  // fills the rest, and the input lives under the feed in the right column.
  const sidebarWidth = clamp(Math.floor(columns * 0.3), 25, 45);
  const sidebarHeight = Math.max(rows - 2, 8);
  const inputHeight = 3; // MessageInput's rounded border box
  const feedHeight = Math.max(sidebarHeight - inputHeight, 6);

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

  // ---- Shared actions (keyboard + mouse both funnel through these) ---------

  const openChatByIndex = (idx: number): void => {
    const clamped = clamp(idx, 0, Math.max(0, sortedFiltered.length - 1));
    setSelectedChatIndex(clamped);
    const chat = sortedFiltered[clamped];
    if (chat) onSelectChat(chat.id);
  };

  const switchFolder = (idx: number): void => {
    if (folders.length === 0) return;
    const next = (idx + folders.length) % folders.length;
    setSelectedFolderIndex(next);
    setSelectedChatIndex(0);
    const folder = folders[next];
    const first = sortChats(folder ? filterChatsByFolder(chats, folder) : chats)[0];
    if (first) onSelectChat(first.id);
  };

  // ---- Keyboard navigation ------------------------------------------------
  // Only the chat-list pane is driven from here; the message feed handles its
  // own scroll keys internally (gated on its `focused` prop) so the two never
  // fight over the same keystroke.
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
        if (key.upArrow || input === 'k') {
          openChatByIndex(selectedChatIndex - 1);
        } else if (key.downArrow || input === 'j') {
          openChatByIndex(selectedChatIndex + 1);
        } else if (key.return) {
          setFocusedPane('input');
        } else if ((key.leftArrow || input === 'h') && folders.length > 1) {
          switchFolder(selectedFolderIndex - 1);
        } else if ((key.rightArrow || input === 'l') && folders.length > 1) {
          switchFolder(selectedFolderIndex + 1);
        }
      }

      if (key.escape && focusedPane !== 'chatList') {
        setFocusedPane('chatList');
      }
    },
    { isActive: authPhase === 'ready' },
  );

  // ---- Auth phase ---------------------------------------------------------
  if (authPhase !== 'ready') {
    return <AuthScreen onSendCode={onSendCode} onSignIn={onSignIn} onPassword={onPassword} />;
  }

  // ---- Main layout --------------------------------------------------------
  return (
    <Box flexDirection="column" height={rows} overflow="hidden">
      {/* Top bar */}
      <Box paddingX={1} flexShrink={0} justifyContent="space-between">
        <Box>
          <Text bold color={theme.accent}>
            ✈ billytelega
          </Text>
          <Text color={theme.textFaint} dimColor>
            {' '}
            v0.5
          </Text>
        </Box>
        <Text color={theme.textFaint} dimColor>
          Tab:pane j/k:move h/l:folder Enter:open wheel:scroll ^C:quit
        </Text>
      </Box>

      {/* Sidebar + (feed + input in the right column) */}
      <Box flexDirection="row" flexGrow={1} overflow="hidden">
        <ChatList
          chats={chats}
          folders={folders}
          selectedFolderIndex={selectedFolderIndex}
          selectedIndex={selectedChatIndex}
          width={sidebarWidth}
          height={sidebarHeight}
          focused={focusedPane === 'chatList'}
          onSelectChat={(chatId) => {
            // Mouse press: move the highlight to the pressed chat, then open it.
            const idx = sortedFiltered.findIndex((c) => c.id === chatId);
            if (idx >= 0) setSelectedChatIndex(idx);
            onSelectChat(chatId);
          }}
          onSwitchFolder={switchFolder}
          onScrollChats={(delta) => openChatByIndex(selectedChatIndex + delta)}
          onFocusPane={() => setFocusedPane('chatList')}
        />
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          {/* key={chat id} remounts the feed on chat switch → scroll resets to bottom */}
          <MessageList
            key={selectedChat?.id ?? 'none'}
            messages={messages}
            chatTitle={chatTitle}
            chatType={chatType}
            width={columns - sidebarWidth - 2}
            height={feedHeight}
            loading={messagesLoading}
            focused={focusedPane === 'messages'}
            onFocusPane={() => setFocusedPane('messages')}
          />
          <MessageInput
            value={inputText}
            onChange={setInputText}
            onSubmit={(text) => {
              onSendMessage(text);
              setInputText('');
              setFocusedPane('messages');
            }}
            focused={focusedPane === 'input'}
            onFocusPane={() => setFocusedPane('input')}
          />
        </Box>
      </Box>

      {/* Status bar */}
      <Box paddingX={1} flexShrink={0} justifyContent="space-between">
        <Text color={theme.textFaint} dimColor>
          {statusMessage ?? `${chats.length} chats · ${folders.length} folders`}
        </Text>
        <Box>
          <Text
            color={focusedPane === 'chatList' ? theme.accent : theme.textGhost}
            dimColor={focusedPane !== 'chatList'}
          >
            [chats]
          </Text>
          <Text
            color={focusedPane === 'messages' ? theme.success : theme.textGhost}
            dimColor={focusedPane !== 'messages'}
          >
            {' '}
            [msgs]{' '}
          </Text>
          <Text
            color={focusedPane === 'input' ? theme.warning : theme.textGhost}
            dimColor={focusedPane !== 'input'}
          >
            [input]
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
