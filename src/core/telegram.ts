/**
 * GramJS core module — thin async wrapper around the `telegram` npm package.
 * No Ink imports here. Exposes a typed interface for the UI layer.
 */
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { LogLevel } from 'telegram/extensions/Logger.js';
import type { DisplayChat, DisplayMessage, DisplayFolder } from '../display/format.js';
import { readSessionString } from './session.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface TelegramConfig {
  apiId: number;
  apiHash: string;
  session?: string; // saved StringSession
}

export function loadConfig(): TelegramConfig {
  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH ?? '';
  if (!apiId || !apiHash) {
    throw new Error(
      'Set TG_API_ID and TG_API_HASH env vars (get them at https://my.telegram.org)',
    );
  }
  return { apiId, apiHash, session: process.env.TG_SESSION ?? readSessionString() };
}

// ---------------------------------------------------------------------------
// Auth state machine
// ---------------------------------------------------------------------------

export type AuthPhase = 'phone' | 'code' | 'password' | 'ready';

export interface AuthState {
  phase: AuthPhase;
  phoneCodeHash?: string;
  phoneNumber?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Telegram core
// ---------------------------------------------------------------------------

export class TelegramCore {
  readonly client: TelegramClient;
  private config: TelegramConfig;

  constructor(config: TelegramConfig) {
    this.config = config;
    const session = new StringSession(config.session ?? '');
    this.client = new TelegramClient(session, config.apiId, config.apiHash, {
      connectionRetries: 5,
    });
    // Silence GramJS verbose logging
    this.client.setLogLevel(LogLevel.ERROR);
  }

  /** Connect to Telegram servers (does not authenticate). */
  async connect(): Promise<void> {
    await this.client.connect();
  }

  /** Check if we already have an authorised session. */
  async isAuthorized(): Promise<boolean> {
    return this.client.isUserAuthorized();
  }

  // ---- Auth flow ----------------------------------------------------------

  /** Step 1: send confirmation code to the phone number. */
  async sendCode(phoneNumber: string): Promise<string> {
    const result = await this.client.sendCode(
      { apiId: this.config.apiId, apiHash: this.config.apiHash },
      phoneNumber,
    );
    return result.phoneCodeHash;
  }

  /** Step 2a: sign in with the code received via SMS/Telegram. */
  async signIn(phoneNumber: string, phoneCodeHash: string, phoneCode: string): Promise<void> {
    await this.client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode,
      }),
    );
  }

  /** Step 2b: sign in with 2FA password (uses GramJS high-level helper). */
  async signInWithPassword(password: string): Promise<void> {
    await (this.client as any).signInWithPassword(
      { apiId: this.config.apiId, apiHash: this.config.apiHash },
      {
        password: async () => password,
        onError: (err: Error) => console.error('2FA error:', err.message),
      },
    );
  }

  /** Get the saved session string (for persistence). */
  getSessionString(): string {
    return this.client.session.save() as unknown as string;
  }

  // ---- Data fetching ------------------------------------------------------

  /** Fetch the dialog (chat) list. */
  async getDialogs(limit = 50): Promise<DisplayChat[]> {
    const dialogs = await this.client.getDialogs({ limit });
    return dialogs.map((d) => {
      const entity = d.entity;
      const anyEntity = entity as any;
      const firstName: string = anyEntity.firstName ?? '';
      const lastName: string = anyEntity.lastName ?? '';
      const personName = [firstName, lastName].filter(Boolean).join(' ');
      const title: string = anyEntity.title ?? (personName || 'Unknown');
      const isBot: boolean = anyEntity.bot === true;
      const isContact: boolean = anyEntity.contact === true || anyEntity.mutualContact === true;

      const lastMsg = d.message;
      return {
        id: Number(entity!.id),
        title,
        lastMessageText: lastMsg?.message ?? '',
        lastMessageDate: lastMsg?.date ? new Date(lastMsg.date * 1000) : new Date(0),
        unreadCount: d.unreadCount ?? 0,
        isChannel: entity!.className === 'Channel' && anyEntity.megagroup !== true,
        isGroup:
          entity!.className === 'Chat' ||
          (entity!.className === 'Channel' && anyEntity.megagroup === true),
        isBot,
        isContact,
      } satisfies DisplayChat;
    });
  }

  /** Fetch messages for a given entity (chat/channel/user). */
  async getMessages(entityId: number, limit = 50): Promise<DisplayMessage[]> {
    const entity = await this.client.getEntity(entityId);
    const messages = await this.client.getMessages(entity, { limit });
    return messages
      .filter((m) => m.message !== undefined)
      .map((m) => {
        const sender = m.sender as any;
        let senderName = 'Unknown';
        if (sender) {
          const firstName: string = sender.firstName ?? '';
          const lastName: string = sender.lastName ?? '';
          const personName = [firstName, lastName].filter(Boolean).join(' ');
          senderName = sender.title ?? (personName || 'Unknown');
        }
        return {
          id: m.id,
          senderName,
          text: m.message ?? '',
          date: new Date(m.date * 1000),
          isOutgoing: m.out ?? false,
        } satisfies DisplayMessage;
      })
      .reverse(); // oldest first for display
  }

  /** Send a text message to a chat. */
  async sendMessage(entityId: number, text: string): Promise<void> {
    const entity = await this.client.getEntity(entityId);
    await this.client.sendMessage(entity, { message: text });
  }

  /** Fetch chat folders (dialog filters). */
  async getDialogFilters(): Promise<DisplayFolder[]> {
    const result = await this.client.invoke(new Api.messages.GetDialogFilters());
    const filters = (result as any).filters ?? [];
    const out: DisplayFolder[] = [];
    for (const f of filters) {
      if (f.className === 'DialogFilterDefault') {
        // The built-in "All" folder
        out.push({
          id: 0,
          title: 'All',
          emoji: undefined,
          pinnedChatIds: [],
          includeChatIds: [],
          excludeChatIds: [],
          contacts: true,
          nonContacts: true,
          groups: true,
          broadcasts: true,
          bots: true,
        });
        continue;
      }
      const df = f as any;
      out.push({
        id: df.id ?? 0,
        title: df.title ?? 'Folder',
        emoji: df.emoticon ?? undefined,
        pinnedChatIds: (df.pinnedPeers ?? []).map((p: any) => Number(p.channelId ?? p.chatId ?? p.userId ?? 0)),
        includeChatIds: (df.includePeers ?? []).map((p: any) => Number(p.channelId ?? p.chatId ?? p.userId ?? 0)),
        excludeChatIds: (df.excludePeers ?? []).map((p: any) => Number(p.channelId ?? p.chatId ?? p.userId ?? 0)),
        contacts: df.contacts ?? false,
        nonContacts: df.nonContacts ?? false,
        groups: df.groups ?? false,
        broadcasts: df.broadcasts ?? false,
        bots: df.bots ?? false,
      });
    }
    return out;
  }

  /** Disconnect gracefully. */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
