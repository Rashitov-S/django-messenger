import {
    getChatById,
    getLastReadMessageId,
    getPendingRecipient,
    getPendingRecipientId,
    getSelectedChat,
    getSelectedChatEl,
    setLastReadMessageId,
    setSelectedChatEl
} from "./state.js";
import {sendWS} from "./chat_socket.js";
import {decrementUnread, getChatElement, updateChatPreview} from "./chat_list.js";
import {ensureSession} from "./crypto/session.js";
import {encryptMessage} from "./crypto/messages.js";


const textarea = document.getElementById("message-input");
const sendButton = document.querySelector(".send-button");

sendButton.addEventListener("click", async () => {
    await sendMessage();
});

textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + 2 + "px";
});

textarea.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        await sendMessage();
    }
});

let readObserver = null;

export function initReadObserver() {
    if (readObserver) return;

    readObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const msgEl = entry.target;
            const msgId = parseInt(msgEl.dataset.messageId);
            const chatId = getSelectedChat();

            if (!msgId || !chatId) return;
            if (msgEl.classList.contains("message-read")) return;


            sendReadReceipt(chatId, msgId);
            decrementUnread(getChatElement(chatId));

            msgEl.classList.add("message-read");

        });
    }, {
        root: document.querySelector(".chat-body"),
        threshold: 0.6
    });
}

export function addMessageToChatWindow(chat_id, msg) {
    const isMine = msg.sender.id === CURRENT_USER_ID;
    if (isMine) {
        replacePendingMessage(chat_id, msg);
    } else {
        appendMessageToChat(chat_id, msg);
    }
}

export async function sendMessage() {
    const text = textarea.value.trim();
    if (!text) return;

    const chat_id = getSelectedChat();
    const client_id = "temp-" + Date.now();

    let recipientId;
    const payload = {
        type: "send_message",
        client_id: client_id
    };

    if (chat_id) {
        payload.chat_id = chat_id;
        const chat = getChatById(chat_id);
        if (!chat) {
            console.error("Чат не найден", chat_id);
            return;
        }
        const recipient = chat.members.find(m => m.id !== CURRENT_USER_ID);
        recipientId = recipient.id;
    } else {
        const recipientUsername = getPendingRecipient();
        recipientId = getPendingRecipientId();
        if (!recipientUsername || !recipientId) {
            console.warn("Нет получателя для нового чата");
            return;
        }
        payload.recipient_username = recipientUsername;
    }

    const encrypted = await encryptMessage(recipientId, text);
    payload.ciphertext = encrypted.body;
    payload.signal_type = encrypted.type;

    sendWS(payload);
    console.log("ааа", payload);
    console.log("ааа", encrypted);


    const tempMessage = {
        id: client_id,
        sender: {
            id: CURRENT_USER_ID,
            username: CURRENT_USERNAME
        },
        ciphertext: text,
        plaintext: text,
        signal_type: encrypted.type,
        created_at: new Date().toISOString(),
        delivery_status: "pending"
    };

    appendMessageToChat(chat_id, tempMessage);
    if (chat_id) updateChatPreview(chat_id, tempMessage);

    textarea.value = "";
    textarea.style.height = "auto";
    scrollChat(getSelectedChatEl());
}

export function replacePendingMessage(chat_id, newMsg) {
    if (chat_id !== getSelectedChat()) return;
    let selectedChatEl = getSelectedChatEl();

    const messageId = newMsg.client_id;
    console.log("replacePendingMessage", messageId);
    if (!messageId) {
        console.warn("Message has no id or client_id, appending instead");
        appendMessageToChat(chat_id, newMsg);
        return;
    }

    const pendingEl = selectedChatEl.querySelector(`[data-message-id="${messageId}"]`);

    if (pendingEl) {
         const textContainer = pendingEl.querySelector(".p-2 > div");
         newMsg.plaintext = textContainer?.textContent || "";

        const newEl = createMessageElement(newMsg);
        pendingEl.replaceWith(newEl);
        scrollChat(selectedChatEl);
    } else {
        appendMessageToChat(chat_id, newMsg);
    }
}

export function appendMessageToChat(chat_id, msg) {
    let selectedChatEl = getSelectedChatEl();
    if (chat_id !== getSelectedChat()) return;

    const messageEl = createMessageElement(msg);
    selectedChatEl.appendChild(messageEl);
}

export function scrollChat(selectedChatEl) {
    selectedChatEl.scrollTop = selectedChatEl.scrollHeight;
    const messages = Array.from(selectedChatEl.querySelectorAll(".message"));
    const lastNotMine = [...messages].reverse().find(msgEl => {
        const msgSenderId = parseInt(msgEl.dataset.senderId);
        return msgSenderId !== CURRENT_USER_ID;
    });

    if (lastNotMine) {
        const lastMessageId = parseInt(lastNotMine.dataset.messageId);
        sendReadReceipt(getSelectedChat(), lastMessageId);
    }
}


