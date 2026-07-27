import { describe, it, expect } from 'vitest';
import {
  toText,
  formatTimestamp,
  formatChatTimestamp,
  truncateText,
  wrapText,
  formatMessage,
  sortChats,
  formatChatTitle,
  formatChatPreview,
  getInitials,
  avatarColor,
  filterChatsByFolder,
  folderUnreadCount,
  withArchiveFolder,
  ARCHIVE_FOLDER_ID,
  type DisplayMessage,
  type DisplayChat,
  type DisplayFolder,
} from '../src/display/format.js';

// Fixed "now" for deterministic tests: Monday 14 July 2026, 15:30
const NOW = new Date(2026, 6, 14, 15, 30, 0);

// ---------------------------------------------------------------------------
// toText — safe coercion of GramJS values into strings
// ---------------------------------------------------------------------------
describe('toText', () => {
  it('passes strings through unchanged', () => {
    expect(toText('hello')).toBe('hello');
    expect(toText('')).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(toText(null)).toBe('');
    expect(toText(undefined)).toBe('');
  });

  it('stringifies numbers and booleans', () => {
    expect(toText(42)).toBe('42');
    expect(toText(true)).toBe('true');
  });

  it('extracts .text from a TextWithEntities-like TLObject', () => {
    const twe = {
      CONSTRUCTOR_ID: 1,
      className: 'TextWithEntities',
      text: 'folder name',
      entities: [],
    };
    expect(toText(twe)).toBe('folder name');
  });

  it('extracts .message from a Message-like TLObject', () => {
    expect(toText({ message: 'hi there', entities: [] })).toBe('hi there');
  });

  it('extracts .title from an entity-like TLObject', () => {
    expect(toText({ title: 'My Channel' })).toBe('My Channel');
  });

  it('prefers .text over .message and .title', () => {
    expect(toText({ text: 'a', message: 'b', title: 'c' })).toBe('a');
  });

  it('returns empty string for an opaque object', () => {
    expect(toText({ foo: 'bar' })).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Regression: TLObjects must never leak through display helpers as objects
// ---------------------------------------------------------------------------
describe('display helpers are safe against TLObject input', () => {
  const twe = { text: 'Work', entities: [] } as unknown as string;

  it('truncateText coerces a TextWithEntities to its text', () => {
    expect(truncateText(twe, 20)).toBe('Work');
  });

  it('wrapText coerces a TextWithEntities to its text', () => {
    expect(wrapText(twe, 20)).toEqual(['Work']);
  });

  it('getInitials coerces a TextWithEntities to its initials', () => {
    expect(getInitials(twe)).toBe('WO');
  });

  it('formatChatPreview coerces a TLObject lastMessageText', () => {
    const chat = {
      id: 1,
      title: 'x',
      lastMessageText: { text: 'preview', entities: [] } as unknown as string,
      lastMessageDate: NOW,
      unreadCount: 0,
      isChannel: false,
      isGroup: false,
    } as DisplayChat;
    expect(formatChatPreview(chat, 20)).toBe('preview');
  });
});

// ---------------------------------------------------------------------------
// formatTimestamp
// ---------------------------------------------------------------------------
describe('formatTimestamp', () => {
  it('shows HH:MM for today', () => {
    const d = new Date(2026, 6, 14, 9, 5);
    expect(formatTimestamp(d, NOW)).toBe('09:05');
  });

  it('shows HH:MM for today at midnight', () => {
    const d = new Date(2026, 6, 14, 0, 0);
    expect(formatTimestamp(d, NOW)).toBe('00:00');
  });

  it('shows "Yesterday" for yesterday', () => {
    const d = new Date(2026, 6, 13, 23, 59);
    expect(formatTimestamp(d, NOW)).toBe('Yesterday');
  });

  it('shows weekday name for < 7 days ago', () => {
    const d = new Date(2026, 6, 10, 12, 0);
    expect(formatTimestamp(d, NOW)).toBe('Fri');
  });

  it('shows "DD Mon" for same year, > 7 days', () => {
    const d = new Date(2026, 0, 3, 12, 0);
    expect(formatTimestamp(d, NOW)).toBe('03 Jan');
  });

  it('shows "DD Mon YYYY" for a different year', () => {
    const d = new Date(2025, 11, 25, 8, 0);
    expect(formatTimestamp(d, NOW)).toBe('25 Dec 2025');
  });
});

// ---------------------------------------------------------------------------
// formatChatTimestamp
// ---------------------------------------------------------------------------
describe('formatChatTimestamp', () => {
  it('shows HH:MM for today', () => {
    const d = new Date(2026, 6, 14, 14, 7);
    expect(formatChatTimestamp(d, NOW)).toBe('14:07');
  });

  it('shows "Yest" for yesterday', () => {
    const d = new Date(2026, 6, 13, 10, 0);
    expect(formatChatTimestamp(d, NOW)).toBe('Yest');
  });

  it('shows DD/MM for same year', () => {
    const d = new Date(2026, 2, 5, 10, 0);
    expect(formatChatTimestamp(d, NOW)).toBe('05/03');
  });

  it('shows DD/MM/YY for older years', () => {
    const d = new Date(2024, 0, 1, 10, 0);
    expect(formatChatTimestamp(d, NOW)).toBe('01/01/24');
  });
});

// ---------------------------------------------------------------------------
// truncateText
// ---------------------------------------------------------------------------
describe('truncateText', () => {
  it('returns the string unchanged if it fits', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis', () => {
    expect(truncateText('hello world', 8)).toBe('hello w…');
  });

  it('handles maxLen = 1', () => {
    expect(truncateText('abc', 1)).toBe('…');
  });

  it('handles maxLen = 0', () => {
    expect(truncateText('abc', 0)).toBe('');
  });

  it('handles multi-byte characters (emoji)', () => {
    const emoji = '👋🌍🚀💡🔥';
    const result = truncateText(emoji, 4);
    // 3 emoji + ellipsis
    expect(Array.from(result).length).toBe(4);
    expect(result.endsWith('…')).toBe(true);
  });

  it('handles empty string', () => {
    expect(truncateText('', 5)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// wrapText
// ---------------------------------------------------------------------------
describe('wrapText', () => {
  it('wraps at word boundaries', () => {
    const lines = wrapText('hello world foo', 11);
    expect(lines).toEqual(['hello world', 'foo']);
  });

  it('hard-breaks long words', () => {
    const lines = wrapText('abcdefghij', 4);
    expect(lines).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('preserves empty lines (paragraphs)', () => {
    const lines = wrapText('a\n\nb', 10);
    expect(lines).toEqual(['a', '', 'b']);
  });

  it('handles width = 1', () => {
    const lines = wrapText('ab cd', 1);
    expect(lines).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles single word that fits', () => {
    expect(wrapText('hi', 10)).toEqual(['hi']);
  });

  it('handles empty string', () => {
    expect(wrapText('', 10)).toEqual(['']);
  });
});

// ---------------------------------------------------------------------------
// formatMessage
// ---------------------------------------------------------------------------
describe('formatMessage', () => {
  const msg: DisplayMessage = {
    id: 1,
    senderName: 'Alice',
    text: 'Hello world',
    date: new Date(2026, 6, 14, 10, 0),
    isOutgoing: false,
  };

  it('formats incoming message with ← arrow', () => {
    const { senderLine, bodyLines } = formatMessage(msg, 40, NOW);
    expect(senderLine).toContain('←');
    expect(senderLine).toContain('Alice');
    expect(senderLine).toContain('10:00');
    expect(bodyLines).toEqual(['Hello world']);
  });

  it('formats outgoing message with → arrow', () => {
    const out: DisplayMessage = { ...msg, isOutgoing: true };
    const { senderLine } = formatMessage(out, 40, NOW);
    expect(senderLine).toContain('→');
  });

  it('wraps long message bodies', () => {
    const long: DisplayMessage = {
      ...msg,
      text: 'one two three four five six seven eight nine ten',
    };
    const { bodyLines } = formatMessage(long, 20, NOW);
    expect(bodyLines.length).toBeGreaterThan(1);
    for (const line of bodyLines) {
      expect(Array.from(line).length).toBeLessThanOrEqual(20);
    }
  });
});

// ---------------------------------------------------------------------------
// sortChats
// ---------------------------------------------------------------------------
describe('sortChats', () => {
  const chats: DisplayChat[] = [
    {
      id: 1, title: 'Old', lastMessageText: 'old msg',
      lastMessageDate: new Date(2026, 0, 1), unreadCount: 0,
      isChannel: false, isGroup: false,
    },
    {
      id: 2, title: 'New', lastMessageText: 'new msg',
      lastMessageDate: new Date(2026, 6, 14), unreadCount: 3,
      isChannel: false, isGroup: true,
    },
    {
      id: 3, title: 'Mid', lastMessageText: 'mid msg',
      lastMessageDate: new Date(2026, 3, 1), unreadCount: 0,
      isChannel: true, isGroup: false,
    },
  ];

  it('sorts most-recent first', () => {
    const sorted = sortChats(chats);
    expect(sorted.map((c) => c.title)).toEqual(['New', 'Mid', 'Old']);
  });

  it('does not mutate the input array', () => {
    const copy = [...chats];
    sortChats(chats);
    expect(chats).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// formatChatTitle
// ---------------------------------------------------------------------------
describe('formatChatTitle', () => {
  it('shows group prefix and unread count', () => {
    const chat: DisplayChat = {
      id: 1, title: 'Dev Team', lastMessageText: '',
      lastMessageDate: new Date(), unreadCount: 5,
      isChannel: false, isGroup: true,
    };
    const result = formatChatTitle(chat, 30);
    expect(result).toContain('👥');
    expect(result).toContain('(5)');
    expect(result).toContain('Dev Team');
  });

  it('shows channel prefix', () => {
    const chat: DisplayChat = {
      id: 2, title: 'News', lastMessageText: '',
      lastMessageDate: new Date(), unreadCount: 0,
      isChannel: true, isGroup: false,
    };
    expect(formatChatTitle(chat, 30)).toContain('📢');
  });

  it('truncates long titles', () => {
    const chat: DisplayChat = {
      id: 3, title: 'A Very Long Chat Title That Goes On Forever',
      lastMessageText: '', lastMessageDate: new Date(), unreadCount: 0,
      isChannel: false, isGroup: false,
    };
    const result = formatChatTitle(chat, 15);
    expect(Array.from(result).length).toBeLessThanOrEqual(15);
    expect(result.endsWith('…')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatChatPreview
// ---------------------------------------------------------------------------
describe('formatChatPreview', () => {
  it('replaces newlines with spaces and truncates', () => {
    const chat: DisplayChat = {
      id: 1, title: 'Test',
      lastMessageText: 'line one\nline two\nline three',
      lastMessageDate: new Date(), unreadCount: 0,
      isChannel: false, isGroup: false,
    };
    const result = formatChatPreview(chat, 20);
    expect(result).not.toContain('\n');
    expect(Array.from(result).length).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// getInitials
// ---------------------------------------------------------------------------
describe('getInitials', () => {
  it('single word → first 2 chars', () => {
    expect(getInitials('Alice')).toBe('AL');
  });

  it('two words → first char of each', () => {
    expect(getInitials('Dev Team')).toBe('DT');
  });

  it('strips emoji', () => {
    expect(getInitials('🌟 Star Chat')).toBe('SC');
  });

  it('empty string → ?', () => {
    expect(getInitials('')).toBe('?');
  });

  it('single char', () => {
    expect(getInitials('A')).toBe('A');
  });

  it('cyrillic', () => {
    expect(getInitials('Два майора')).toBe('ДМ');
  });
});

// ---------------------------------------------------------------------------
// avatarColor
// ---------------------------------------------------------------------------
describe('avatarColor', () => {
  it('returns a valid color string', () => {
    const validColors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
    for (let i = 0; i < 20; i++) {
      expect(validColors).toContain(avatarColor(i));
    }
  });

  it('is deterministic', () => {
    expect(avatarColor(42)).toBe(avatarColor(42));
  });
});

// ---------------------------------------------------------------------------
// filterChatsByFolder
// ---------------------------------------------------------------------------
describe('filterChatsByFolder', () => {
  const chats: DisplayChat[] = [
    { id: 1, title: 'Alice', lastMessageText: '', lastMessageDate: new Date(), unreadCount: 0, isChannel: false, isGroup: false, isContact: true },
    { id: 2, title: 'Dev Team', lastMessageText: '', lastMessageDate: new Date(), unreadCount: 0, isChannel: false, isGroup: true },
    { id: 3, title: 'News', lastMessageText: '', lastMessageDate: new Date(), unreadCount: 0, isChannel: true, isGroup: false },
    { id: 4, title: 'Bot', lastMessageText: '', lastMessageDate: new Date(), unreadCount: 0, isChannel: false, isGroup: false, isBot: true },
    { id: 5, title: 'Stranger', lastMessageText: '', lastMessageDate: new Date(), unreadCount: 0, isChannel: false, isGroup: false },
  ];

  const allFolder: DisplayFolder = {
    id: 0, title: 'All', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [],
    contacts: true, nonContacts: true, groups: true, broadcasts: true, bots: true,
  };

  it('"All" folder returns everything', () => {
    expect(filterChatsByFolder(chats, allFolder)).toHaveLength(5);
  });

  it('groups-only folder', () => {
    const folder: DisplayFolder = {
      id: 1, title: 'Groups', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [],
      contacts: false, nonContacts: false, groups: true, broadcasts: false, bots: false,
    };
    const result = filterChatsByFolder(chats, folder);
    expect(result.map((c) => c.title)).toEqual(['Dev Team']);
  });

  it('non-contacts only includes private users, not groups or channels', () => {
    const folder: DisplayFolder = {
      id: 2, title: 'Personal', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [],
      contacts: true, nonContacts: true, groups: false, broadcasts: false, bots: false,
    };
    const result = filterChatsByFolder(chats, folder);
    expect(result.map((c) => c.title)).toEqual(['Alice', 'Stranger']);
  });

  it('includeChatIds overrides flags', () => {
    const folder: DisplayFolder = {
      id: 2, title: 'Custom', pinnedChatIds: [], includeChatIds: [1, 3], excludeChatIds: [],
      contacts: false, nonContacts: false, groups: false, broadcasts: false, bots: false,
    };
    const result = filterChatsByFolder(chats, folder);
    expect(result.map((c) => c.id).sort()).toEqual([1, 3]);
  });

  it('pinnedChatIds are explicit folder members', () => {
    const folder: DisplayFolder = {
      id: 3, title: 'Pinned', pinnedChatIds: [3], includeChatIds: [], excludeChatIds: [],
      contacts: false, nonContacts: false, groups: false, broadcasts: false, bots: false,
    };
    expect(filterChatsByFolder(chats, folder).map((c) => c.id)).toEqual([3]);
  });

  it('excludeChatIds removes chats', () => {
    const folder: DisplayFolder = {
      id: 3, title: 'No Bot', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [4],
      contacts: true, nonContacts: true, groups: true, broadcasts: true, bots: true,
    };
    const result = filterChatsByFolder(chats, folder);
    expect(result.find((c) => c.id === 4)).toBeUndefined();
  });

  it('archived chats are hidden from "All" and custom folders', () => {
    const archivedChat: DisplayChat = { ...chats[0]!, id: 99, title: 'Old', isArchived: true };
    const list = [...chats, archivedChat];
    expect(filterChatsByFolder(list, allFolder).find((c) => c.id === 99)).toBeUndefined();

    const custom: DisplayFolder = {
      id: 4, title: 'Custom', pinnedChatIds: [], includeChatIds: [99], excludeChatIds: [],
      contacts: true, nonContacts: true, groups: true, broadcasts: true, bots: true,
    };
    // Even an explicit include must not pull an archived chat out of the archive.
    expect(filterChatsByFolder(list, custom).find((c) => c.id === 99)).toBeUndefined();
  });

  it('Archive folder contains only archived chats', () => {
    const archivedChat: DisplayChat = { ...chats[0]!, id: 99, title: 'Old', isArchived: true };
    const archive = withArchiveFolder([], [archivedChat])[0]!;
    expect(archive.id).toBe(ARCHIVE_FOLDER_ID);
    const result = filterChatsByFolder([...chats, archivedChat], archive);
    expect(result.map((c) => c.id)).toEqual([99]);
  });
});

// ---------------------------------------------------------------------------
// withArchiveFolder
// ---------------------------------------------------------------------------
describe('withArchiveFolder', () => {
  const allFolder: DisplayFolder = {
    id: 0, title: 'All', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [],
    contacts: true, nonContacts: true, groups: true, broadcasts: true, bots: true,
  };
  const custom: DisplayFolder = { ...allFolder, id: 1, title: 'Personal' };
  const archivedChat: DisplayChat = {
    id: 9, title: 'Old', lastMessageText: '', lastMessageDate: new Date(), unreadCount: 0,
    isChannel: false, isGroup: false, isArchived: true,
  };

  it('inserts Archive right after "All" when archived chats exist', () => {
    const result = withArchiveFolder([allFolder, custom], [archivedChat]);
    expect(result.map((f) => f.id)).toEqual([0, ARCHIVE_FOLDER_ID, 1]);
  });

  it('does not add Archive when nothing is archived', () => {
    const plain: DisplayChat = { ...archivedChat, isArchived: false };
    expect(withArchiveFolder([allFolder, custom], [plain])).toEqual([allFolder, custom]);
  });

  it('removes a stale Archive tab once the archive is empty', () => {
    const withArchive = withArchiveFolder([allFolder, custom], [archivedChat]);
    expect(withArchiveFolder(withArchive, []).map((f) => f.id)).toEqual([0, 1]);
  });
});

// ---------------------------------------------------------------------------
// folderUnreadCount
// ---------------------------------------------------------------------------
describe('folderUnreadCount', () => {
  const chats: DisplayChat[] = [
    { id: 1, title: 'A', lastMessageText: '', lastMessageDate: new Date(), unreadCount: 3, isChannel: false, isGroup: false, isContact: true },
    { id: 2, title: 'B', lastMessageText: '', lastMessageDate: new Date(), unreadCount: 5, isChannel: false, isGroup: true },
  ];

  it('sums unread for matching chats', () => {
    const folder: DisplayFolder = {
      id: 1, title: 'All', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [],
      contacts: true, nonContacts: true, groups: true, broadcasts: true, bots: true,
    };
    expect(folderUnreadCount(chats, folder)).toBe(8);
  });

  it('returns 0 for empty filter', () => {
    const folder: DisplayFolder = {
      id: 2, title: 'Empty', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [],
      contacts: false, nonContacts: false, groups: false, broadcasts: false, bots: false,
    };
    expect(folderUnreadCount(chats, folder)).toBe(0);
  });
});
