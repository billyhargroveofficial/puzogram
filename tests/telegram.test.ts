import { describe, expect, it, vi } from 'vitest';
import { TelegramCore } from '../src/core/telegram.js';

describe('TelegramCore peer ids', () => {
  it('keeps GramJS marked dialog ids and the archived flag', async () => {
    const core = new TelegramCore({ apiId: 1, apiHash: 'test' });
    vi.spyOn(core.client, 'getDialogs').mockResolvedValue([
      {
        id: { toString: () => '-100123' },
        entity: { id: 123, className: 'Channel', title: 'News', megagroup: false },
        message: undefined,
        unreadCount: 0,
        archived: false,
        dialog: { folderId: undefined },
      },
      {
        id: { toString: () => '-456' },
        entity: { id: 456, className: 'Chat', title: 'Old group' },
        message: undefined,
        unreadCount: 0,
        archived: true,
        dialog: { folderId: 1 },
      },
    ] as any);

    const chats = await core.getDialogs();
    expect(chats[0]!.id).toBe(-100123);
    expect(chats[0]!.isArchived).toBe(false);
    expect(chats[1]!.id).toBe(-456);
    expect(chats[1]!.isArchived).toBe(true);
  });

  it('resolves folder peers through GramJS, including InputPeerSelf', async () => {
    const core = new TelegramCore({ apiId: 1, apiHash: 'test' });
    const self = { className: 'InputPeerSelf' };
    const channel = { className: 'InputPeerChannel' };
    const group = { className: 'InputPeerChat' };

    vi.spyOn(core.client, 'invoke').mockResolvedValue({
      filters: [
        { className: 'DialogFilterDefault' },
        {
          className: 'DialogFilter',
          id: 1,
          title: { text: 'Personal' },
          pinnedPeers: [self],
          includePeers: [channel],
          excludePeers: [group],
          contacts: true,
          nonContacts: true,
        },
      ],
    } as any);
    vi.spyOn(core.client, 'getPeerId').mockImplementation(async (peer: any) => {
      if (peer === self) return '42';
      if (peer === channel) return '-100123';
      if (peer === group) return '-456';
      throw new Error('unexpected peer');
    });

    const folders = await core.getDialogFilters();
    expect(folders).toHaveLength(2);
    expect(folders[1]).toMatchObject({
      id: 1,
      title: 'Personal',
      pinnedChatIds: [42],
      includeChatIds: [-100123],
      excludeChatIds: [-456],
      contacts: true,
      nonContacts: true,
      groups: false,
      broadcasts: false,
      bots: false,
    });
  });
});
