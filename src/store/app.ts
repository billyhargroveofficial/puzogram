/**
 * Zustand store — single source of truth for the TUI state.
 */
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { AuthPhase } from '../core/telegram.js';
import type { DisplayChat, DisplayMessage, DisplayFolder } from '../display/format.js';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface AppState {
  // Auth
  authPhase: AuthPhase;
  authError: string | null;
  phoneNumber: string;
  phoneCodeHash: string | null;

  // Folders
  folders: DisplayFolder[];
  selectedFolderIndex: number;

  // Chats
  chats: DisplayChat[];
  selectedChatIndex: number;
  chatsLoading: boolean;

  // Messages
  messages: DisplayMessage[];
  messagesLoading: boolean;

  // Input
  inputText: string;

  // UI
  focusedPane: 'chatList' | 'messages' | 'input';
  statusMessage: string | null;

  // Actions
  setAuthPhase: (phase: AuthPhase) => void;
  setAuthError: (error: string | null) => void;
  setPhoneNumber: (phone: string) => void;
  setPhoneCodeHash: (hash: string | null) => void;
  setFolders: (folders: DisplayFolder[]) => void;
  setSelectedFolderIndex: (index: number) => void;
  setChats: (chats: DisplayChat[]) => void;
  setSelectedChatIndex: (index: number) => void;
  setChatsLoading: (loading: boolean) => void;
  setMessages: (messages: DisplayMessage[]) => void;
  setMessagesLoading: (loading: boolean) => void;
  setInputText: (text: string) => void;
  setFocusedPane: (pane: AppState['focusedPane']) => void;
  setStatusMessage: (msg: string | null) => void;
}

// ---------------------------------------------------------------------------
// Vanilla store (usable outside React)
// ---------------------------------------------------------------------------

export const appStore = createStore<AppState>((set) => ({
  authPhase: 'phone',
  authError: null,
  phoneNumber: '',
  phoneCodeHash: null,

  folders: [],
  selectedFolderIndex: 0,

  chats: [],
  selectedChatIndex: 0,
  chatsLoading: false,

  messages: [],
  messagesLoading: false,

  inputText: '',

  focusedPane: 'chatList',
  statusMessage: null,

  setAuthPhase: (phase) => set({ authPhase: phase }),
  setAuthError: (error) => set({ authError: error }),
  setPhoneNumber: (phone) => set({ phoneNumber: phone }),
  setPhoneCodeHash: (hash) => set({ phoneCodeHash: hash }),
  setFolders: (folders) => set({ folders }),
  setSelectedFolderIndex: (index) => set({ selectedFolderIndex: index }),
  setChats: (chats) => set({ chats }),
  setSelectedChatIndex: (index) => set({ selectedChatIndex: index }),
  setChatsLoading: (loading) => set({ chatsLoading: loading }),
  setMessages: (messages) => set({ messages }),
  setMessagesLoading: (loading) => set({ messagesLoading: loading }),
  setInputText: (text) => set({ inputText: text }),
  setFocusedPane: (pane) => set({ focusedPane: pane }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
}));

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}
