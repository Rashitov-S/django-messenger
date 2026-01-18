import {addChat, getSelectedChat, setChats, setSelectedChat} from "./state.js";
import {addMessageToChatWindow, loadSelectedChat, markMessagesAsReadUpTo} from "./selected_chat.js";
import {decryptMessage} from "./crypto/messages.js";
import {deleteSession, ensureSession} from "./crypto/session.js";
import {signalStore} from "./crypto/signalStore.js";

let chatListEl = null;

export function initChatList(elementId) {
    chatListEl = document.getElementById(elementId);
}

export async function renderChat(chat) {
    const li = document.createElement("li");
    li.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 btn rounded-0 border-0 border-bottom";
    li.dataset.chatId = chat.id;

    let lastMessageText = "Нет сообщений";
    let lastMessageTime = "";
    let lastMessageStatus = "";

    if (chat.last_message) {
        li.dataset.lastMessageId = chat.last_message.id;

        const last_msg = await signalStore.loadLocalMessage(chat.last_message);
        if (last_msg?.plaintext) {
            chat.last_message.plaintext = last_msg.plaintext;
        } else {
            chat.last_message = await decryptMessage(chat.last_message);
        }

        lastMessageText = chat.last_message.plaintext || lastMessageText;
        lastMessageTime = chat.last_message.created_at
            ? new Date(chat.last_message.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
            : "";
        lastMessageStatus = chat.last_message.delivery_status || "";
    }

    let chatName = chat.name;
    if (chat.type === "private") {
        const other = chat.members.find(m => m.id !== CURRENT_USER_ID);
        chatName = other ? other.username : "Unknown";
    }

    const unread = chat.unread_count || 0;

    li.innerHTML = `
    <div class="d-flex flex-column text-truncate">
        <strong class="text-truncate">${chatName}</strong>
        <small class="text-muted text-truncate chat-preview">
            ${lastMessageText}
        </small>
    </div>

    <div class="ms-2 d-flex flex-column align-items-end text-nowrap">
        <small class="text-muted chat-time">
            ${lastMessageTime}
        </small>

        ${unread > 0 ? `
            <span class="badge rounded-pill bg-secondary text-white unread-badge mt-1">
                ${unread}
                <span class="visually-hidden">unread messages</span>
            </span>
        ` : ""}

        ${lastMessageStatus === "read"
        ? '<i class="bi bi-check2-all fs-5 chat-status"></i>'
        : (lastMessageStatus === "delivered"
            ? '<i class="bi bi-check2 fs-5 chat-status"></i>'
            : '<i class="chat-status"></i>')}
    </div>
    `;

    li.addEventListener("click", () => openChat(chat.id));
    return li;
}


export async function loadChats() {
    const res = await fetch("/api/chat/chats");
    if (!res.ok) return;
    const chats = await res.json();
    setChats(chats);


    chatListEl.innerHTML = "";
    for (const chat of chats) {
        chatListEl.appendChild(await renderChat(chat));
    }
}

export function updateChatPreview(chat_id, message) {
    const chatEl = document.querySelector(`#chat-list [data-chat-id="${chat_id}"]`);
    if (!chatEl) return;

    const previewEl = chatEl.querySelector(".chat-preview");
    const timeEl = chatEl.querySelector(".chat-time");

    if (!previewEl || !timeEl) return;

    if (!(message.sender.id === CURRENT_USER_ID && (message.delivery_status === "read" || message.delivery_status === "delivered"))) {
        previewEl.textContent = message.plaintext;
    }
    chatEl.dataset.lastMessageId = message.id;

    timeEl.textContent = new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

    if (message.sender.id === CURRENT_USER_ID) {
        const statusIcon = chatEl.querySelector(".chat-status");
        if (statusIcon) {
            if (message.delivery_status === "pending") {
                statusIcon.className = "chat-status bi bi-clock fs-5";
            } else if (message.delivery_status === "delivered") {
                statusIcon.className = "chat-status bi bi-check2 fs-5";
            } else if (message.delivery_status === "read") {
                statusIcon.className = "chat-status bi bi-check2-all fs-5";
            }
        }
    }
}

export async function openChat(chatId) {
    if (getSelectedChat() === chatId) {
        return;
    }

    setSelectedChat(chatId);

    await loadSelectedChat();

}


export function getChatElement(chat_id) {
    return chatListEl.querySelector(`[data-chat-id="${chat_id}"]`);
}


async function addChatToList(chat) {
    const existing = chatListEl.querySelector(`[data-chat-id="${chat.id}"]`);
    if (existing) {
        return;
    }

    const li = await renderChat(chat);
    chatListEl.prepend(li);
}

function incrementUnread(chatEl) {
    const badge = chatEl.querySelector(".unread-badge");
    const chatStatus = chatEl.querySelector(".chat-status");
    chatStatus.classList.add("d-none");
    if (badge) {
        badge.textContent = parseInt(badge.textContent) + 1;
    } else {
        const badgeContainer = chatEl.querySelector("div.ms-2");
        const span = document.createElement("span");
        span.className = "badge rounded-pill bg-secondary text-white unread-badge mt-1";
        span.textContent = "1";
        badgeContainer.appendChild(span);
    }
}

export function decrementUnread(chatEl) {
    const badge = chatEl.querySelector(".unread-badge");
    if (!badge) return;

    let count = parseInt(badge.textContent) || 0;
    count--;

    if (count <= 0) {
        badge.remove();
    } else {
        badge.textContent = count;
    }
}

function updateExistingChat(chatEl, chat_id, msg) {
    updateChatPreview(chat_id, msg);
    if (msg.sender.id !== CURRENT_USER_ID) {
        incrementUnread(chatEl);
    }
}

export function moveChatToTop(chat_id) {
    const chatEl = getChatElement(chat_id);
    if (!chatEl) return;

    chatListEl.prepend(chatEl);
}

export async function handleNewMessage(chat_id, msg) {
    const chatEl = getChatElement(chat_id);

    if (!chatEl) {
        console.warn("Получено сообщение для несуществующего чата, ждём new_chat");
        return;
    }

    if (msg.sender.id !== CURRENT_USER_ID) {
        try {
            await ensureSession(msg.sender.id);

            msg.plaintext = await decryptMessage(msg);

        } catch (e) {
            throw e;
        }
    } else {
        await signalStore.updateMessageByLocalId(msg);
    }


    updateExistingChat(chatEl, chat_id, msg);
    moveChatToTop(chat_id);
    addMessageToChatWindow(chat_id, msg);
}

export function handleNewChat(chat) {
    addChat(chat);

    addChatToList(chat);
    moveChatToTop(chat.id);

}

function hideUnread(chatEl) {
    const badge = chatEl.querySelector(".unread-badge");
    if (badge) {
        badge.remove();
    }

}

function updateChatListReadStatus(chat_id, last_message_id) {
    const chatEl = getChatElement(chat_id);
    if (!chatEl) return;

    const previewLastId = parseInt(chatEl.dataset.lastMessageId);

    if (!previewLastId || previewLastId !== last_message_id) return;

    hideUnread(chatEl);
    markChatPreviewMessageAsRead(chatEl);

}

function markChatPreviewMessageAsRead(chatEl) {
    const statusIcon = chatEl.querySelector(".chat-status");
    if (statusIcon) {
        statusIcon.className = "chat-status fs-5 bi bi-check2-all";
    }
}


export function handleUpdateMessageStatus(chat_id, last_message_id) {
    if (getSelectedChat() !== chat_id) {
        updateChatListReadStatus(chat_id);
        return;
    }

    markMessagesAsReadUpTo(chat_id, last_message_id);
    updateChatListReadStatus(chat_id, last_message_id);

}