export function initSelectedChat(elementId) {
    setSelectedChatEl(document.getElementById(elementId));
}

export async function loadSelectedChat() {
    const chatId = getSelectedChat();
    if (!chatId) return;
    const res = await fetch(`/api/chat/chats/${chatId}/messages`);
    if (!res.ok) return;


    const chat = await res.json();

    try {
        await ensureSession(chat.members.find(m => m.id !== CURRENT_USER_ID).id);
    } catch (err) {
        console.error("Не удалось создать сессию для приватного чата", chatId, err);
    }

    initSelectedChatElements(chat);

    renderMessages(chat.messages);
}

export function initSelectedChatElements(chat) {
    let selectedChatEl = getSelectedChatEl();
    selectedChatEl.innerHTML = "";
    let chatName = chat.name;
    if (chat.type === "private") {
        const other = chat.members.find(m => m.id !== CURRENT_USER_ID);
        chatName = other ? other.username : "Unknown";
    }

    let headerEl = document.querySelector(".chat-header");
    headerEl.classList.remove("d-none");
    document.getElementById("chat-title").innerHTML = `${chatName}`;


    document.getElementById("chat-input").classList.remove("d-none");
}

function renderMessages(messages) {
    let selectedChatEl = getSelectedChatEl();
    if (!Array.isArray(messages)) {
        console.error("messages is not an array:", messages);
        return;
    }

    messages.forEach(msg => {
        const messageEl = createMessageElement(msg);
        selectedChatEl.appendChild(messageEl);
    });

    selectedChatEl.scrollTop = selectedChatEl.scrollHeight;
}

function createMessageElement(msg) {
    console.log(msg);
    const div = document.createElement("div");
    div.className = "message d-flex mb-2";
    div.dataset.messageId = msg.id || msg.client_id;

    const isMine = msg.sender.id === CURRENT_USER_ID;

    div.classList.add(isMine ? "justify-content-end" : "justify-content-start");


    const msgBubble = document.createElement("div");
    msgBubble.className = "p-2 rounded shadow-sm";
    if (isMine) {
        msgBubble.classList.add("bg-secondary", "text-white");
        div.classList.add("mine");
    } else {
        msgBubble.classList.add("bg-white", "text-dark");
    }
    msgBubble.style.maxWidth = "60%";

    const textDiv = document.createElement("div");
    try {
        textDiv.textContent = msg.plaintext;
    } catch {
        textDiv.textContent = "[invalid message]";
    }

    const infoDiv = document.createElement("div");
    if (isMine) {
        infoDiv.className = "d-flex justify-content-end align-items-center mt-1 small gap-1";
    } else {
        infoDiv.className = "d-flex justify-content-end align-items-center mt-1 small text-muted gap-1";
    }

    const timeSpan = document.createElement("span");
    timeSpan.textContent = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    infoDiv.appendChild(timeSpan);

    if (isMine) {
        const statusIcon = document.createElement("i");
        if (msg.delivery_status === "read") {
            statusIcon.className = "bi bi-check2-all";
        } else if (msg.delivery_status === "delivered") {
            statusIcon.className = "bi bi-check2";
        } else if (msg.delivery_status === "pending") {
            statusIcon.className = "bi bi-clock";
        } else {
            statusIcon.className = "";
        }
        statusIcon.classList.add("fs-5");
        infoDiv.appendChild(statusIcon);
    }

    msgBubble.appendChild(textDiv);
    msgBubble.appendChild(infoDiv);
    div.appendChild(msgBubble);
    if (readObserver && !isMine) {
        readObserver.observe(div);
    }

    return div;
}


export function markMessagesAsReadUpTo(chat_id, lastMessageId) {
    if (chat_id !== getSelectedChat()) return;

    const messages = document.querySelectorAll(".message");

    messages.forEach(msgEl => {
        const msgId = parseInt(msgEl.dataset.messageId);
        if (!msgId) return;

        if (!msgEl.classList.contains("mine")) return;

        if (msgId > lastMessageId) return;

        const statusIcon = msgEl.querySelector("i");
        if (statusIcon) {
            statusIcon.className = "bi bi-check2-all fs-5";
        }
    });
}


function sendReadReceipt(chat_id, last_message_id) {
    let lastMessageId = getLastReadMessageId();

    if (getLastReadMessageId() !== null && last_message_id <= lastMessageId) {
        return;
    }

    const payload = {
        type: "read_message",
        chat_id: chat_id,
        last_message_id: last_message_id
    };

    setLastReadMessageId(last_message_id);

    sendWS(payload);
}