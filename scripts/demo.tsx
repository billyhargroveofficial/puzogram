#!/usr/bin/env node
/**
 * Screenshot demo — renders the real <App> with 100% fake fixture data.
 *
 * Usage: npm run demo -- <scene>
 * Scenes: 1 = main view, 2 = Personal folder + typed draft, 3 = Archive tab.
 * The app stays open like the real client — quit with Ctrl+C.
 */
import React from 'react';
import { render } from 'ink';
import { MouseProvider } from '@ink-tools/ink-mouse';
import { App } from '../src/ui/App.js';
import { appStore } from '../src/store/app.js';
import type { DisplayChat, DisplayFolder, DisplayMessage } from '../src/display/format.js';

const now = new Date();
const minsAgo = (m: number): Date => new Date(now.getTime() - m * 60_000);

// ---------------------------------------------------------------------------
// Fake chats — any resemblance to real chats is purely coincidental
// ---------------------------------------------------------------------------

const CHATS: DisplayChat[] = [
  { id: 1, title: 'Парилка228', lastMessageText: 'Лёша: фото или не было', lastMessageDate: minsAgo(2), unreadCount: 12, isChannel: false, isGroup: true },
  { id: 2, title: 'Антон Соседский', lastMessageText: 'опять дрель в 8 утра, сорян', lastMessageDate: minsAgo(7), unreadCount: 3, isChannel: false, isGroup: false, isContact: true },
  { id: 3, title: 'Tonop Live', lastMessageText: 'ЗАВТРА ЛИСТИНГ 🚀🚀🚀', lastMessageDate: minsAgo(15), unreadCount: 148, isChannel: true, isGroup: false },
  { id: 4, title: 'Мама', lastMessageText: 'позвони бабушке, она скучает', lastMessageDate: minsAgo(31), unreadCount: 1, isChannel: false, isGroup: false, isContact: true },
  { id: 5, title: 'Ботинок Бот', lastMessageText: '/weather завтра: дождь, бери зонт', lastMessageDate: minsAgo(44), unreadCount: 0, isChannel: false, isGroup: false, isBot: true },
  { id: 6, title: 'Спринт-клуб 04:44', lastMessageText: 'кто завтра на пробежку? 🏃', lastMessageDate: minsAgo(58), unreadCount: 7, isChannel: false, isGroup: true },
  { id: 7, title: 'Крипто Бабайка', lastMessageText: 'хомяки на Марсе уже майнят', lastMessageDate: minsAgo(75), unreadCount: 0, isChannel: true, isGroup: false },
  { id: 8, title: 'Денис (работа)', lastMessageText: 'насчёт созвона — давай в 15:00', lastMessageDate: minsAgo(120), unreadCount: 0, isChannel: false, isGroup: false },
  { id: 9, title: 'Избранное', lastMessageText: 'список продуктов.txt', lastMessageDate: minsAgo(200), unreadCount: 0, isChannel: false, isGroup: false },
  { id: 10, title: 'Дайджест Шавермы', lastMessageText: 'топ-5 шаверм недели по версии редакции', lastMessageDate: minsAgo(400), unreadCount: 26, isChannel: true, isGroup: false },
  // Archived — live only in the Archive tab
  { id: 11, title: 'Саратов Доставка Еды', lastMessageText: 'ваш заказ доставлен', lastMessageDate: minsAgo(9000), unreadCount: 0, isChannel: false, isGroup: false, isArchived: true },
  { id: 12, title: 'Пары 2023', lastMessageText: 'лекция перенесена на никогда', lastMessageDate: minsAgo(20000), unreadCount: 0, isChannel: false, isGroup: true, isArchived: true },
  { id: 13, title: 'Налоговая (не открывать)', lastMessageText: 'у вас новое уведомление', lastMessageDate: minsAgo(30000), unreadCount: 4, isChannel: false, isGroup: false, isArchived: true },
  { id: 14, title: 'Бывший одногруппник', lastMessageText: 'привет, ты случайно не в крипте?', lastMessageDate: minsAgo(60000), unreadCount: 0, isChannel: false, isGroup: false, isArchived: true },
];

const FOLDERS: DisplayFolder[] = [
  { id: 0, title: 'All', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [], contacts: true, nonContacts: true, groups: true, broadcasts: true, bots: true },
  { id: -1, title: 'Archive', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [], contacts: false, nonContacts: false, groups: false, broadcasts: false, bots: false },
  { id: 1, title: 'Personal', pinnedChatIds: [], includeChatIds: [], excludeChatIds: [], contacts: true, nonContacts: true, groups: false, broadcasts: false, bots: false },
  { id: 2, title: 'work', pinnedChatIds: [], includeChatIds: [8, 6], excludeChatIds: [], contacts: false, nonContacts: false, groups: false, broadcasts: false, bots: false },
];

