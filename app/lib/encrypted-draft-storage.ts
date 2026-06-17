const DB_NAME = "fhir-soap-record-drafts";
const DB_VERSION = 1;
const KEY_STORE = "keys";
const KEY_ID = "clinical-draft-aes-gcm-v1";
const LOCAL_PREFIX = "encrypted-draft:";

// Clinical note drafts must survive crashes without exposing the httpOnly auth token.
// Keep the token server-only; browser storage contains only AES-GCM ciphertext.
type EncryptedDraftPayload = {
  algorithm: "AES-GCM";
  ciphertext: string;
  iv: string;
  updatedAt: string;
  version: 1;
};

function isBrowserCryptoAvailable() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.crypto?.subtle) &&
    typeof window.indexedDB !== "undefined"
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(KEY_STORE)) {
        database.createObjectStore(KEY_STORE);
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function readStoredKey(database: IDBDatabase) {
  return new Promise<CryptoKey | null>((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, "readonly");
    const request = transaction.objectStore(KEY_STORE).get(KEY_ID);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) ?? null);
  });
}

async function writeStoredKey(database: IDBDatabase, key: CryptoKey) {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, "readwrite");
    transaction.objectStore(KEY_STORE).put(key, KEY_ID);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

async function getDraftKey() {
  const database = await openDraftDatabase();
  try {
    const storedKey = await readStoredKey(database);
    if (storedKey) {
      return storedKey;
    }

    const key = await window.crypto.subtle.generateKey(
      { length: 256, name: "AES-GCM" },
      false,
      ["decrypt", "encrypt"],
    );
    await writeStoredKey(database, key);
    return key;
  } finally {
    database.close();
  }
}

export async function loadEncryptedDraft<T extends Record<string, string>>(
  storageKey: string,
) {
  if (typeof window === "undefined") {
    return null;
  }

  if (!isBrowserCryptoAvailable()) {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as Partial<T>) : null;
    } catch {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
  }

  const stored = window.localStorage.getItem(`${LOCAL_PREFIX}${storageKey}`);
  if (!stored) {
    return null;
  }

  try {
    const payload = JSON.parse(stored) as EncryptedDraftPayload;
    const key = await getDraftKey();
    const decrypted = await window.crypto.subtle.decrypt(
      { iv: base64ToBytes(payload.iv), name: "AES-GCM" },
      key,
      base64ToBytes(payload.ciphertext),
    );
    const text = new TextDecoder().decode(decrypted);
    return JSON.parse(text) as Partial<T>;
  } catch {
    window.localStorage.removeItem(`${LOCAL_PREFIX}${storageKey}`);
    return null;
  }
}

export async function persistEncryptedDraft(
  storageKey: string,
  value: Record<string, string>,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!isBrowserCryptoAvailable()) {
    window.sessionStorage.setItem(storageKey, JSON.stringify(value));
    return;
  }

  try {
    const key = await getDraftKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const ciphertext = await window.crypto.subtle.encrypt(
      { iv, name: "AES-GCM" },
      key,
      plaintext,
    );
    const payload: EncryptedDraftPayload = {
      algorithm: "AES-GCM",
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
      iv: bytesToBase64(iv),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    window.localStorage.setItem(`${LOCAL_PREFIX}${storageKey}`, JSON.stringify(payload));
    window.sessionStorage.removeItem(storageKey);
  } catch {
    window.sessionStorage.setItem(storageKey, JSON.stringify(value));
  }
}

export function clearEncryptedDraft(storageKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(`${LOCAL_PREFIX}${storageKey}`);
  window.sessionStorage.removeItem(storageKey);
}

export async function migratePlainSessionDraft<T extends Record<string, string>>(
  storageKey: string,
) {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.sessionStorage.getItem(storageKey);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<T>;
    await persistEncryptedDraft(storageKey, parsed as Record<string, string>);
    return parsed;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
}
