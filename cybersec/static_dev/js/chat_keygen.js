function base64ToArrayBuffer(base64) {
    base64 = base64.replace(/\s+/g, '');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function generateAESKey() {
    return await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

async function exportAESKey(key) {
    return await crypto.subtle.exportKey("raw", key);
}

async function encryptAESForUser(aesKeyRaw, publicKeyBase64) {
     if (!publicKeyBase64) {
        throw new Error("Public key пользователя отсутствует");
    }
    const pubKeyBuffer = base64ToArrayBuffer(publicKeyBase64);

    const pubKey = await crypto.subtle.importKey(
        "spki",
        pubKeyBuffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        true,
        ["encrypt"]
    );

    const encrypted = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        pubKey,
        aesKeyRaw
    );

    return arrayBufferToBase64(encrypted);
}
async function createChatWithUser(username, participantsPublicKeys) {
    console.log(participantsPublicKeys);
    try {
        const aesKey = await generateAESKey();
        const aesKeyRaw = await exportAESKey(aesKey);

        const encryptedKeys = {};
        for (const [userId, pubKeyBase64] of Object.entries(participantsPublicKeys)) {
              if (!pubKeyBase64) {
                throw new Error(`Public key пользователя ${userId} отсутствует`);
            }
            encryptedKeys[userId] = await encryptAESForUser(aesKeyRaw, pubKeyBase64);
        }
        function getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
        }

        const csrftoken = getCookie('csrftoken');
        const response = await fetch(`/chat/with/${username}/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrftoken},
            credentials: "same-origin",
            body: JSON.stringify({ encrypted_keys: encryptedKeys })
        });


        const data = await response.json();

        if (data.success) {
            window.location.href = `/chat/${data.chat_id}/`;
        } else {
            alert(data.error);
        }
    } catch (err) {
        console.error("Ошибка при создании чата:", err);
        alert("Произошла ошибка при создании чата");
    }
}

async function getUserPublicKey(username) {
    const resp = await fetch(`/users/${username}/public_key/`, { credentials: "same-origin" });
    if (!resp.ok) {
        throw new Error("Не удалось получить публичный ключ пользователя " + username);
    }
    const data = await resp.json();

    if (!data.public_key) {
        throw new Error("Public key не получен для пользователя " + username);
    }

    return data.public_key;
}

