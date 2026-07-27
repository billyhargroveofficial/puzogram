/**
 * Integration test: switching folders actually re-filters the chat list.
 *
 * Renders the full App in the 'ready' phase with two folders whose contents
 * differ (contacts vs groups/channels), then simulates pressing "l" (switch
 * folder right) and asserts the previously-visible group/channel rows vanish.
 * This guards against regressions of "folders don't change the dialog list".
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MouseProvider } from '@ink-tools/ink-mouse';
import { App } from '../src/ui/App.js';
import { appStore } from '../src/store/app.js';
import type { DisplayChat, DisplayFolder } from '../src/display/format.js';

const CHATS: DisplayChat[] = [
  { id: 1, title: 'Alice', lastMessageText: 'hi', lastMessageDate: new Date(2026, 6, 27, 10, 0), unreadCount: 0, isChannel: false, isGroup: false, isContact: true },
  { id: 2, title: 'DevGroup', lastMessageText: 'build', lastMessageDate: new Date(2026, 6, 27, 9, 0), unreadCount: 0, isChannel: false, isGroup: true },
  { id: 3, title: 'NewsChan', lastMessageText: 'news', lastMessageDate: new Date(2026, 6, 26, 8, 0), unreadCount: 0, isChannel: true, isGroup: false },
];

const FOLDERS: DisplayFolder[] = [
  { id: 0, title: 'All', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [], contacts: true, nonContacts: true, groups: true, broadcasts: true, bots: true },
  { id: 1, title: 'Personal', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [], contacts: true, nonContacts: true, groups: false, broadcasts: false, bots: false },
];

function setReadyState(): void {
  appStore.setState({
    authPhase: 'ready',
    folders: FOLDERS,
    selectedFolderIndex: 0,
    chats: CHATS,
    selectedChatIndex: 0,
    activeChatId: 1,
    messages: [],
    messagesLoading: false,
    focusedPane: 'chatList',
    statusMessage: null,
  } as any);
}

const tick = (): Promise<void> => new Promise((r) => setImmediate(r));

describe('folder switching', () => {
  beforeEach(setReadyState);

  it('"All" shows every chat; "Personal" filters to contacts only', async () => {
    const { lastFrame, stdin } = render(
      <MouseProvider autoEnable={false}>
        <App
          onSendCode={async () => {}}
          onSignIn={async () => {}}
          onPassword={async () => {}}
          onSelectChat={() => {}}
          onSendMessage={() => {}}
        />
      </MouseProvider>,
    );

    // Initially on "All" — all three chats visible.
    const before = lastFrame()!;
    expect(before).toContain('Alice');
    expect(before).toContain('DevGroup');
    expect(before).toContain('NewsChan');

    // Press "l" to switch to the "Personal" folder (contacts only).
    stdin.write('l');
    await tick();
    await tick();

    const after = lastFrame()!;
    expect(appStore.getState().selectedFolderIndex).toBe(1);
    expect(after).toContain('Alice'); // contact stays
    expect(after).not.toContain('DevGroup'); // group filtered out
    expect(after).not.toContain('NewsChan'); // channel filtered out
  });

  it('switching back to "All" restores the full list', async () => {
    const { lastFrame, stdin } = render(
      <MouseProvider autoEnable={false}>
        <App
          onSendCode={async () => {}}
          onSignIn={async () => {}}
          onPassword={async () => {}}
          onSelectChat={() => {}}
          onSendMessage={() => {}}
        />
      </MouseProvider>,
    );

    stdin.write('l'); // → Personal
    await tick();
    stdin.write('h'); // → back to All
    await tick();
    await tick();

    const after = lastFrame()!;
    expect(appStore.getState().selectedFolderIndex).toBe(0);
    expect(after).toContain('Alice');
    expect(after).toContain('DevGroup');
    expect(after).toContain('NewsChan');
  });
});
