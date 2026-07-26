/**
 * Session persistence — save / load the GramJS StringSession to disk so the
 * user only logs in once.
 *
 * The session string contains the authorisation key, so the file is written
 * with restrictive permissions (dir 0700, file 0600). Location follows the
 * XDG base-dir spec: `$XDG_DATA_HOME/billytelega/session`, falling back to
 * `~/.local/share/billytelega/session`.
 *
 * Every function takes an optional `baseDir` so tests can target an isolated
 * temporary directory instead of the real user data dir.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const APP_DIR = 'billytelega';
const SESSION_FILE = 'session';

/** Resolve the directory that holds the session file. */
export function resolveSessionDir(baseDir?: string): string {
  if (baseDir) return baseDir;
  const xdg = process.env.XDG_DATA_HOME?.trim();
  const root = xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), '.local', 'share');
  return path.join(root, APP_DIR);
}

/** Full path to the session file. */
export function sessionFilePath(baseDir?: string): string {
  return path.join(resolveSessionDir(baseDir), SESSION_FILE);
}

/**
 * Read the saved session string, or `undefined` when there is none (missing
 * file, empty file, or read error). Whitespace is trimmed.
 */
export function readSessionString(baseDir?: string): string | undefined {
  try {
    const raw = fs.readFileSync(sessionFilePath(baseDir), 'utf8').trim();
    return raw.length > 0 ? raw : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Persist a session string to disk, creating the directory with mode 0700 and
 * the file with mode 0600. No-op for empty strings. Throws on write failure so
 * the caller can decide how to react (we swallow it at the call site).
 */
export function writeSessionString(session: string, baseDir?: string): void {
  const trimmed = session.trim();
  if (trimmed.length === 0) return;

  const dir = resolveSessionDir(baseDir);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // mkdir mode is masked by umask and ignored if the dir already exists, so
  // enforce it explicitly.
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    /* best effort */
  }

  const file = sessionFilePath(baseDir);
  fs.writeFileSync(file, trimmed, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* best effort */
  }
}
