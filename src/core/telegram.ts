/**
 * GramJS core module — thin async wrapper around the `telegram` npm package.
 * No Ink imports here. Exposes a typed interface for the UI layer.
 */
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { LogLevel } from 'telegram/extensions/Logger.js';
import { toText } from '../display/format.js';
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
// Media labels
// ---------------------------------------------------------------------------

/**
 * Human-readable label for a message's media attachment, used as the bubble
 * text when the message has no caption (otherwise media messages would render
 * as empty bubbles). GramJS exposes type getters (photo/video/voice/…) on the
 * Message; we map them to a short localized label.
 */
function mediaLabel(m: any): string {
  try {
    if (!m.media) return '';
    if (m.photo) return '🖼 Фото';
    if (m.video) return '🎥 Видео';
    if (m.gif) return '🎞 GIF';
    if (m.voice) return '🎤 Голосовое';
    if (m.audio) return '🎵 Аудио';
    if (m.sticker) {
      const e = m.sticker?.emoji ?? '';
      return e ? `${e} Стикер` : 'Стикер';
    }
    if (m.document) return '📎 Файл';
    const cn = m.media?.className ?? '';
    if (cn.includes('WebPage')) return '🔗 Ссылка';
    if (cn.includes('Geo') || cn.includes('Venue')) return '📍 Геолокация';
    if (cn.includes('Contact')) return '👤 Контакт';
    if (cn.includes('Poll')) return '📊 Опрос';
    return '📎 Медиа';
  } catch {
    return '📎 Медиа';
  }
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
      const firstName = toText(anyEntity.firstName);
      const lastName = toText(anyEntity.lastName);
      const personName = [firstName, lastName].filter(Boolean).join(' ');
      const title = toText(anyEntity.title) || personName || 'Unknown';
      const isBot: boolean = anyEntity.bot === true;
      const isContact: boolean = anyEntity.contact === true || anyEntity.mutualContact === true;

      const lastMsg = d.message as any;
      return {
        // GramJS dialog ids are marked: users stay positive, basic groups are
        // negative and channels use the -100 prefix. Folder peers use the same
        // representation, which avoids both type collisions and wrong matches.
        id: Number(d.id!.toString()),
        title,
        lastMessageText: toText(lastMsg?.message),
        lastMessageDate: lastMsg?.date ? new Date(lastMsg.date * 1000) : new Date(0),
        unreadCount: d.unreadCount ?? 0,
        isChannel: entity!.className === 'Channel' && anyEntity.megagroup !== true,
        isGroup:
          entity!.className === 'Chat' ||
          (entity!.className === 'Channel' && anyEntity.megagroup === true),
        isBot,
        isContact,
        isArchived: d.archived === true || d.dialog?.folderId === 1,
      } satisfies DisplayChat;
    });
  }

  /** Fetch messages for a given entity (chat/channel/user). */
  async getMessages(entityId: number, limit = 50): Promise<DisplayMessage[]> {
    const entity = await this.client.getEntity(entityId);
    const messages = await this.client.getMessages(entity, { limit });
    return messages
      .filter((m) => toText(m.message) !== '' || m.media)
      .map((m) => {
        const sender = m.sender as any;
        let senderName = 'Unknown';
        let senderId = 0;
        if (sender) {
          const firstName = toText(sender.firstName);
          const lastName = toText(sender.lastName);
          const personName = [firstName, lastName].filter(Boolean).join(' ');
          senderName = toText(sender.title) || personName || 'Unknown';
          senderId = Number(sender.id ?? 0) || 0;
        }
        return {
          id: m.id,
          senderId,
          senderName,
          // Caption text, or a media placeholder when there's no caption.
          text: toText(m.message) || mediaLabel(m),
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

  /** Fetch chat folders (dialog filters).
   *
   *  Always returns a built-in "All" folder first (id 0) so there is always a
   *  working view of every chat, even if the account has no custom folders or
   *  the GetDialogFilters call fails. Custom folders follow.
   */
  async getDialogFilters(): Promise<DisplayFolder[]> {
    const all: DisplayFolder = {
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
    };
    const out: DisplayFolder[] = [all];

    try {
      const result = await this.client.invoke(new Api.messages.GetDialogFilters());
      const filters = (result as any).filters ?? [];
      for (const f of filters) {
        // The server's own "All" (DialogFilterDefault) is redundant with ours.
        if (f.className === 'DialogFilterDefault') continue;
        const df = f as any;
        const peerIds = async (peers: Api.TypeInputPeer[] | undefined): Promise<number[]> => {
          const ids = await Promise.all(
            (peers ?? []).map(async (peer) => {
              try {
                const id = Number(await this.client.getPeerId(peer));
                return Number.isSafeInteger(id) ? id : null;
              } catch {
                return null;
              }
            }),
          );
          return ids.filter((id): id is number => id !== null);
        };
        const [pinnedChatIds, includeChatIds, excludeChatIds] = await Promise.all([
          peerIds(df.pinnedPeers),
          peerIds(df.includePeers),
          peerIds(df.excludePeers),
        ]);
        out.push({
          id: df.id ?? 0,
          title: toText(df.title) || 'Folder',
          emoji: toText(df.emoticon) || undefined,
          pinnedChatIds,
          includeChatIds,
          excludeChatIds,
          contacts: df.contacts ?? false,
          nonContacts: df.nonContacts ?? false,
          groups: df.groups ?? false,
          broadcasts: df.broadcasts ?? false,
          bots: df.bots ?? false,
        });
      }
    } catch {
      /* folders unavailable — the built-in "All" still gives a full chat list */
    }
    return out;
  }

  /** Disconnect gracefully. */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
