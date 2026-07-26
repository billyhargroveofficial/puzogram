/**
 * Ink component render tests using ink-testing-library.
 * Renders each component with fixture data and asserts visible output.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ChatList } from '../src/ui/ChatList.js';
import { MessageList } from '../src/ui/MessageList.js';
import { MessageInput } from '../src/ui/MessageInput.js';
import { AuthScreen } from '../src/ui/AuthScreen.js';
import { appStore } from '../src/store/app.js';
import type { DisplayChat, DisplayMessage } from '../src/display/format.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CHATS: DisplayChat[] = [
  {
    id: 1,
    title: 'Alice',
    lastMessageText: 'Hey there!',
    lastMessageDate: new Date(2026, 6, 14, 10, 0),
    unreadCount: 2,
    isChannel: false,
    isGroup: false,
  },
  {
    id: 2,
    title: 'Dev Team',
    lastMessageText: 'Build passed ✅',
    lastMessageDate: new Date(2026, 6, 14, 9, 30),
    unreadCount: 0,
    isChannel: false,
    isGroup: true,
  },
  {
    id: 3,
    title: 'Telegram News',
    lastMessageText: 'New update released',
    lastMessageDate: new Date(2026, 6, 13, 18, 0),
    unreadCount: 5,
    isChannel: true,
    isGroup: false,
  },
];

const FIXTURE_MESSAGES: DisplayMessage[] = [
  {
    id: 101,
    senderName: 'Alice',
    text: 'Hello! How are you?',
    date: new Date(2026, 6, 14, 10, 0),
    isOutgoing: false,
  },
  {
    id: 102,
    senderName: 'Me',
    text: 'I am fine, thanks!',
    date: new Date(2026, 6, 14, 10, 1),
    isOutgoing: true,
  },
  {
    id: 103,
    senderName: 'Alice',
    text: 'Great to hear that. See you tomorrow!',
    date: new Date(2026, 6, 14, 10, 2),
    isOutgoing: false,
  },
];

// ---------------------------------------------------------------------------
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  appStore.setState({
    authPhase: 'phone',
    authError: null,
    phoneNumber: '',
    phoneCodeHash: null,
    chats: [],
    selectedChatIndex: 0,
    chatsLoading: false,
    messages: [],
    messagesLoading: false,
    inputText: '',
    focusedPane: 'chatList',
    statusMessage: null,
  });
});

// ---------------------------------------------------------------------------
// ChatList
// ---------------------------------------------------------------------------

describe('ChatList', () => {
  it('renders chat titles', () => {
    const { lastFrame } = render(
      <ChatList
        chats={FIXTURE_CHATS}
        selectedIndex={0}
        width={30}
        height={10}
        focused={true}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain('Alice');
    expect(output).toContain('Dev Team');
    expect(output).toContain('Telegram News');
  });

  it('shows unread counts', () => {
    const { lastFrame } = render(
      <ChatList
        chats={FIXTURE_CHATS}
        selectedIndex={0}
        width={30}
        height={10}
        focused={true}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain('(2)');
    expect(output).toContain('(5)');
  });

  it('shows "No chats yet" when empty', () => {
    const { lastFrame } = render(
      <ChatList chats={[]} selectedIndex={0} width={30} height={10} focused={false} />,
    );
    expect(lastFrame()!).toContain('No chats yet');
  });

  it('renders the Chats header', () => {
    const { lastFrame } = render(
      <ChatList
        chats={FIXTURE_CHATS}
        selectedIndex={0}
        width={30}
        height={10}
        focused={true}
      />,
    );
    expect(lastFrame()!).toContain('Chats');
  });
});

// ---------------------------------------------------------------------------
// MessageList
// ---------------------------------------------------------------------------

describe('MessageList', () => {
  it('renders message senders and text', () => {
    const { lastFrame } = render(
      <MessageList
        messages={FIXTURE_MESSAGES}
        chatTitle="Alice"
        width={60}
        height={20}
        loading={false}
        focused={true}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain('Alice');
    expect(output).toContain('Hello! How are you?');
    expect(output).toContain('I am fine, thanks!');
  });

  it('shows the chat title in the header', () => {
    const { lastFrame } = render(
      <MessageList
        messages={FIXTURE_MESSAGES}
        chatTitle="Alice"
        width={60}
        height={20}
        loading={false}
        focused={true}
      />,
    );
    expect(lastFrame()!).toContain('Alice');
  });

  it('shows placeholder when no messages', () => {
    const { lastFrame } = render(
      <MessageList
        messages={[]}
        chatTitle="Empty Chat"
        width={60}
        height={20}
        loading={false}
        focused={false}
      />,
    );
    expect(lastFrame()!).toContain('No messages yet');
  });

  it('shows loading indicator', () => {
    const { lastFrame } = render(
      <MessageList
        messages={[]}
        chatTitle="Loading Chat"
        width={60}
        height={20}
        loading={true}
        focused={false}
      />,
    );
    expect(lastFrame()!).toContain('⏳');
  });
});

// ---------------------------------------------------------------------------
// MessageInput
// ---------------------------------------------------------------------------

describe('MessageInput', () => {
  it('renders the prompt character', () => {
    const { lastFrame } = render(
      <MessageInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        focused={true}
      />,
    );
    expect(lastFrame()!).toContain('❯');
  });

  it('shows the current value', () => {
    const { lastFrame } = render(
      <MessageInput
        value="hello world"
        onChange={() => {}}
        onSubmit={() => {}}
        focused={true}
      />,
    );
    expect(lastFrame()!).toContain('hello world');
  });

  it('shows hint text when unfocused and empty', () => {
    const { lastFrame } = render(
      <MessageInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        focused={false}
      />,
    );
    expect(lastFrame()!).toContain('Tab to focus');
  });
});

// ---------------------------------------------------------------------------
// AuthScreen
// ---------------------------------------------------------------------------

describe('AuthScreen', () => {
  it('renders the phone prompt in phone phase', () => {
    appStore.setState({ authPhase: 'phone' });
    const { lastFrame } = render(
      <AuthScreen
        onSendCode={async () => {}}
        onSignIn={async () => {}}
        onPassword={async () => {}}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain('Phone number');
    expect(output).toContain('billytelega');
  });

  it('renders the code prompt in code phase', () => {
    appStore.setState({ authPhase: 'code' });
    const { lastFrame } = render(
      <AuthScreen
        onSendCode={async () => {}}
        onSignIn={async () => {}}
        onPassword={async () => {}}
      />,
    );
    expect(lastFrame()!).toContain('code from Telegram');
  });

  it('renders the password prompt in password phase', () => {
    appStore.setState({ authPhase: 'password' });
    const { lastFrame } = render(
      <AuthScreen
        onSendCode={async () => {}}
        onSignIn={async () => {}}
        onPassword={async () => {}}
      />,
    );
    expect(lastFrame()!).toContain('2FA password');
  });

  it('shows auth errors', () => {
    appStore.setState({ authPhase: 'phone', authError: 'Invalid phone number' });
    const { lastFrame } = render(
      <AuthScreen
        onSendCode={async () => {}}
        onSignIn={async () => {}}
        onPassword={async () => {}}
      />,
    );
    expect(lastFrame()!).toContain('Invalid phone number');
  });
});
