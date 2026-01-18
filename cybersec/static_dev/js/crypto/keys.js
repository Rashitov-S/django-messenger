export async function generateAndStoreOneTimePreKeys(count, signalStore) {

    const preKeys = [];
    for (let i = 1; i <= count; i++) {
        const id = Math.floor(Math.random() * 2 ** 31);
        const keyPair_id = await libsignal.KeyHelper.generatePreKey(id);
        preKeys.push(keyPair_id);
        await signalStore.storePreKey(id, keyPair_id.keyPair);
    }
    return preKeys;
}

export async function generateAndStoreSignedPreKey(identityKeyPair, signalStore) {
    const keyId = Math.floor(Math.random() * 2 ** 31);
    const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(identityKeyPair, keyId);
    await signalStore.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair, signedPreKey.signature);

    return signedPreKey;
}

export async function generateAndStoreIdentity(backend) {
    const identityKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
    const registrationId = await libsignal.KeyHelper.generateRegistrationId();

    await backend.set("identityKey", identityKeyPair);
    await backend.set("registrationId", registrationId);

    return { identityKeyPair, registrationId };
}