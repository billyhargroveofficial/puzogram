/**
 * Pure display-logic functions for the Telegram TUI.
 * Zero side effects, zero I/O — the primary unit-test targets.
 */

// ---------------------------------------------------------------------------
// Types (shared with the rest of the app)
// ---------------------------------------------------------------------------

export interface DisplayMessage {
  id: number;
  /** Numeric sender id (drives the per-sender color). 0 when unknown. */
  senderId: number;
  senderName: string;
  text: string;
  date: Date;
  isOutgoing: boolean;
}

export interface DisplayChat {
  /** GramJS marked peer id: user, -chat, or -100channel. */
  id: number;
  title: string;
  lastMessageText: string;
  lastMessageDate: Date;
  unreadCount: number;
  isChannel: boolean;
  isGroup: boolean;
  isBot?: boolean;
  isContact?: boolean;
  /** True when the dialog lives in Telegram's archive (folder_id = 1). */
  isArchived?: boolean;
}

export interface DisplayFolder {
  id: number;
  title: string;
  emoji?: string;
  pinnedChatIds: number[];
  includeChatIds: number[];
  excludeChatIds: number[];
  contacts: boolean;
  nonContacts: boolean;
  groups: boolean;
  broadcasts: boolean;
  bots: boolean;
}

// ---------------------------------------------------------------------------
// Safe text coercion
// ---------------------------------------------------------------------------

/**
 * Coerce an arbitrary value coming from the Telegram API into a plain string.
 *
 * GramJS sometimes hands back TLObjects where we expect a string — e.g. a
 * `TextWithEntities` (`{ text, entities }`) for a folder title, or a `Message`
 * (`{ message, … }`). Rendering such an object as a React child crashes Ink
 * with "Objects are not valid as a React child". This helper extracts the
 * human-readable text from the common shapes and falls back to '' so nothing
 * non-string ever reaches the UI layer.
 */
export function toText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const v = value as { text?: unknown; message?: unknown; title?: unknown };
    if (typeof v.text === 'string') return v.text; // TextWithEntities
    if (typeof v.message === 'string') return v.message; // Message
    if (typeof v.title === 'string') return v.title; // entity / folder
  }
  return '';
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
  const s = toText(text);
  const chars = Array.from(s);
  if (chars.length <= maxLen) return s;
  if (maxLen === 1) return '…';
  return chars.slice(0, maxLen - 1).join('') + '…';
}

// ---------------------------------------------------------------------------
// Display-width measurement (for aligning columns & bubbles)
// ---------------------------------------------------------------------------

