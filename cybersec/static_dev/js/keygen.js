async function generateUserKeys(userId) {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]
    );

    const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);

    const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    localStorage.setItem(privateKeyStorageKey(userId), arrayBufferToBase64(privateKey));

    await fetch("/users/save_public_key/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({public_key: arrayBufferToBase64(publicKey)})
    });

    console.log("RSA ключи сгенерированы и публичный ключ отправлен на сервер");
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

function privateKeyStorageKey(userId) {
    return `privateKey_user_${userId}`;
}

function publicKeyStorageKey(userId) {
    return `publicKey_user_${userId}`;
}
