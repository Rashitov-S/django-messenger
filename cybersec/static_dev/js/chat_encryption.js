function getPrivateKey(userId) {
    const base64 = localStorage.getItem(`privateKey_user_${userId}`);
    if (!base64) throw new Error("Private key not found");
    return base64;
}

async function importPrivateKey(base64PrivateKey) {
    const keyBuffer = base64ToArrayBuffer(base64PrivateKey);
    return await crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        {name: "RSA-OAEP", hash: "SHA-256"},
        true,
        ["decrypt"]
    );
}

async function decryptAESKey(encryptedAESBase64, privateKey) {
    const encryptedBuffer = base64ToArrayBuffer(encryptedAESBase64);
    const aesRaw = await crypto.subtle.decrypt(
        {name: "RSA-OAEP"},
        privateKey,
        encryptedBuffer
    );

    console.log("aesRaw", new Uint8Array(aesRaw));
console.log("aesRaw.byteLength =", aesRaw.byteLength);
    return await crypto.subtle.importKey(
        "raw",
        aesRaw,
        {name: "AES-GCM"},
        true,
        ["encrypt", "decrypt"]
    );
}

async function getMyChatAESKey(chatId, userId) {
    const privateKeyBase64 = getPrivateKey(userId);
    const privateKey = await importPrivateKey(privateKeyBase64);

    const resp = await fetch(`/chat/${chatId}/aes_key/`, {credentials: "same-origin"});
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Failed to get AES key");

    console.log("Private key Base64:", privateKeyBase64);
console.log("Encrypted AES key from server:", data.encrypted_key);
testAESKeyDecryption(privateKeyBase64, data.encrypted_key);


    const aesKey = await decryptAESKey(data.encrypted_key, privateKey);
    return aesKey;
}

async function encryptMessageAES(aesKey, plaintext) {
    if (!(aesKey instanceof CryptoKey) || aesKey.algorithm.name !== "AES-GCM") {
        throw new TypeError("encryptMessageAES: параметр aesKey должен быть CryptoKey с алгоритмом AES-GCM");
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encoded
    );

    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);

    return arrayBufferToBase64(combined.buffer);
}

async function decryptMessageAES(aesKey, base64Message) {
    if (!base64Message) {
        throw new Error("decryptMessageAES: base64Message is undefined or empty");
    }
    const combined = new Uint8Array(base64ToArrayBuffer(base64Message));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        ciphertext
    );
    return new TextDecoder().decode(decrypted);
}

async function testAESKeyDecryption(privateKeyBase64, encryptedAESBase64) {
    const keyBuffer = base64ToArrayBuffer(privateKeyBase64);
    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
    );
    console.log("Private key imported");

    const encryptedBuffer = base64ToArrayBuffer(encryptedAESBase64);
    let aesRaw;
    try {
        aesRaw = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encryptedBuffer
        );
        console.log("AES key decrypted:", new Uint8Array(aesRaw));
        console.log("AES key length:", aesRaw.byteLength);
    } catch (err) {
        console.error("Ошибка дешифровки AES ключа:", err);
        return;
    }

    const aesKey = await crypto.subtle.importKey(
        "raw",
        aesRaw,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
    );

    console.log("AES CryptoKey создан:", aesKey);

    const message = "Test message";
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(message);
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encoded
    );
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        ciphertext
    );
    console.log("Decrypted test message:", new TextDecoder().decode(decrypted));
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