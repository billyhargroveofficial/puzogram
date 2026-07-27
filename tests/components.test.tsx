/**
 * Ink component render tests using ink-testing-library.
 * Renders each component with fixture data and asserts visible output.
 *
 * ChatList/MessageList use @ink-tools/ink-mouse hooks (useOnClick/useOnWheel),
 * which throw outside a <MouseProvider>, so those renders are wrapped. We pass
 * autoEnable={false} so the provider supplies context without writing terminal
 * escape sequences during tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MouseProvider } from '@ink-tools/ink-mouse';
import { ChatList } from '../src/ui/ChatList.js';
import { MessageList } from '../src/ui/MessageList.js';
import { MessageInput } from '../src/ui/MessageInput.js';
import { AuthScreen } from '../src/ui/AuthScreen.js';
import { appStore } from '../src/store/app.js';
import type { DisplayChat, DisplayMessage, DisplayFolder } from '../src/display/format.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CHATS: DisplayChat[] = [
  {
    id: 1, title: 'Alice', lastMessageText: 'Hey there!',
    lastMessageDate: new Date(2026, 6, 14, 10, 0), unreadCount: 2,
    isChannel: false, isGroup: false, isContact: true,
  },
  {
    id: 2, title: 'Dev Team', lastMessageText: 'Build passed ✅',
    lastMessageDate: new Date(2026, 6, 14, 9, 30), unreadCount: 0,
    isChannel: false, isGroup: true,
  },
  {
    id: 3, title: 'Telegram News', lastMessageText: 'New update released',
    lastMessageDate: new Date(2026, 6, 13, 18, 0), unreadCount: 5,
    isChannel: true, isGroup: false,
  },
];

const FIXTURE_FOLDERS: DisplayFolder[] = [
  {
    id: 0, title: 'All', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [],
    contacts: true, nonContacts: true, groups: true, broadcasts: true, bots: true,
  },
  {
    id: 1, title: 'Personal', pinnedChatIds: [], includeChatIds: [1], excludeChatIds: [],
    contacts: true, nonContacts: false, groups: false, broadcasts: false, bots: false,
  },
  {
    id: 2, title: 'work', pinnedChatIds: [], includeChatIds: [2], excludeChatIds: [],
    contacts: false, nonContacts: false, groups: true, broadcasts: false, bots: false,
  },
];

const FIXTURE_MESSAGES: DisplayMessage[] = [
  {
    id: 101, senderName: 'Alice', text: 'Hello! How are you?',
    date: new Date(2026, 6, 14, 10, 0), isOutgoing: false,
  },
  {
    id: 102, senderName: 'Me', text: 'I am fine, thanks!',
    date: new Date(2026, 6, 14, 10, 1), isOutgoing: true,
  },
  {
    id: 103, senderName: 'Alice', text: 'Great to hear that. See you tomorrow!',
    date: new Date(2026, 6, 14, 10, 2), isOutgoing: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap a component in a (non-auto-enabling) MouseProvider for tests. */
function withMouse(ui: React.ReactElement): React.ReactElement {
  return <MouseProvider autoEnable={false}>{ui}</MouseProvider>;
}

const noop = (): void => {};

/** Default ChatList props; tests override what they care about. */
const chatListDefaults = {
  chats: FIXTURE_CHATS,
  folders: FIXTURE_FOLDERS,
  selectedFolderIndex: 0,
  selectedIndex: 0,
  width: 30,
  height: 15,
  focused: true,
  onSelectChat: noop,
  onSwitchFolder: noop,
  onScrollChats: noop,
};

