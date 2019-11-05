import { promisify, promisifyWithCursor } from "../util/idb";

const DB_VERSION = 22;

const LIVE_FRAGMENT_COUNT = 1000;
const LIVE_FRAGMENT_AGE = 1000 * 60 * 60 * 1; // 1 hour

const FRAGMENT_OBJECT_STORE_NAME = 'fragment';
const GROUP_STORE_NAME = 'group';

interface FragmentRecord {
  time: number;
  buffer: ArrayBuffer;
}

interface GroupRecord {
  time: number;
}

function getFragmentKey(url: string, name: string) {
  return url + ':' + name;
}

export default class FragmentStorage {
  constructor(public params: {
    url: string,
    forceKeepCache?: boolean
  }) {
  }
  private prepare: Promise<IDBDatabase> = (async () => {
    const request = indexedDB.open('lszr', DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;

      const names = db.objectStoreNames;
      if (names.contains(FRAGMENT_OBJECT_STORE_NAME)) {
        db.deleteObjectStore(FRAGMENT_OBJECT_STORE_NAME)
      }
      if (names.contains(GROUP_STORE_NAME)) {
        db.deleteObjectStore(GROUP_STORE_NAME);
      }

      const fragmentStore = db.createObjectStore(FRAGMENT_OBJECT_STORE_NAME);
      const groupStore = db.createObjectStore(GROUP_STORE_NAME);

      fragmentStore.createIndex('time', 'time', { unique: false });
      groupStore.createIndex('time', 'time', { unique: false });
    };
    const db = await promisify(request);
    if (!this.params.forceKeepCache) {
      this.clearExpired(db);
    }
    return db;
  })();

  public getFragment = async (name: string, signal?: AbortSignal): Promise<ArrayBuffer | undefined> => {
    const onabort = signal && signal.onabort;
    const db = await this.prepare.catch(() => { });
    if (!db) {
      return undefined;
    }
    try {
      const transaction = db.transaction([FRAGMENT_OBJECT_STORE_NAME, GROUP_STORE_NAME], 'readwrite');
      if (signal) {
        signal.onabort = transaction.abort;
      }
      const fragmentStore = transaction.objectStore(FRAGMENT_OBJECT_STORE_NAME);
      const groupStore = transaction.objectStore(GROUP_STORE_NAME);

      const key = getFragmentKey(this.params.url, name);
      const result = await promisify<FragmentRecord>(fragmentStore.get(key));
      if (!result) {
        return undefined;
      }

      promisify(groupStore.put({ time: Date.now() } as GroupRecord, this.params.url)).catch(console.warn);

      return result.buffer;
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return undefined;
      }
      console.error(err);
      return undefined;
    } finally {
      if (signal) {
        signal.onabort = onabort;
      }
    }
  }

  public putFragment = async (name: string, buffer: ArrayBuffer): Promise<void> => {
    const db = await this.prepare.catch(() => { });
    if (!db) {
      return;
    }
    try {
      const transaction = db.transaction([FRAGMENT_OBJECT_STORE_NAME, GROUP_STORE_NAME], 'readwrite');
      const fragmentStore = transaction.objectStore(FRAGMENT_OBJECT_STORE_NAME);
      const groupStore = transaction.objectStore(GROUP_STORE_NAME);

      const key = getFragmentKey(this.params.url, name);
      const fragmentPromise = promisify(fragmentStore.put({
        buffer,
        time: Date.now(),
      } as FragmentRecord, key));
      const groupPromise = promisify(groupStore.put({ time: Date.now() } as GroupRecord, this.params.url));
      await Promise.all([fragmentPromise, groupPromise]);
    } catch (err) {
      console.error(err);
    }
  }

  public clearExpired = async (db: IDBDatabase) => {
    const expire = Date.now() - LIVE_FRAGMENT_AGE;

    const transaction = db.transaction([FRAGMENT_OBJECT_STORE_NAME, GROUP_STORE_NAME], 'readwrite');
    const fragmentStore = transaction.objectStore(FRAGMENT_OBJECT_STORE_NAME);
    const groupStore = transaction.objectStore(GROUP_STORE_NAME);

    const fragmentTimeIndex = fragmentStore.index('time');
    const groupTimeIndex = groupStore.index('time');

    const urls = [this.params.url];

    const count = await promisify(fragmentTimeIndex.count());
    let deleteCount = count - LIVE_FRAGMENT_COUNT;
    if (deleteCount < 1) {
      return;
    }

    await promisifyWithCursor(groupTimeIndex.openCursor(), (cursor) => {
      const group = cursor.value as GroupRecord;
      const key = cursor.primaryKey as string;
      if (this.params.url === key) {
        return;
      }
      if (group.time > expire) {
        urls.push(key);
        return;
      }
      cursor.delete();
    });

    await promisifyWithCursor(fragmentTimeIndex.openCursor(), (cursor) => {
      const key = cursor.primaryKey as string;

      if (urls.find((c) => key.startsWith(c))) {
        return;
      }
      if (deleteCount < 0) {
        return true;
      }
      cursor.delete();
      deleteCount--;
    });
  }

}


