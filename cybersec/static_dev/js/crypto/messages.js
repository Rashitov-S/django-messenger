import {signalStore} from "./signalStore.js";
import {fromBase64, toBase64} from "./utils.js";
import {ensureSession} from "./session.js";

export async function encryptMessage(recipientId, plaintext) {
    const address = new libsignal.SignalProtocolAddress(recipientId, 1);
    const sessionCipher = new libsignal.SessionCipher(signalStore, address);

    await ensureSession(recipientId);

   const ciphertext = await sessionCipher.encrypt(plaintext);

   // 3 - preKeyWhisper (первое сообщение), 1 - whisper (обычное сообщение)

    return {
        type: ciphertext.type,
        body: btoa(ciphertext.body),
    };
}

export async function decryptMessage(senderId, encrypted) {
    const address = new libsignal.SignalProtocolAddress(senderId, 1);
    const cipher = new libsignal.SessionCipher(signalStore, address);

    const bodyBytes = fromBase64(encrypted.body);

    const sessionRecord = await signalStore.loadSession(address.toString());
    if (sessionRecord) {
        const record = JSON.parse(sessionRecord);
        console.log('Session chains:', Object.keys(record.sessions));


        for (const sessionKey in record.sessions) {
            const session = record.sessions[sessionKey];
            console.log(`Session ${sessionKey} chains:`, Object.keys(session));
        }
    }

    let plaintext;
    if (encrypted.type === 3) {
        plaintext = await cipher.decryptPreKeyWhisperMessage(bodyBytes, "binary");
    } else {
        plaintext = await cipher.decryptWhisperMessage(bodyBytes, "binary");
    }

    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
}
