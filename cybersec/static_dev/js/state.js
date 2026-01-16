let selectedChatId = null;

export function setSelectedChat(chatId) {
    selectedChatId = chatId;
}

export function getSelectedChat() {
    return selectedChatId;
}

export function clearSelectedChat() {
    selectedChatId = null;
}


let pendingRecipient = null;

let pendingRecipientId = null;


export function setPendingRecipient(username) {
    pendingRecipient = username;
}

export function getPendingRecipient() {
    return pendingRecipient;
}

export function setPendingRecipientId(id) {
    pendingRecipientId = id;
}

export function getPendingRecipientId() {
    return pendingRecipientId;
}


let selectedChatEl = null;

export function setSelectedChatEl(el) {
    selectedChatEl = el;
}

export function getSelectedChatEl() {
    return selectedChatEl;
}


let chats = [];

export function setChats(newChats) {
    chats = newChats;
}

export function getChats() {
    return chats;
}

export function addChat(newChat) {
    chats.push(newChat);
}

export function getChatById(chatId) {
    return chats.find(chat => chat.id === chatId);
}

let lastReadMessageId = null;

export function getLastReadMessageId() {
    return lastReadMessageId;
}

export function setLastReadMessageId(messageId) {
    lastReadMessageId = messageId;
}