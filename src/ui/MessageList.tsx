/**
 * MessageList — chat feed rendered as message *bubbles*.
 *
 * Design (from research of tele/tg/nchat and Telegram Desktop): own messages
 * are right-aligned with an accent border, others are left-aligned with a
 * sender-colored name inside the bubble's top border; the timestamp lives in
 * the bottom border instead of the text stream (this is what removes the
 * "log-dump" look). Consecutive messages from the same sender group together
 * with a single name and no blank line; groups are separated by one blank
 * line. Bubbles are drawn as text characters so the whole feed stays a flat
 * array of terminal lines — which keeps the line-based scroll viewport exact.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput, type DOMElement } from 'ink';
import { useOnPress, useOnWheel } from '@ink-tools/ink-mouse';
import { theme, senderColor } from '../display/theme.js';
import {
  formatChatTimestamp,
  wrapText,
  displayWidth,
  padEndWidth,
  type DisplayMessage,
} from '../display/format.js';

interface MessageListProps {
  messages: DisplayMessage[];
  chatTitle: string;
  chatType?: string;
  width: number;
  height: number;
  loading: boolean;
  focused: boolean;
  /** Fired when the pane itself is pressed (click-to-focus). */
  onFocusPane?: () => void;
}

/** Two messages group (collapse the sender name, no blank line) when same
 *  sender, same direction, and within 5 minutes of each other. */
function isGrouped(prev: DisplayMessage, curr: DisplayMessage): boolean {
  if (prev.senderId !== curr.senderId) return false;
  if (prev.isOutgoing !== curr.isOutgoing) return false;
  return Math.abs(curr.date.getTime() - prev.date.getTime()) < 5 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Flat line model (each line is a list of styled segments)
// ---------------------------------------------------------------------------

interface Seg {
  text: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  dimColor?: boolean;
}

interface Line {
  segments: Seg[];
}

const BLANK: Line = { segments: [] };

/** Build the top border of a bubble, optionally with the sender's name in it. */
function topBorder(
  pad: string,
  width: number,
  borderColor: string,
  name: string | null,
  nameColor: string | undefined,
): Line {
  const segs: Seg[] = [];
  if (pad) segs.push({ text: pad });
  if (name) {
    const fill = Math.max(width - displayWidth(name) - 5, 0);
    segs.push({ text: '╭─ ', color: borderColor });
    segs.push({ text: name, color: nameColor, bold: true });
    segs.push({ text: ' ' + '─'.repeat(fill) + '╮', color: borderColor });
  } else {
    segs.push({ text: '╭' + '─'.repeat(Math.max(width - 2, 1)) + '╮', color: borderColor });
  }
  return { segments: segs };
}

/** Build the bottom border of a bubble with the timestamp (+ tick for own). */
function bottomBorder(
  pad: string,
  width: number,
  borderColor: string,
  time: string,
  isOut: boolean,
): Line {
  const segs: Seg[] = [];
  if (pad) segs.push({ text: pad });
  const tick = isOut ? ' ✓' : '';
  const fill = Math.max(width - displayWidth(time) - displayWidth(tick) - 5, 0);
  segs.push({ text: '╰─ ', color: borderColor });
  segs.push({ text: time, color: theme.textFaint });
  if (isOut) segs.push({ text: tick, color: theme.success });
  segs.push({ text: ' ' + '─'.repeat(fill) + '╯', color: borderColor });
  return { segments: segs };
}

/** Flatten all messages into bubble lines. */
function buildLines(
  messages: DisplayMessage[],
  feedWidth: number,
  chatType: string | undefined,
  now: Date,
): Line[] {
  const lines: Line[] = [];
  const maxBubble = Math.max(Math.floor(feedWidth * 0.72), 16);
  const innerWidth = maxBubble - 4; // 2 border cols + 2 padding cols
  const isGroupChat = chatType === 'group' || chatType === 'channel';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const prev = i > 0 ? messages[i - 1]! : null;
    const next = i < messages.length - 1 ? messages[i + 1]! : null;
    const grouped = prev !== null && isGrouped(prev, msg);
    const isOut = msg.isOutgoing;
    const borderColor = isOut ? theme.accent2 : theme.border;
    const time = formatChatTimestamp(msg.date, now);

    // Wrap the text, then size the bubble to the widest content line.
    const contentLines = wrapText(msg.text, innerWidth);
    let contentWidth = 1;
    for (const l of contentLines) contentWidth = Math.max(contentWidth, displayWidth(l));
    contentWidth = Math.min(contentWidth, innerWidth);

    // The bubble must also be wide enough for its meta line (timestamp+tick)
    // and, for group heads, the sender name — otherwise those borders would
    // stick out past the content box.
    const showName = isGroupChat && !isOut && !grouped;
    const tickW = isOut ? displayWidth(' ✓') : 0;
    const metaMin = displayWidth(time) + tickW + 5;
    const nameMin = showName ? displayWidth(msg.senderName) + 5 : 0;
    const bubbleWidth = Math.max(contentWidth + 4, metaMin, nameMin);
    contentWidth = bubbleWidth - 4;
    const padLeft = isOut ? Math.max(0, feedWidth - bubbleWidth) : 0;
    const pad = ' '.repeat(padLeft);

    // Top border (with sender name for group messages from others, group head only)
    lines.push(
      topBorder(pad, bubbleWidth, borderColor, showName ? msg.senderName : null, senderColor(msg.senderId)),
    );

    // Content lines
    for (const cl of contentLines) {
      lines.push({
        segments: [
          { text: pad },
          { text: '│ ', color: borderColor },
          { text: padEndWidth(cl, contentWidth), color: theme.text },
          { text: ' │', color: borderColor },
        ],
      });
    }

    // Bottom border with the timestamp
    lines.push(bottomBorder(pad, bubbleWidth, borderColor, time, isOut));

    // One blank line between groups (never inside a group)
    if (next && !isGrouped(msg, next)) lines.push(BLANK);
  }
  return lines;
}

