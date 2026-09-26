/**
 * История результатов AI-инструментов. Хранится локально в IndexedDB,
 * чтобы результат не терялся, если окно инструмента случайно закрылось.
 */
export type ToolKind = 'face-swap' | 'logo-remover' | 'object-remover' | 'skin-retouch' | 'humanizer';

export interface ToolHistoryItem {
  id: string;
  tool: ToolKind;
  createdAt: number;
  /** data:image/... для фото-инструментов */
  image?: string;
  /** текст для Humanizer */
  text?: string;
}

export const TOOL_LABELS: Record<ToolKind, string> = {
  'face-swap': 'Перенос лица',
  'logo-remover': 'Убрать лого',
  'object-remover': 'Удалить объект',
  'skin-retouch': 'Ретушь фото',
  humanizer: 'Humanizer',
};

const DB_NAME = 'tools_history';
const STORE = 'items';
const MAX_ITEMS = 60;
export const HISTORY_EVENT = 'tools-history-changed';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const tx = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req ? (req.result as T) : undefined);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
};

export const listHistory = async (): Promise<ToolHistoryItem[]> => {
  try {
    const all = (await tx<ToolHistoryItem[]>('readonly', (s) => s.getAll())) || [];
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    console.error('tools history read failed', e);
    return [];
  }
};

export const addToHistory = async (item: Omit<ToolHistoryItem, 'id' | 'createdAt'>) => {
  try {
    const full: ToolHistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    await tx('readwrite', (s) => s.put(full));
    const all = await listHistory();
    if (all.length > MAX_ITEMS) {
      const extra = all.slice(MAX_ITEMS).map((i) => i.id);
      await tx('readwrite', (s) => {
        extra.forEach((id) => s.delete(id));
      });
    }
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch (e) {
    console.error('tools history write failed', e);
  }
};

export const removeFromHistory = async (id: string) => {
  await tx('readwrite', (s) => s.delete(id));
  window.dispatchEvent(new Event(HISTORY_EVENT));
};

export const clearHistory = async () => {
  await tx('readwrite', (s) => s.clear());
  window.dispatchEvent(new Event(HISTORY_EVENT));
};
