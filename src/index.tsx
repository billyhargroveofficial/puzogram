#!/usr/bin/env node
/**
 * billytelega — terminal Telegram client.
 * Entry point: wires GramJS core → zustand store → React Ink UI.
 *
 * The auth screen renders immediately; the GramJS connection is established
 * lazily when the user submits their phone number. This lets the UI appear
 * instantly and keeps the PTY-launch check independent of network access.
 */
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { appStore } from './store/app.js';
import { TelegramCore, loadConfig, type TelegramConfig } from './core/telegram.js';
import { writeSessionString } from './core/session.js';
import { sortChats } from './display/format.js';

async function main() {
  // ---- Load config (throws if env vars missing) ----
  let config: TelegramConfig;
  try {
    config = loadConfig();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const store = appStore;

  // Persist the authorisation key after a successful login so the next launch
  // reuses it (read back via loadConfig → readSessionString).
  function persistSession(c: TelegramCore): void {
    try {
      writeSessionString(c.getSessionString());
    } catch {
      /* non-fatal: we just won't auto-login next time */
    }
  }

  // Lazy core — created on first auth attempt so the UI renders immediately.
  let core: TelegramCore | null = null as TelegramCore | null;

  async function ensureCore(): Promise<TelegramCore> {
    if (!core) {
      core = new TelegramCore(config);
      store.getState().setStatusMessage('Connecting to Telegram…');
      await core.connect();
      store.getState().setStatusMessage(null);

      // If we already have a saved session, skip auth
      if (await core.isAuthorized()) {
        persistSession(core); // mirror env/session into the on-disk file
        store.getState().setAuthPhase('ready');
        await loadChats();
      }
    }
    return core;
  }

  // ---- Auth handlers ----
  async function handleSendCode(phone: string) {
    store.getState().setAuthError(null);
    try {
      const c = await ensureCore();
      store.getState().setStatusMessage('Sending code…');
      const hash = await c.sendCode(phone);
      store.getState().setPhoneCodeHash(hash);
      store.getState().setPhoneNumber(phone);
      store.getState().setAuthPhase('code');
    } catch (err) {
      store.getState().setAuthError((err as Error).message);
    } finally {
      store.getState().setStatusMessage(null);
    }
  }

  async function handleSignIn(code: string) {
    store.getState().setAuthError(null);
    store.getState().setStatusMessage('Signing in…');
    try {
      const c = await ensureCore();
      const { phoneNumber, phoneCodeHash } = store.getState();
      await c.signIn(phoneNumber!, phoneCodeHash!, code);
      persistSession(c);
      store.getState().setAuthPhase('ready');
      await loadChats();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('SESSION_PASSWORD_NEEDED') || msg.includes('password')) {
        store.getState().setAuthPhase('password');
      } else {
        store.getState().setAuthError(msg);
      }
    } finally {
      store.getState().setStatusMessage(null);
    }
  }

  async function handlePassword(password: string) {
    store.getState().setAuthError(null);
    store.getState().setStatusMessage('Verifying 2FA…');
    try {
      const c = await ensureCore();
      await c.signInWithPassword(password);
      persistSession(c);
      store.getState().setAuthPhase('ready');
      await loadChats();
    } catch (err) {
      store.getState().setAuthError((err as Error).message);
    } finally {
      store.getState().setStatusMessage(null);
    }
  }

  // ---- Data loading ----
  async function loadChats() {
    if (!core) return;
    store.getState().setChatsLoading(true);
    try {
      const [chats, folders] = await Promise.all([
        core.getDialogs(100),
        core.getDialogFilters(),
      ]);
      store.getState().setChats(sortChats(chats));
      store.getState().setFolders(folders);
    } catch (err) {
      store.getState().setStatusMessage(`Failed to load chats: ${(err as Error).message}`);
    } finally {
      store.getState().setChatsLoading(false);
    }
  }

  async function loadMessages(chatIndex: number) {
    if (!core) return;
    const chats = store.getState().chats;
    const chat = chats[chatIndex];
    if (!chat) return;
    store.getState().setMessagesLoading(true);
    try {
      const messages = await core.getMessages(chat.id, 50);
      store.getState().setMessages(messages);
    } catch (err) {
      store.getState().setStatusMessage(`Failed to load messages: ${(err as Error).message}`);
    } finally {
      store.getState().setMessagesLoading(false);
    }
  }

  async function handleSendMessage(text: string) {
    if (!core) return;
    const { chats, selectedChatIndex } = store.getState();
    const chat = chats[selectedChatIndex];
    if (!chat) return;
    store.getState().setStatusMessage('Sending…');
    try {
      await core.sendMessage(chat.id, text);
      await loadMessages(selectedChatIndex);
    } catch (err) {
      store.getState().setStatusMessage(`Send failed: ${(err as Error).message}`);
    } finally {
      store.getState().setStatusMessage(null);
    }
  }

  // ---- Render immediately (auth screen shows while disconnected) ----
  // alternateScreen gives a clean full-screen canvas whose top-left is
  // (0,0), so mouse coordinates line up with measureElement() layout
  // coordinates for hit-testing.
  const { waitUntilExit } = render(
    <App
      onSendCode={handleSendCode}
      onSignIn={handleSignIn}
      onPassword={handlePassword}
      onSelectChat={(index) => {
        void loadMessages(index);
      }}
      onSendMessage={(text) => {
        void handleSendMessage(text);
      }}
    />,
    { alternateScreen: true },
  );

  await waitUntilExit();
  if (core) await core.disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
