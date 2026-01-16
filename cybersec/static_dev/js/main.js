import {
    handleNewChat,
    handleNewMessage,
    handleUpdateMessageStatus,
    initChatList,
    loadChats,
} from "./chat_list.js";
import {initReadObserver, initSelectedChat} from "./selected_chat.js";
import {socket} from "./chat_socket.js";
import {initUserSearch} from "./user_search.js";
import {buildKeyUploadPayload, refillPreKeysIfNeeded, uploadKeys} from "./crypto/api.js";
import {backend, signalStore} from "./crypto/signalStore.js";
import {generateAndStoreIdentity, generateAndStoreOneTimePreKeys, generateAndStoreSignedPreKey} from "./crypto/keys.js";


initChatList("chat-list");
initSelectedChat("selected-chat");
initUserSearch();
initReadObserver();

loadChats();


async function initSignalKeys() {
    await backend.load();

    const identityKey = await signalStore.getIdentityKeyPair();
    const registrationId = await signalStore.getLocalRegistrationId();

    console.log(identityKey);

    if (!identityKey || !registrationId) {
        console.log("Generating Signal keys for the first time...");


        const identityKeyRegistrationId = await generateAndStoreIdentity(backend);
        const oneTimePreKeys = await generateAndStoreOneTimePreKeys(50, signalStore);
        const signedPreKey = await generateAndStoreSignedPreKey(identityKeyRegistrationId.identityKeyPair, signalStore);

        const payload = buildKeyUploadPayload({
            registrationId: identityKeyRegistrationId.registrationId,
            identityKey: identityKeyRegistrationId.identityKeyPair,
            signedPreKey,
            oneTimePreKeys: oneTimePreKeys,
        });

        await uploadKeys(payload);

        console.log("Signal keys generated and uploaded to server.");
    } else {
        console.log("Signal keys already exist, skipping generation.");
    }
    await refillPreKeysIfNeeded(signalStore);

    setInterval(() => {
        refillPreKeysIfNeeded(signalStore);
    }, 5 * 60 * 1000);
}

await initSignalKeys();


socket.onmessage = async (e) => {
    const data = JSON.parse(e.data);
    console.log(data);
    switch (data.type) {
        case "new_message":
            await handleNewMessage(data.chat_id, data.message);
            break
        case "new_chat":
            handleNewChat(data.chat);
            break;
        case "read_receipt":
            handleUpdateMessageStatus(data.chat_id, data.last_message_id);
            break;
        case "typing":
            // TODO: сделать чтобы показывало кто печатает
            break;
        default:
            console.log("Unknown event type:", data.type);
    }
};