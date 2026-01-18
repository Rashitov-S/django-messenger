import {initSelectedChatElements} from "./selected_chat.js";
import {clearSelectedChat, getChats, getSelectedChatEl, setPendingRecipient, setPendingRecipientId} from "./state.js";
import {openChat} from "./chat_list.js";
import {ensureSession} from "./crypto/session.js";

export function initUserSearch() {
    const input = document.getElementById("user-search-input");
    const listWrapper = document.getElementById("user-list");
    const listEl = document.querySelector("#user-list ul");

    if (!input || !listEl) {
        console.warn("User search elements not found");
        return;
    }

    let searchTimeout = null;

    input.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchUsers(input.value, listWrapper, listEl);
        }, 300);
    });
}


export async function searchUsers(query, listWrapper, listEl) {
    const q = query.trim();

    if (!q) {
        listEl.innerHTML = "";
        listWrapper.classList.add("d-none");
        return;
    }

    const res = await fetch(`/api/users/user/?q=${encodeURIComponent(query)}`);
    if (!res.ok) return;

    const users = await res.json();
    renderUserList(users, listWrapper, listEl);
}

function renderUserList(users, listWrapper, listEl) {
    listEl.innerHTML = "";

    if (!users.length) {
        listWrapper.classList.add("d-none");
        return;
    }

    listWrapper.classList.remove("d-none");

    users.forEach(user => {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action";
        li.textContent = user.username;
        li.dataset.username = user.username;

        li.addEventListener("click", () => {
            openPrivateChat(user);
            listWrapper.classList.add("d-none");
        });

        listEl.appendChild(li);
    });
}

export async function openPrivateChat(user) {
    const existingChat = findPrivateChatWithUser(user.id);

    if (existingChat) {
        const input = document.getElementById("user-search-input");
         input.value = "";
        await openChat(existingChat.id);
        return;
    }
    let selectedChatEl = getSelectedChatEl();
    selectedChatEl.innerHTML = "";

    const chat = {
        id: null,
        type: "private",
        name: "",
        members: [
            {id: CURRENT_USER_ID, username: CURRENT_USERNAME},
            {id: user.id, username: user.username}
        ]
    };

    initSelectedChatElements(chat);
    setPendingRecipient(user.username);
    setPendingRecipientId(user.id);

    clearSelectedChat();


    try {
        await ensureSession(user.id);
    } catch (err) {
        console.error("Не удалось создать сессию для пользователя", user.id, err);
    }
}

function findPrivateChatWithUser(userId) {
    const chats = getChats();

    return chats.find(chat => {
        if (chat.type !== "private") return false;
        return chat.members.some(m => m.id === userId);
    });
}