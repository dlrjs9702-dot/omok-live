'use strict';

const MAX_CHAT_MESSAGES = 100;
const MAX_CHAT_LENGTH = 300;

function createRoomSocial() {
  return { messages: [], nextId: 1 };
}

function ensureSocial(room) {
  if (!room.social) room.social = createRoomSocial();
  return room.social;
}

function pushMessage(room, message) {
  const social = ensureSocial(room);
  const row = {
    id: social.nextId++,
    type: message.type === 'system' ? 'system' : 'chat',
    label: String(message.label || '').slice(0, 40),
    text: String(message.text || '').slice(0, MAX_CHAT_LENGTH),
    at: new Date().toISOString(),
  };
  social.messages.push(row);
  if (social.messages.length > MAX_CHAT_MESSAGES) {
    social.messages.splice(0, social.messages.length - MAX_CHAT_MESSAGES);
  }
  return row;
}

function appendSystemMessage(room, text) {
  return pushMessage(room, { type: 'system', text });
}

function appendChatMessage(room, session, text) {
  return pushMessage(room, {
    type: 'chat',
    label: session.label || '게스트',
    text,
  });
}

function publicChatMessages(room) {
  const social = ensureSocial(room);
  return social.messages.map(({ id, type, label, text, at }) => ({ id, type, label, text, at }));
}

module.exports = {
  MAX_CHAT_LENGTH,
  createRoomSocial,
  appendSystemMessage,
  appendChatMessage,
  publicChatMessages,
};