// ---------------------------------------------------------------------------
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  appStore.setState({
    authPhase: 'phone',
    authError: null,
    phoneNumber: '',
    phoneCodeHash: null,
    folders: [],
    selectedFolderIndex: 0,
    chats: [],
    selectedChatIndex: 0,
    activeChatId: null,
    chatsLoading: false,
    messages: [],
    messagesLoading: false,
    messagesScrollOffset: 0,
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
    const { lastFrame } = render(withMouse(<ChatList {...chatListDefaults} />));
    const output = lastFrame()!;
    expect(output).toContain('Alice');
    expect(output).toContain('Dev Team');
    expect(output).toContain('Telegram News');
  });

  it('shows folder tabs', () => {
    const { lastFrame } = render(withMouse(<ChatList {...chatListDefaults} />));
    const output = lastFrame()!;
    expect(output).toContain('All');
    expect(output).toContain('Personal');
    expect(output).toContain('work');
  });

  it('shows avatar glyphs by chat type', () => {
    const { lastFrame } = render(withMouse(<ChatList {...chatListDefaults} />));
    const output = lastFrame()!;
    expect(output).toContain('👤'); // Alice (private)
    expect(output).toContain('👥'); // Dev Team (group)
    expect(output).toContain('📢'); // Telegram News (channel)
  });

  it('shows unread badge', () => {
    const { lastFrame } = render(withMouse(<ChatList {...chatListDefaults} />));
    const output = lastFrame()!;
    expect(output).toContain('2');
    expect(output).toContain('5');
  });

  it('filters by folder', () => {
    const { lastFrame } = render(
      withMouse(<ChatList {...chatListDefaults} selectedFolderIndex={2} />), // "work" → groups only
    );
    const output = lastFrame()!;
    expect(output).toContain('Dev Team');
    expect(output).not.toContain('Alice');
  });

  it('shows "No chats" when empty', () => {
    const { lastFrame } = render(
      withMouse(<ChatList {...chatListDefaults} chats={[]} focused={false} />),
    );
    expect(lastFrame()!).toContain('No chats');
  });

  it('shows last-message preview and timestamp in the two-line row', () => {
    const { lastFrame } = render(withMouse(<ChatList {...chatListDefaults} />));
    const output = lastFrame()!;
    expect(output).toContain('Hey there!'); // Alice's preview (line 2)
    expect(output).toContain('14/07'); // compact date, right-aligned (line 1)
  });

  it('keeps an empty-preview chat row at exactly two lines', () => {
    const chats: DisplayChat[] = [
      { ...FIXTURE_CHATS[0]!, lastMessageText: '', unreadCount: 0 },
      { ...FIXTURE_CHATS[1]! },
    ];
    const { lastFrame } = render(withMouse(<ChatList {...chatListDefaults} chats={chats} />));
    const lines = lastFrame()!.split('\n');
    const firstTitleLine = lines.findIndex((line) => line.includes('Alice'));
    const secondTitleLine = lines.findIndex((line) => line.includes('Dev Team'));
    expect(secondTitleLine - firstTitleLine).toBe(2);
  });

  it('shows a compact unread counter on the active folder tab', () => {
    const { lastFrame } = render(withMouse(<ChatList {...chatListDefaults} />));
    // "All" tab aggregates 2 + 0 + 5 = 7 unread → shows "7".
    expect(lastFrame()!).toContain('7');
  });

  it('hides archived chats everywhere except the Archive tab', () => {
    const archived: DisplayChat = {
      id: 99, title: 'DustyChat', lastMessageText: 'old',
      lastMessageDate: new Date(2026, 6, 10), unreadCount: 0,
      isChannel: false, isGroup: false, isArchived: true,
    };
    const folders: DisplayFolder[] = [
      FIXTURE_FOLDERS[0]!,
      {
        id: -1, title: 'Archive', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [],
        contacts: false, nonContacts: false, groups: false, broadcasts: false, bots: false,
      },
    ];
    const chats = [...FIXTURE_CHATS, archived];

    const all = render(
      withMouse(<ChatList {...chatListDefaults} chats={chats} folders={folders} />),
    );
    expect(all.lastFrame()!).not.toContain('DustyChat');
    all.unmount();

    const archive = render(
      withMouse(
        <ChatList {...chatListDefaults} chats={chats} folders={folders} selectedFolderIndex={1} />,
      ),
    );
    const frame = archive.lastFrame()!;
    expect(frame).toContain('DustyChat');
    expect(frame).not.toContain('Alice');
    archive.unmount();
  });
});

