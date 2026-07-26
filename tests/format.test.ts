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
  type DisplayMessage,
  type DisplayChat,
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
    // 10 July 2026 is a Friday (6 days before Tue 14 July)
    const d = new Date(2026, 6, 10, 12, 0);
    expect(formatTimestamp(d, NOW)).toBe('Fri');
  });

  it('shows "DD Mon" for same year, > 7 days', () => {
    const d = new Date(2026, 0, 3, 12, 0); // 3 Jan 2026
    expect(formatTimestamp(d, NOW)).toBe('03 Jan');
  });

  it('shows "DD Mon YYYY" for a different year', () => {
    const d = new Date(2025, 11, 25, 8, 0); // 25 Dec 2025
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
    const d = new Date(2026, 2, 5, 10, 0); // 5 Mar
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
      id: 1,
      title: 'Old',
      lastMessageText: 'old msg',
      lastMessageDate: new Date(2026, 0, 1),
      unreadCount: 0,
      isChannel: false,
      isGroup: false,
    },
    {
      id: 2,
      title: 'New',
      lastMessageText: 'new msg',
      lastMessageDate: new Date(2026, 6, 14),
      unreadCount: 3,
      isChannel: false,
      isGroup: true,
    },
    {
      id: 3,
      title: 'Mid',
      lastMessageText: 'mid msg',
      lastMessageDate: new Date(2026, 3, 1),
      unreadCount: 0,
      isChannel: true,
      isGroup: false,
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
      id: 1,
      title: 'Dev Team',
      lastMessageText: '',
      lastMessageDate: new Date(),
      unreadCount: 5,
      isChannel: false,
      isGroup: true,
    };
    const result = formatChatTitle(chat, 30);
    expect(result).toContain('👥');
    expect(result).toContain('(5)');
    expect(result).toContain('Dev Team');
  });

  it('shows channel prefix', () => {
    const chat: DisplayChat = {
      id: 2,
      title: 'News',
      lastMessageText: '',
      lastMessageDate: new Date(),
      unreadCount: 0,
      isChannel: true,
      isGroup: false,
    };
    expect(formatChatTitle(chat, 30)).toContain('📢');
  });

  it('truncates long titles', () => {
    const chat: DisplayChat = {
      id: 3,
      title: 'A Very Long Chat Title That Goes On Forever',
      lastMessageText: '',
      lastMessageDate: new Date(),
      unreadCount: 0,
      isChannel: false,
      isGroup: false,
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
      id: 1,
      title: 'Test',
      lastMessageText: 'line one\nline two\nline three',
      lastMessageDate: new Date(),
      unreadCount: 0,
      isChannel: false,
      isGroup: false,
    };
    const result = formatChatPreview(chat, 20);
    expect(result).not.toContain('\n');
    expect(Array.from(result).length).toBeLessThanOrEqual(20);
  });
});
