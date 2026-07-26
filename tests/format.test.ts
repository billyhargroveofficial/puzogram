import { describe, it, expect } from 'vitest';
import {
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
  type DisplayMessage,
  type DisplayChat,
  type DisplayFolder,
} from '../src/display/format.js';

// Fixed "now" for deterministic tests: Monday 14 July 2026, 15:30
const NOW = new Date(2026, 6, 14, 15, 30, 0);

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

  it('includeChatIds overrides flags', () => {
    const folder: DisplayFolder = {
      id: 2, title: 'Custom', pinnedChatIds: [], includeChatIds: [1, 3], excludeChatIds: [],
      contacts: false, nonContacts: false, groups: false, broadcasts: false, bots: false,
    };
    const result = filterChatsByFolder(chats, folder);
    expect(result.map((c) => c.id).sort()).toEqual([1, 3]);
  });

  it('excludeChatIds removes chats', () => {
    const folder: DisplayFolder = {
      id: 3, title: 'No Bot', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [4],
      contacts: true, nonContacts: true, groups: true, broadcasts: true, bots: true,
    };
    const result = filterChatsByFolder(chats, folder);
    expect(result.find((c) => c.id === 4)).toBeUndefined();
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