// ---------------------------------------------------------------------------
// MessageList
// ---------------------------------------------------------------------------

describe('MessageList', () => {
  it('renders message senders and text', () => {
    const { lastFrame } = render(
      withMouse(
        <MessageList
          messages={FIXTURE_MESSAGES}
          chatTitle="Alice"
          chatType="private"
          width={60}
          height={20}
          loading={false}
          focused={true}
        />,
      ),
    );
    const output = lastFrame()!;
    expect(output).toContain('Alice');
    expect(output).toContain('Hello! How are you?');
    expect(output).toContain('I am fine, thanks!');
  });

  it('shows the chat title in the header', () => {
    const { lastFrame } = render(
      withMouse(
        <MessageList
          messages={FIXTURE_MESSAGES}
          chatTitle="Alice"
          chatType="private"
          width={60}
          height={20}
          loading={false}
          focused={true}
        />,
      ),
    );
    expect(lastFrame()!).toContain('Alice');
  });

  it('shows chat type', () => {
    const { lastFrame } = render(
      withMouse(
        <MessageList
          messages={FIXTURE_MESSAGES}
          chatTitle="Dev Team"
          chatType="group"
          width={60}
          height={20}
          loading={false}
          focused={true}
        />,
      ),
    );
    expect(lastFrame()!).toContain('group');
  });

  it('shows placeholder when no messages', () => {
    const { lastFrame } = render(
      withMouse(
        <MessageList
          messages={[]}
          chatTitle="Empty Chat"
          width={60}
          height={20}
          loading={false}
          focused={false}
        />,
      ),
    );
    expect(lastFrame()!).toContain('No messages yet');
  });

  it('shows loading indicator', () => {
    const { lastFrame } = render(
      withMouse(
        <MessageList
          messages={[]}
          chatTitle="Loading Chat"
          width={60}
          height={20}
          loading={true}
          focused={false}
        />,
      ),
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
      withMouse(<MessageInput value="" onChange={noop} onSubmit={noop} focused={true} />),
    );
    expect(lastFrame()!).toContain('❯');
  });

  it('shows the current value', () => {
    const { lastFrame } = render(
      withMouse(<MessageInput value="hello world" onChange={noop} onSubmit={noop} focused={true} />),
    );
    expect(lastFrame()!).toContain('hello world');
  });

  it('shows hint text when unfocused and empty', () => {
    const { lastFrame } = render(
      withMouse(<MessageInput value="" onChange={noop} onSubmit={noop} focused={false} />),
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
      <AuthScreen onSendCode={async () => {}} onSignIn={async () => {}} onPassword={async () => {}} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('Phone number');
    expect(output).toContain('billytelega');
  });

  it('renders the code prompt in code phase', () => {
    appStore.setState({ authPhase: 'code' });
    const { lastFrame } = render(
      <AuthScreen onSendCode={async () => {}} onSignIn={async () => {}} onPassword={async () => {}} />,
    );
    expect(lastFrame()!).toContain('code from Telegram');
  });

  it('renders the password prompt in password phase', () => {
    appStore.setState({ authPhase: 'password' });
    const { lastFrame } = render(
      <AuthScreen onSendCode={async () => {}} onSignIn={async () => {}} onPassword={async () => {}} />,
    );
    expect(lastFrame()!).toContain('2FA password');
  });

  it('shows auth errors', () => {
    appStore.setState({ authPhase: 'phone', authError: 'Invalid phone number' });
    const { lastFrame } = render(
      <AuthScreen onSendCode={async () => {}} onSignIn={async () => {}} onPassword={async () => {}} />,
    );
    expect(lastFrame()!).toContain('Invalid phone number');
  });
});