function LineView({ line }: { line: Line }): React.ReactElement {
  if (line.segments.length === 0) return <Text> </Text>;
  return (
    <Box>
      {line.segments.map((s, i) => (
        <Text key={i} color={s.color} backgroundColor={s.backgroundColor} bold={s.bold} dimColor={s.dimColor}>
          {s.text}
        </Text>
      ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Header + separator + round border consume this many rows. */
const CHROME = 4;

export function MessageList({
  messages,
  chatTitle,
  chatType,
  width,
  height,
  loading,
  focused,
  onFocusPane,
}: MessageListProps) {
  const now = new Date();
  const borderColor = focused ? theme.borderFocus : theme.border;
  const viewportLines = Math.max(height - CHROME, 3);
  const feedWidth = Math.max(width - 4, 20);

  const lines = buildLines(messages, feedWidth, chatType, now);
  const maxTop = Math.max(0, lines.length - viewportLines);

  const [top, setTop] = useState(maxTop);
  const containerRef = useRef<DOMElement>(null);
  const linesLenRef = useRef(0);

  // Auto-follow: stay pinned to the newest lines while at the bottom; keep the
  // user's position when scrolled up into history.
  useEffect(() => {
    const newMax = Math.max(0, lines.length - viewportLines);
    const prevMax = Math.max(0, linesLenRef.current - viewportLines);
    setTop((prev) => {
      const wasAtBottom = prev >= prevMax;
      return wasAtBottom ? newMax : Math.min(prev, newMax);
    });
    linesLenRef.current = lines.length;
  }, [messages, viewportLines, lines.length]);

  const clampTop = (n: number): number => Math.min(Math.max(n, 0), maxTop);

  useInput(
    (input, key) => {
      if (key.pageUp) setTop((t) => clampTop(t - viewportLines));
      else if (key.pageDown) setTop((t) => clampTop(t + viewportLines));
      else if (key.home) setTop(0);
      else if (key.end) setTop(maxTop);
      else if (key.upArrow || input === 'k') setTop((t) => clampTop(t - 1));
      else if (key.downArrow || input === 'j') setTop((t) => clampTop(t + 1));
    },
    { isActive: focused },
  );

  useOnWheel(containerRef, (e) => {
    if (e.button === 'wheel-up') setTop((t) => clampTop(t - 3));
    else if (e.button === 'wheel-down') setTop((t) => clampTop(t + 3));
  });

  // Clicking anywhere in the feed focuses the messages pane.
  useOnPress(containerRef, () => onFocusPane?.());

  const showOlder = top > 0;
  const showNewer = top < maxTop;

  const visible = lines.slice(top, top + viewportLines);
  const rendered: React.ReactElement[] = visible.map((line, i) => (
    <LineView key={`${top}-${i}`} line={line} />
  ));
  if (showOlder && rendered.length > 0) {
    rendered[0] = (
      <Text key="older" color={theme.warning} dimColor>
        ↑ {top} older (wheel / k / PgUp)
      </Text>
    );
  }
  if (showNewer && rendered.length > 0) {
    const newer = lines.length - (top + viewportLines);
    rendered[rendered.length - 1] = (
      <Text key="newer" color={theme.warning} dimColor>
        ↓ {newer} newer (wheel / j / PgDn)
      </Text>
    );
  }

  return (
    <Box
      ref={containerRef}
      flexDirection="column"
      flexGrow={1}
      height={height}
      overflow="hidden"
      borderStyle="round"
      borderColor={borderColor}
    >
      {/* ── Header ── */}
      <Box paddingX={1} flexShrink={0}>
        <Text bold color={focused ? theme.accent : theme.text}>
          {chatTitle || 'Select a chat'}
        </Text>
        {chatType && (
          <Text color={theme.textFaint} dimColor>
            {' '}
            {chatType}
          </Text>
        )}
        <Box flexGrow={1} />
        {loading && <Text color={theme.warning}>⏳</Text>}
      </Box>

      {/* ── Separator ── */}
      <Box paddingX={1} flexShrink={0}>
        <Text color={theme.border}>{'─'.repeat(Math.max(width - 4, 10))}</Text>
      </Box>

      {/* ── Body: bottom-anchored, fixed height, never overflows ── */}
      <Box
        flexDirection="column"
        justifyContent="flex-end"
        paddingX={1}
        height={viewportLines}
        overflow="hidden"
      >
        {messages.length === 0 && !loading ? (
          <Text color={theme.textGhost} dimColor>
            No messages yet — say hello 👋
          </Text>
        ) : (
          rendered
        )}
      </Box>
    </Box>
  );
}
