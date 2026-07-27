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
import { MouseProvider } from '@ink-tools/ink-mouse';
import { App } from './ui/App.js';
import { appStore } from './store/app.js';
import { TelegramCore, loadConfig, type TelegramConfig } from './core/telegram.js';
import { writeSessionString } from './core/session.js';
import { sortChats, withArchiveFolder } from './display/format.js';

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

  // Lazy core — created on first use so the UI renders immediately. A shared
  // promise makes concurrent callers (startup auto-login racing a manual auth
  // submit) wait on the same connection instead of creating two clients.
  let core: TelegramCore | null = null as TelegramCore | null;
  let connectPromise: Promise<TelegramCore> | null = null as Promise<TelegramCore> | null;

  function ensureCore(): Promise<TelegramCore> {
    if (!connectPromise) {
      connectPromise = (async () => {
        const c = new TelegramCore(config);
        core = c;
        store.getState().setStatusMessage('Connecting to Telegram…');
        try {
          await c.connect();
        } catch (err) {
          // Reset so a later call (e.g. manual login) can retry the connection
          // instead of awaiting a permanently-rejected cached promise.
          connectPromise = null;
          core = null;
          throw err;
        }
        store.getState().setStatusMessage(null);

        // If we already have a saved session, skip the auth screen entirely.
        if (await c.isAuthorized()) {
          persistSession(c); // mirror env/session into the on-disk file
          store.getState().setAuthPhase('ready');
          await loadChats();
        }
        return c;
      })();
    }
    return connectPromise;
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
      const sorted = sortChats(chats);
      store.getState().setChats(sorted);
      // The Archive tab only exists while there is something archived.
      store.getState().setFolders(withArchiveFolder(folders, chats));
      // Auto-open the first chat so the message pane isn't empty on startup.
      if (sorted[0]) {
        store.getState().setSelectedChatIndex(0);
        store.getState().setActiveChatId(sorted[0].id);
        void loadMessages(sorted[0].id);
      }
    } catch (err) {
      store.getState().setStatusMessage(`Failed to load chats: ${(err as Error).message}`);
    } finally {
      store.getState().setChatsLoading(false);
    }
  }

  async function loadMessages(chatId: number) {
    if (!core) return;
    store.getState().setMessagesLoading(true);
    try {
      const messages = await core.getMessages(chatId, 50);
      store.getState().setMessages(messages);
    } catch (err) {
      store.getState().setStatusMessage(`Failed to load messages: ${(err as Error).message}`);
    } finally {
      store.getState().setMessagesLoading(false);
    }
  }

  // Debounced open: rapid keyboard/wheel navigation only fetches the final
  // chat instead of firing a network request per step.
  let loadTimer: ReturnType<typeof setTimeout> | null = null;
  function openChat(chatId: number) {
    store.getState().setActiveChatId(chatId);
    if (loadTimer) clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
      loadTimer = null;
      void loadMessages(chatId);
    }, 120);
  }

  async function handleSendMessage(text: string) {
    if (!core) return;
    const chatId = store.getState().activeChatId;
    if (chatId == null) return;
    store.getState().setStatusMessage('Sending…');
    try {
      await core.sendMessage(chatId, text);
      await loadMessages(chatId);
    } catch (err) {
      store.getState().setStatusMessage(`Send failed: ${(err as Error).message}`);
    } finally {
      store.getState().setStatusMessage(null);
    }
  }

  // ---- Render immediately (auth screen shows while disconnected) ----
  // alternateScreen gives a clean full-screen canvas (like vim/htop); the
  // MouseProvider enables terminal mouse tracking and drives per-element
  // click/wheel hit-testing inside the components.
  const { waitUntilExit } = render(
    <MouseProvider autoEnable>
      <App
        onSendCode={handleSendCode}
        onSignIn={handleSignIn}
        onPassword={handlePassword}
        onSelectChat={openChat}
        onSendMessage={(text) => {
          void handleSendMessage(text);
        }}
      />
    </MouseProvider>,
    { alternateScreen: true },
  );

  // ---- Auto-login on startup ------------------------------------------------
  // If a saved session exists, restore it in the background. The auth screen is
  // already on screen; a valid session skips straight to the chat list, while an
  // invalid/expired one simply leaves the auth screen up for manual login.
  // Guarded on config.session so a fresh install never touches the network at
  // startup (and the PTY-launch check stays network-independent).
  if (config.session) {
    void ensureCore()
      .catch(() => {
        /* connect failed — stay on the auth screen; ensureCore reset for retry */
      })
      .finally(() => {
        if (store.getState().authPhase !== 'ready') {
          store.getState().setStatusMessage(null);
        }
      });
  }

  await waitUntilExit();
  if (core) await core.disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
