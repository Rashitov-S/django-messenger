export class SignalProtocolStoreIndexedDB {
    constructor(dbName = "signal_store") {
        this.dbName = dbName;
        this.db = null;
    }

    async load() {
        if (this.db) return;

        this.db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains("store")) {
                    db.createObjectStore("store");
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(key) {
        await this.load();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("store", "readonly");
            const store = tx.objectStore("store");
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async set(key, value) {
        await this.load();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("store", "readwrite");
            const store = tx.objectStore("store");
            const request = store.put(value, key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async remove(key) {
        await this.load();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("store", "readwrite");
            const store = tx.objectStore("store");
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllKeys() {
        await this.load();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("store", "readonly");
            const store = tx.objectStore("store");
            const request = store.getAllKeys();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}


export class SignalProtocolStore {
    constructor(backend) {
        this.backend = backend;
        this.Direction = {
            SENDING: 1,
            RECEIVING: 2,
        };
    }

    async get(key) {
        return this.backend.get(key);
    }

    async put(key, value) {
        return this.backend.set(key, value);
    }

    async getIdentityKeyPair() {
        return await this.backend.get("identityKey");
    }

    async getLocalRegistrationId() {
        return await this.backend.get("registrationId");
    }

    async saveIdentity(address, identityKey) {
        const existing = await this.backend.get(`identityKey${address}`);
        await this.backend.set(`identityKey${address}`, identityKey);
        return existing !== undefined;
    }

    async isTrustedIdentity(address, identityKey, direction) {
        const trusted = await this.backend.get(`identityKey${address}`);
        if (!trusted) return true;

        if (trusted.equals) return trusted.equals(identityKey);
        if (trusted.byteLength !== undefined && identityKey.byteLength !== undefined) {
            return this._bufferEqual(trusted, identityKey);
        }
        return JSON.stringify(trusted) === JSON.stringify(identityKey);
    }

    async loadPreKey(keyId) {
        return await this.backend.get(`25519KeypreKey${keyId}`);
    }

    async storePreKey(keyId, keyPair) {
        await this.backend.set(`25519KeypreKey${keyId}`, keyPair);
    }

    async removePreKey(keyId) {
        await this.backend.remove(`25519KeypreKey${keyId}`);
    }


    async loadSignedPreKey(keyId) {
        return await this.backend.get(`25519KeysignedKey${keyId}`);
    }

    async storeSignedPreKey(keyId, keyPair, signature) {
        await this.backend.set(`25519KeysignedKey${keyId}`, keyPair);


        await this.backend.set(`signedprekey_signature${keyId}`, signature);
    }

    async removeSignedPreKey(keyId) {
        await this.backend.remove(`25519KeysignedKey${keyId}`);
    }


    async loadSession(address) {
        return await this.backend.get(`session${address}`);
    }

    async storeSession(address, record) {
        await this.backend.set(`session${address}`, record);
    }

    async removeSession(address) {
        await this.backend.remove(`session${address}`);
    }

    async removeAllSessions(address) {
        const keys = await this.backend.getAllKeys();
        const prefix = `session${address}`;

        for (const key of keys) {
            if (key.startsWith(prefix)) {
                await this.backend.remove(key);
            }
        }
    }

    async loadLocalMessage(msg) {
        return await this.backend.get(`msg${msg.id}`);
    }
    async saveLocalMessage(msg) {
        return await this.backend.set(`msg${msg.id}`, msg)
    }

    async updateMessageByLocalId(serverMsg) {
    const localKey = `msg${serverMsg.client_id}`;
    const serverKey = `msg${serverMsg.id}`;

    const localMessage = await this.backend.get(localKey);
    if (!localMessage) return;

    const updatedMessage = {
        ...localMessage,
        id: serverMsg.id,
        delivery_status: "delivered",
        created_at: serverMsg.created_at ?? localMessage.created_at
    };

    await this.backend.set(serverKey, updatedMessage);

    await this.backend.remove(localKey);
}


    _bufferEqual(buf1, buf2) {
        if (buf1.byteLength !== buf2.byteLength) return false;
        const a = new Uint8Array(buf1);
        const b = new Uint8Array(buf2);
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
}


export const backend = new SignalProtocolStoreIndexedDB("astrocore_signal_store");
export const signalStore = new SignalProtocolStore(backend);