// ---------------------------------------------------------------------------
// Fake message feeds
// ---------------------------------------------------------------------------

const msg = (id: number, senderId: number, senderName: string, text: string, m: number, out = false): DisplayMessage => ({
  id, senderId, senderName, text, date: minsAgo(m), isOutgoing: out,
});

const PARILKA_MESSAGES: DisplayMessage[] = [
  msg(101, 2, 'Лёша', 'короче я купил шаверму размером с руку. РАЗМЕРОМ. С РУКУ.', 40),
  msg(102, 3, 'Антон', 'фото или не было', 38),
  msg(103, 2, 'Лёша', '🖼 Фото', 37),
  msg(104, 0, 'Me', 'было. я уже съел', 36, true),
  msg(105, 3, 'Антон', '......', 35),
  msg(106, 0, 'Me', '🎤 Голосовое (0:42)', 34, true),
  msg(107, 2, 'Лёша', 'ладно, вопрос жизненный: с капустой или без? я вот стою у ларька и не могу решиться уже десять минут, продавец смотрит на меня как на идиота', 12),
  msg(108, 3, 'Антон', 'без капусты это шаурма, с капустой это салат в лаваше. выбирай судьбу', 10),
  msg(109, 2, 'Лёша', '📊 Опрос: капуста в шаверме?', 8),
  msg(110, 0, 'Me', 'проголосовал за капусту. предатель', 5, true),
  msg(111, 2, 'Лёша', 'поздно, я уже взял обе', 2),
];

const MAMA_MESSAGES: DisplayMessage[] = [
  msg(201, 4, 'Мама', 'сынок, как дела? ты кушал?', 65),
  msg(202, 0, 'Me', 'мам, всё хорошо, ел', 60, true),
  msg(203, 4, 'Мама', 'а что ел?', 58),
  msg(204, 0, 'Me', 'шаверму', 57, true),
  msg(205, 4, 'Мама', 'опять эту свою шаверму... ладно. позвони бабушке, она скучает', 31),
];

const ARCHIVE_MESSAGES: DisplayMessage[] = [
  msg(301, 13, 'Налоговая', 'у вас новое уведомление', 30000),
  msg(302, 13, 'Налоговая', 'у вас ещё одно уведомление', 29000),
  msg(303, 13, 'Налоговая', 'пожалуйста откройте', 28000),
  msg(304, 0, 'Me', '(сообщения удалены)', 27000, true),
];

// ---------------------------------------------------------------------------
// Scene selection
// ---------------------------------------------------------------------------

const scene = process.argv[2] ?? '1';

const base = {
  authPhase: 'ready' as const,
  authError: null,
  phoneNumber: '',
  phoneCodeHash: null,
  chats: CHATS,
  folders: FOLDERS,
  chatsLoading: false,
  messagesLoading: false,
  messagesScrollOffset: 0,
  statusMessage: null,
};

if (scene === '2') {
  appStore.setState({
    ...base,
    selectedFolderIndex: 2, // Personal
    selectedChatIndex: 1, // Мама
    activeChatId: 4,
    messages: MAMA_MESSAGES,
    inputText: 'позвоню сегодня вечером, обещаю 🙏',
    focusedPane: 'input',
  } as any);
} else if (scene === '3') {
  appStore.setState({
    ...base,
    selectedFolderIndex: 1, // Archive
    selectedChatIndex: 2, // Налоговая
    activeChatId: 13,
    messages: ARCHIVE_MESSAGES,
    inputText: '',
    focusedPane: 'chatList',
  } as any);
} else {
  appStore.setState({
    ...base,
    selectedFolderIndex: 0, // All
    selectedChatIndex: 0, // Парилка228
    activeChatId: 1,
    messages: PARILKA_MESSAGES,
    inputText: '',
    focusedPane: 'chatList',
  } as any);
}

render(
  <MouseProvider autoEnable={false}>
    <App
      onSendCode={async () => {}}
      onSignIn={async () => {}}
      onPassword={async () => {}}
      onSelectChat={() => {}}
      onSendMessage={() => {}}
    />
  </MouseProvider>,
  { alternateScreen: true },
);
