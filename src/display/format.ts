/**
 * Pure display-logic functions for the Telegram TUI.
 * Zero side effects, zero I/O — the primary unit-test targets.
 */

// ---------------------------------------------------------------------------
// Types (shared with the rest of the app)
// ---------------------------------------------------------------------------

export interface DisplayMessage {
  id: number;
  senderName: string;
  text: string;
  date: Date;
  isOutgoing: boolean;
}

export interface DisplayChat {
  id: number;
  title: string;
  lastMessageText: string;
  lastMessageDate: Date;
  unreadCount: number;
  isChannel: boolean;
  isGroup: boolean;
}

// ---------------------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Format a message timestamp:
 *  - today → "HH:MM"
 *  - yesterday → "Yesterday"
 *  - within the last 7 days → "Mon", "Tue", …
 *  - same year → "DD Mon" (e.g. "14 Jul")
 *  - older → "DD Mon YYYY" (e.g. "03 Jan 2025")
 */
export function formatTimestamp(date: Date, now: Date = new Date()): string {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === todayStart.getTime()) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  if (msgDay.getTime() === yesterdayStart.getTime()) {
    return 'Yesterday';
  }

  const diffDays = (todayStart.getTime() - msgDay.getTime()) / DAY_MS;
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = MONTHS[date.getMonth()];
  const sameYear = date.getFullYear() === now.getFullYear();
  if (sameYear) {
    return `${pad2(date.getDate())} ${mon}`;
  }
  return `${pad2(date.getDate())} ${mon} ${date.getFullYear()}`;
}

/**
 * Format a chat-list timestamp (more compact):
 *  - today → "HH:MM"
 *  - yesterday → "Yest"
 *  - same year → "DD/MM"
 *  - older → "DD/MM/YY"
 */
export function formatChatTimestamp(date: Date, now: Date = new Date()): string {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === todayStart.getTime()) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  if (msgDay.getTime() === yesterdayStart.getTime()) {
    return 'Yest';
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
  }
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${String(date.getFullYear()).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Text truncation / wrapping
// ---------------------------------------------------------------------------

/**
 * Truncate a string to `maxLen` visible characters, appending '…' if cut.
 * Handles multi-byte characters correctly via Array.from.
 */
export function truncateText(text: string, maxLen: number): string {
  if (maxLen < 1) return '';
  const chars = Array.from(text);
  if (chars.length <= maxLen) return text;
  if (maxLen === 1) return '…';
  return chars.slice(0, maxLen - 1).join('') + '…';
}

/**
 * Word-wrap text to a given column width.
 * Returns an array of lines. Long words are hard-broken.
 */
export function wrapText(text: string, width: number): string[] {
  if (width < 1) return [text];
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      result.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (word === '') continue;
      if (line === '') {
        // First word on the line — may need hard-breaking
        let remaining = word;
        while (Array.from(remaining).length > width) {
          const chars = Array.from(remaining);
          result.push(chars.slice(0, width).join(''));
          remaining = chars.slice(width).join('');
        }
        line = remaining;
      } else if (Array.from(line).length + 1 + Array.from(word).length <= width) {
        line += ' ' + word;
      } else {
        result.push(line);
        // Hard-break the word if it's wider than the column
        let remaining = word;
        while (Array.from(remaining).length > width) {
          const chars = Array.from(remaining);
          result.push(chars.slice(0, width).join(''));
          remaining = chars.slice(width).join('');
        }
        line = remaining;
      }
    }
    result.push(line);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Message formatting
// ---------------------------------------------------------------------------

/**
 * Format a single message for display in the message list.
 * Returns an object with the sender label, timestamp string, and wrapped body lines.
 */
export function formatMessage(
  msg: DisplayMessage,
  width: number,
  now: Date = new Date(),
): { senderLine: string; bodyLines: string[] } {
  const time = formatTimestamp(msg.date, now);
  const arrow = msg.isOutgoing ? '→' : '←';
  const senderLine = `${arrow} ${msg.senderName}  ${time}`;
  const bodyLines = wrapText(msg.text, Math.max(width, 10));
  return { senderLine, bodyLines };
}

// ---------------------------------------------------------------------------
// Chat-list helpers
// ---------------------------------------------------------------------------

/**
 * Sort chats by last-message date, most recent first.
 * Returns a new array (does not mutate the input).
 */
export function sortChats(chats: DisplayChat[]): DisplayChat[] {
  return [...chats].sort(
    (a, b) => b.lastMessageDate.getTime() - a.lastMessageDate.getTime(),
  );
}

/**
 * Format a chat-list entry title line:
 *  "[unread] title" truncated to width, with a type prefix.
 */
export function formatChatTitle(chat: DisplayChat, width: number): string {
  const prefix = chat.isChannel ? '📢 ' : chat.isGroup ? '👥 ' : '👤 ';
  const unread = chat.unreadCount > 0 ? `(${chat.unreadCount}) ` : '';
  const full = `${prefix}${unread}${chat.title}`;
  return truncateText(full, width);
}

/**
 * Format the last-message preview line for the chat list.
 */
export function formatChatPreview(chat: DisplayChat, width: number): string {
  return truncateText(chat.lastMessageText.replace(/\n/g, ' '), width);
}
