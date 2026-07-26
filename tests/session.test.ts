import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readSessionString,
  writeSessionString,
  sessionFilePath,
  resolveSessionDir,
} from '../src/core/session.js';

let tmp: string | undefined;

function makeTmp(): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'billytelega-session-test-'));
  // Use a *sub*dir so resolveSessionDir/mkdir actually create something.
  const dir = path.join(tmp, 'data');
  return dir;
}

afterEach(() => {
  if (tmp) {
    fs.rmSync(tmp, { recursive: true, force: true });
    tmp = undefined;
  }
});

describe('session persistence', () => {
  it('returns undefined when no session file exists', () => {
    const dir = makeTmp();
    expect(readSessionString(dir)).toBeUndefined();
  });

  it('round-trips a session string', () => {
    const dir = makeTmp();
    const session = '1BVtsOHIBu7n4k...fakeSessionString==';
    writeSessionString(session, dir);
    expect(readSessionString(dir)).toBe(session);
  });

  it('trims whitespace on read', () => {
    const dir = makeTmp();
    writeSessionString('  abc123  \n', dir);
    expect(readSessionString(dir)).toBe('abc123');
  });

  it('does not write empty / whitespace-only strings', () => {
    const dir = makeTmp();
    writeSessionString('   ', dir);
    expect(fs.existsSync(sessionFilePath(dir))).toBe(false);
    expect(readSessionString(dir)).toBeUndefined();
  });

  it('writes the file with mode 0600', () => {
    const dir = makeTmp();
    writeSessionString('secret', dir);
    const mode = fs.statSync(sessionFilePath(dir)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('creates the directory with mode 0700', () => {
    const dir = makeTmp();
    writeSessionString('secret', dir);
    const mode = fs.statSync(dir).mode & 0o777;
    expect(mode).toBe(0o700);
  });

  it('overwrites an existing session', () => {
    const dir = makeTmp();
    writeSessionString('first', dir);
    writeSessionString('second', dir);
    expect(readSessionString(dir)).toBe('second');
  });

  it('resolveSessionDir honours an explicit baseDir', () => {
    expect(resolveSessionDir('/tmp/xyz')).toBe('/tmp/xyz');
  });
});
