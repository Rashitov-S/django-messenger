import {fromBase64, toBase64} from "./utils.js";
import {generateAndStoreOneTimePreKeys} from "./keys.js";

export function buildKeyUploadPayload(data) {
    return {
        identity_key: toBase64(data.identityKey.pubKey),
        registration_id: data.registrationId,
        signed_prekey: {
            key_id: data.signedPreKey.keyId,
            public_key: toBase64(data.signedPreKey.keyPair.pubKey),
            signature: toBase64(data.signedPreKey.signature),
        },
        one_time_prekeys: data.oneTimePreKeys.map(pk => ({
            key_id: pk.keyId,
            public_key: toBase64(pk.keyPair.pubKey),
        })),
    };
}

export async function uploadKeys(payload) {
    const res = await fetch("/api/crypto/keys", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Key upload failed");
    return res.json();
}

export async function fetchPreKeyBundle(userId) {
    const res = await fetch(`/api/crypto/keys/${userId}`, {
        credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch keys bundle");
    return res.json();
}

export function buildPreKeyBundlePayload(data) {
    if (!data || !data.identity_key) {
        throw new Error('Missing identity_key in pre-key bundle');
    }
    if (!data.signed_prekey?.public_key) {
        throw new Error('Missing signed_prekey.public_key in pre-key bundle');
    }
    if (!data.signed_prekey?.signature) {
        throw new Error('Missing signed_prekey.signature in pre-key bundle');
    }

    return {
        identityKey: fromBase64(data.identity_key),
        registrationId: data.registration_id,
        signedPreKey: {
            keyId: data.signed_prekey.key_id,
            publicKey: fromBase64(data.signed_prekey.public_key),
            signature: fromBase64(data.signed_prekey.signature),
        },
        preKey: {
            keyId: data.one_time_prekey.key_id,
            publicKey: fromBase64(data.one_time_prekey.public_key),
        }

    }
}


export async function uploadOneTimePreKeys(preKeys) {
    const payload = {
        one_time_prekeys: preKeys.map(pk => ({
            key_id: pk.keyId,
            public_key: toBase64(pk.keyPair.pubKey)
        }))
    };

    const res = await fetch("/api/crypto/keys/prekeys", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Failed to upload prekeys");
    return res.json();
}

async function checkPreKeysStatus() {
    const res = await fetch("/api/crypto/keys/status", {credentials: "include"});
    if (!res.ok) throw new Error("Failed to get keys status");
    return res.json();
}

export async function refillPreKeysIfNeeded(signalStore) {
    const status = await checkPreKeysStatus();
    if (status.one_time_prekeys_can_upload > 0) {
        const newPreKeys = await generateAndStoreOneTimePreKeys(status.one_time_prekeys_can_upload, signalStore);

        await uploadOneTimePreKeys(newPreKeys);
        console.log(`Uploaded ${newPreKeys.length} new one-time prekeys`);
    } else {
        console.log("No prekeys need to be uploaded");
    }
}

