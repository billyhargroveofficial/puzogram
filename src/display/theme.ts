/**
 * theme — design tokens for the TUI (Catppuccin Mocha palette).
 *
 * Ink renders on top of chalk, which auto-detects the terminal color profile
 * (truecolor → 256 → 16) and downsamples hex values, so these hex colors are
 * safe to use directly. The tokens are semantic (text/accent/border/…), not
 * ad-hoc colors — that's what keeps the UI from looking like a "каша".
 */

export const theme = {
  /** Primary text (message bodies). */
  text: '#cdd6f4',
  /** Secondary text (previews, sender in own-pane). */
  textDim: '#a6adc8',
  /** Tertiary text (timestamps, separators, hints). */
  textFaint: '#7f849c',
  /** Ghost text (placeholders). */
  textGhost: '#585b70',

  /** Primary accent — focus border, selection, active tab. */
  accent: '#89b4fa',
  /** Secondary accent — own messages, unread counters, mentions. */
  accent2: '#cba6f7',

  /** Semantic statuses. */
  success: '#a6e3a1',
  warning: '#f9e2af',
  error: '#f38ba8',

  /** Borders. */
  border: '#45475a',
  borderFocus: '#89b4fa',

  /** Backgrounds (used sparingly, e.g. selected row / status nuggets). */
  bgPanel: '#313244',
  bgMantle: '#181825',
  /** Text drawn on top of a bright accent background. */
  onAccent: '#1e1e2e',
} as const;

export type Theme = typeof theme;

/**
 * Sender-name palette (Catppuccin accent hues). A message sender's color is
 * chosen deterministically by `senderColor(senderId)` so each participant in a
 * group has a stable, distinguishable color — same idea as Telegram Desktop.
 */
const SENDER_PALETTE = [
  '#89b4fa', // blue
  '#a6e3a1', // green
  '#f9e2af', // yellow
  '#fab387', // peach
  '#f38ba8', // red
  '#cba6f7', // mauve
  '#94e2d5', // teal
  '#eba0ac', // maroon
] as const;

/** Deterministic per-sender color from the palette (stable across renders). */
export function senderColor(id: number): string {
  return SENDER_PALETTE[Math.abs(id) % SENDER_PALETTE.length];
}

/**
 * Chat-avatar background palette (slightly muted surface tones so the initials
 * stay readable). Chosen deterministically by chat id.
 */
const AVATAR_BG = [
  '#89b4fa',
  '#a6e3a1',
  '#f9e2af',
  '#fab387',
  '#f38ba8',
  '#cba6f7',
  '#94e2d5',
  '#eba0ac',
] as const;

/** Deterministic avatar background color by chat id. */
export function avatarBg(id: number): string {
  return AVATAR_BG[Math.abs(id) % AVATAR_BG.length];
}
