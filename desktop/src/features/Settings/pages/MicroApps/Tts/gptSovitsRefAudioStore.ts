const DB_NAME = "uichat-mira-tts-studio";
const STORE_NAME = "gpt-sovits-ref-audios";
const DB_VERSION = 1;

export type StoredGptSovitsRefAudio = {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  createdAt: string;
  blob: Blob;
};

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () =>
      reject(request.error ?? new Error("打开参考音频存储失败"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => Promise<T>,
) => {
  const db = await openDb();

  try {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = await runner(store);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("参考音频存储事务失败"));
      tx.onabort = () => reject(tx.error ?? new Error("参考音频存储事务已中断"));
    });

    return result;
  } finally {
    db.close();
  }
};

const readRequest = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("读取参考音频存储失败"));
  });

export const listStoredGptSovitsRefAudios = () =>
  withStore("readonly", async (store) => {
    const result = await readRequest(store.getAll() as IDBRequest<StoredGptSovitsRefAudio[]>);
    return result.sort((left, right) => right.lastModified - left.lastModified);
  });

export const saveStoredGptSovitsRefAudio = async (file: File) => {
  const record: StoredGptSovitsRefAudio = {
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    size: file.size,
    type: file.type || "audio/wav",
    lastModified: file.lastModified,
    createdAt: new Date().toISOString(),
    blob: file,
  };

  await withStore("readwrite", async (store) => {
    store.put(record);
    return undefined;
  });

  return record;
};

export const deleteStoredGptSovitsRefAudio = (id: string) =>
  withStore("readwrite", async (store) => {
    store.delete(id);
    return undefined;
  });

export const toStoredGptSovitsRefAudioFile = (record: StoredGptSovitsRefAudio) =>
  new File([record.blob], record.name, {
    type: record.type || "audio/wav",
    lastModified: record.lastModified,
  });