const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\u200E\u200F\u202A-\u202E\u2060-\u2064\uFE00-\uFE0F\uFEFF]/;
const COMBINING_RE = /\p{Mark}/u;
const WIDE_RE =
  /[\p{Extended_Pictographic}\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/u;

/** Terminal cell width of a single character (0/1/2). */
export function charWidth(ch: string): number {
  if (ZERO_WIDTH_RE.test(ch) || COMBINING_RE.test(ch)) return 0;
  return WIDE_RE.test(ch) ? 2 : 1;
}

/** Terminal cell width of a whole string (emoji/CJK = 2, combining/ZWJ = 0). */
export function displayWidth(str: string): number {
  let w = 0;
  for (const ch of str) w += charWidth(ch);
  return w;
}

/** Right-pad a string with spaces to a target display width. */
export function padEndWidth(str: string, target: number, fill = ' '): string {
  const w = displayWidth(str);
  return w >= target ? str : str + fill.repeat(target - w);
}

/** Truncate a string to a max display width, appending '…' if cut. */
export function truncateToWidth(str: string, maxWidth: number): string {
  if (maxWidth < 1) return '';
  const s = toText(str);
  if (displayWidth(s) <= maxWidth) return s;
  let w = 0;
  let out = '';
  for (const ch of s) {
    const cw = charWidth(ch);
    if (w + cw > maxWidth - 1) break;
    out += ch;
    w += cw;
  }
  return out + '…';
}

/** Compact unread counter for the chat list: 0 → '', 1..99 → 'N', else '99+'. */
export function capCount(n: number): string {
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}

/**
 * Word-wrap text to a given column width.
 * Returns an array of lines. Long words are hard-broken.
 */
export function wrapText(text: string, width: number): string[] {
  const s = toText(text);
  if (width < 1) return [s];
  const result: string[] = [];
  for (const paragraph of s.split('\n')) {
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
  return truncateText(toText(chat.lastMessageText).replace(/\n/g, ' '), width);
}

// ---------------------------------------------------------------------------
// Avatar initials
// ---------------------------------------------------------------------------

/**
 * Extract 1-2 character initials from a chat title for a text avatar.
 * Examples: "Alice" → "A", "Dev Team" → "DT", " News" → "N"
 */
export function getInitials(title: string): string {
  const t = toText(title);
  // Strip emoji and special chars
  const cleaned = t.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
  if (!cleaned) return '?';
  // Only words that contain at least one letter (skips "(ml,"-style tokens).
  const words = cleaned.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  let out = '';
  if (words.length === 0) {
    out = '?';
  } else if (words.length === 1) {
    const letters = words[0]!.match(/\p{L}/gu) ?? [];
    out = (letters[0] ?? '?') + (letters[1] ?? '');
  } else {
    out = (words[0]!.match(/\p{L}/u)?.[0] ?? '') + (words[1]!.match(/\p{L}/u)?.[0] ?? '');
  }
  return out.toUpperCase() || '?';
}

/**
 * Deterministic color for an avatar based on the chat id.
 */
const AVATAR_COLORS = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const;
export function avatarColor(id: number): (typeof AVATAR_COLORS)[number] {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

/** A single emoji glyph representing the chat type, used as the avatar. */
export function avatarGlyph(chat: DisplayChat): string {
  if (chat.isBot) return '🤖';
  if (chat.isChannel) return '📢';
  if (chat.isGroup) return '👥';
  return '👤';
}

// ---------------------------------------------------------------------------
// Folder filtering
// ---------------------------------------------------------------------------

/** Synthetic folder id for the built-in Archive view (never a server id). */
export const ARCHIVE_FOLDER_ID = -1;

function archiveFolder(): DisplayFolder {
  return {
    id: ARCHIVE_FOLDER_ID,
    title: 'Archive',
    pinnedChatIds: [],
    includeChatIds: [],
    excludeChatIds: [],
    contacts: false,
    nonContacts: false,
    groups: false,
    broadcasts: false,
    bots: false,
  };
}

/**
 * Insert the synthetic "Archive" tab right after "All" when the chat list
 * contains archived dialogs, mirroring the official apps. Idempotent and
 * removes the tab again when nothing is archived.
 */
export function withArchiveFolder(folders: DisplayFolder[], chats: DisplayChat[]): DisplayFolder[] {
  const rest = folders.filter((f) => f.id !== ARCHIVE_FOLDER_ID);
  if (!chats.some((c) => c.isArchived)) return rest;
  const archive = archiveFolder();
  if (rest.length === 0) return [archive];
  return [rest[0]!, archive, ...rest.slice(1)];
}

/**
 * Filter chats by a folder definition.
 * Folder id=0 means "All" — return everything except archived dialogs.
 * Archived dialogs only appear inside the Archive folder, like in the
 * official clients.
 */
export function filterChatsByFolder(chats: DisplayChat[], folder: DisplayFolder): DisplayChat[] {
  if (folder.id === ARCHIVE_FOLDER_ID) return chats.filter((c) => c.isArchived);

  const visible = chats.filter((c) => !c.isArchived);
  if (folder.id === 0) return visible;

  const includeSet = new Set([...folder.pinnedChatIds, ...folder.includeChatIds]);
  const excludeSet = new Set(folder.excludeChatIds);

  return visible.filter((chat) => {
    if (excludeSet.has(chat.id)) return false;
    if (includeSet.has(chat.id)) return true;

    // Telegram's contacts/non-contacts flags describe private user dialogs;
    // groups and channels have independent flags even though they are also
    // technically "not contacts".
    const isPrivateUser = !chat.isGroup && !chat.isChannel && !chat.isBot;
    if (folder.contacts && isPrivateUser && chat.isContact) return true;
    if (folder.nonContacts && isPrivateUser && !chat.isContact) return true;
    if (folder.groups && chat.isGroup) return true;
    if (folder.broadcasts && chat.isChannel) return true;
    if (folder.bots && chat.isBot) return true;

    return false;
  });
}

/**
 * Compute total unread count for a folder.
 */
export function folderUnreadCount(chats: DisplayChat[], folder: DisplayFolder): number {
  return filterChatsByFolder(chats, folder).reduce((sum, c) => sum + c.unreadCount, 0);
}
