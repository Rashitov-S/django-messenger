import {buildPreKeyBundlePayload, fetchPreKeyBundle} from "./api.js";
import {signalStore} from "./signalStore.js";


export async function ensureSession(recipientId) {
    const sessionExists = await hasSession(recipientId);
    if (!sessionExists) {
        const preKeyBundle = await fetchPreKeyBundle(recipientId);
        const preKeyPayload = buildPreKeyBundlePayload(preKeyBundle);

        const address = new libsignal.SignalProtocolAddress(recipientId, 1);
        const builder = new libsignal.SessionBuilder(signalStore, address);
        await builder.processPreKey(preKeyPayload);


        console.log("Session created for", recipientId);

    } else {
        console.log("Session already exists for", recipientId);
    }
}

export async function deleteSession(senderId) {
    try {
        const address = new libsignal.SignalProtocolAddress(senderId, 1);

        await signalStore.removeSession(address.toString());
        console.log(`Session deleted for ${senderId}`);


    } catch (err) {
        console.error(`Failed to delete session for ${senderId}:`, err);
    }
}


export async function hasSession(recipientId) {
    const address = new libsignal.SignalProtocolAddress(recipientId, 1);
    const session = await signalStore.loadSession(address.toString());
    return !!session;
}