import { classify, clearFault, reportFault } from '../lib/fault';
import { OURS, type KeyStore } from './storage';

/**
 * THE WEB DISK, AND IT IS NOT `localStorage` ANY MORE.
 *
 * `@react-native-async-storage/async-storage` has a web build, and that build
 * is `window.localStorage` — a one-line fact with three consequences that all
 * land on the same scorer:
 *
 * 1. **About 5MB for the whole origin**, and this app fills it. Thirty saved
 *    games at `HISTORY_CAP` are 2MB or so of JSON, and a club crest is allowed
 *    to be `WEB_LOGO_MAX_LENGTH` — 800,000 characters, which `localStorage`
 *    counts in UTF-16 and therefore bills as 1.6MB. A season and a badge is
 *    most of the budget before anything goes wrong.
 * 2. **The failure is silent.** Past the line every write throws
 *    `QuotaExceededError`, and every writer in this app drops the promise it
 *    got back. The board keeps taking taps and none of them are kept.
 *    `lib/fault.ts` is the other half of the answer; the room here is the
 *    first half.
 * 3. **It is synchronous**, on the same thread as the court.
 *
 * IndexedDB has none of those problems: its quota is a share of the actual free
 * disk rather than a fixed 5MB, it is asynchronous, and it reports a full disk
 * by aborting a transaction where we can see it. Every browser this app runs on
 * has it.
 *
 * There is no library here on purpose. This is a key-value store with four
 * operations over a single object store — about forty lines of raw `IDBRequest`
 * plumbing, which is less than the cost of a dependency the native build would
 * have to carry as well.
 *
 * ## THE MIGRATION RUNS ONCE, INSIDE THE UPGRADE
 *
 * An install that has been scoring since before this file has a season sitting
 * in `localStorage`, and it must not lose it. The copy therefore happens in
 * `onupgradeneeded` — the one place a synchronous `localStorage` read and an
 * IndexedDB write share a transaction — so the new database is either created
 * WITH the old data in it or not created at all.
 *
 * The old keys are deleted only after that transaction COMMITS, and the order
 * is the whole safety of it: a crash in between leaves the data in both places,
 * which costs a few megabytes until the next launch, while the other order
 * would lose a season to a badly timed refresh.
 *
 * ## IF INDEXEDDB WILL NOT OPEN, `localStorage` STANDS IN
 *
 * Private browsing, storage switched off, an origin the browser has decided to
 * distrust — the database can simply refuse, and in one long-standing Firefox
 * case the open request never settles at all, which is why there is a timeout
 * beside it. Falling back to the small, cramped, synchronous store is much
 * better than an app that will not start, and the scorer is not told: what they
 * would be told is "storage is smaller than usual", which is not an action.
 * They hear about it through `lib/fault.ts` if and when a write actually
 * fails, which is the moment it becomes theirs to do something about.
 */

const DB_NAME = 'hooplog';
const STORE_NAME = 'kv';

/** Firefox private browsing can leave `open()` pending for ever. */
const OPEN_TIMEOUT = 4000;

/** Wrap one `IDBRequest` as a promise. Every operation below is built on it. */
function ask<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * EVERY KEY THIS APP OWNS, READ SYNCHRONOUSLY. Only used by the migration and
 * the fallback, and only ever against `localStorage`, where `length` and
 * `key(i)` are the whole API.
 */
function legacyKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && OURS.test(key)) out.push(key);
    }
  } catch {
    /* storage refused: there is nothing to migrate */
  }
  return out;
}

/** The old keys, dropped only once the new database owns them. */
function dropLegacy(keys: string[]): void {
  try {
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    /* the copy is safe; the space is simply not reclaimed until next time */
  }
}

let opening: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (opening) return opening;

  opening = new Promise<IDBDatabase | null>((resolve) => {
    let settled = false;
    const done = (db: IDBDatabase | null): void => {
      if (settled) return;
      settled = true;
      resolve(db);
    };

    // the open call itself can throw where the API is present but disabled, so
    // the whole thing is inside the guard
    try {
      if (typeof indexedDB === 'undefined') {
        done(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, 1);
      const timer = setTimeout(() => done(null), OPEN_TIMEOUT);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (db.objectStoreNames.contains(STORE_NAME)) return;
        const store = db.createObjectStore(STORE_NAME);

        // THE MIGRATION, inside the versionchange transaction on purpose: the
        // database is created with the season already in it, or not at all.
        const moved = legacyKeys();
        for (const key of moved) {
          const value = window.localStorage.getItem(key);
          if (value !== null) store.put(value, key);
        }
        // and the old copy goes only once this has COMMITTED
        const upgrade = request.transaction;
        if (moved.length && upgrade) upgrade.oncomplete = () => dropLegacy(moved);
      };

      request.onsuccess = () => {
        clearTimeout(timer);
        const db = request.result;
        // A CLOSED CONNECTION MUST NOT BE CACHED FOR THE LIFE OF THE TAB.
        // The browser closes one when it reclaims storage, and another tab
        // upgrading the database closes it too — every transaction afterwards
        // throws, and a memoised promise would hand out the dead handle for
        // ever. Forgetting it here means the next call opens a fresh one.
        db.onclose = () => {
          if (opening) opening = null;
        };
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        done(db);
      };
      request.onerror = () => {
        clearTimeout(timer);
        done(null);
      };
      // another tab holds a version open; the fallback is correct for now and
      // the next launch gets the database
      request.onblocked = () => {
        clearTimeout(timer);
        done(null);
      };
    } catch {
      done(null);
    }
  });

  return opening;
}

/**
 * One transaction, one operation, and `null` when there is no database at all —
 * which is the signal every caller below turns into the `localStorage` path.
 *
 * The transaction's own outcome is awaited beside the request's, because a full
 * disk ABORTS the transaction rather than failing the request: waiting on the
 * request alone is how a quota error stays invisible.
 */
async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;

  const transaction = db.transaction(STORE_NAME, mode);
  const settled = transaction.mode === 'readonly'
    ? Promise.resolve()
    : new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error('aborted'));
        transaction.onerror = () => reject(transaction.error ?? new Error('failed'));
      });

  const [value] = await Promise.all([run(transaction.objectStore(STORE_NAME)), settled]);
  return value;
}

/* ---- the fallback --------------------------------------------------- */

/**
 * `localStorage`, used only where IndexedDB refused to open. It is the old
 * behaviour exactly, faults included — which is the point of keeping it: a
 * cramped store that SAYS when it is full is what this file is about.
 */
const legacy = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    window.localStorage.setItem(key, value);
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nothing to tell */
    }
  },
};

/* ---- the door -------------------------------------------------------- */

/** The write both public forms share, so they cannot drift apart. */
async function put(key: string, value: string): Promise<void> {
  const done = await tx('readwrite', async (store) => {
    await ask(store.put(value, key));
    return true;
  });
  if (done === null) legacy.set(key, value);
  clearFault();
}

export const Store: KeyStore = {
  getItem: async (key) => {
    try {
      const value = await tx('readonly', (store) => ask<unknown>(store.get(key)));
      if (value === null) return legacy.get(key);
      return typeof value === 'string' ? value : null;
    } catch {
      // a read that fails is a key that is not there as far as every caller is
      // concerned, and each store already falls back to its own defaults
      return null;
    }
  },

  setItem: async (key, value) => {
    try {
      await put(key, value);
    } catch (error) {
      reportFault(classify(error));
    }
  },

  write: async (key, value) => {
    try {
      await put(key, value);
    } catch (error) {
      reportFault(classify(error));
      throw error;
    }
  },

  removeItem: async (key) => {
    try {
      const done = await tx('readwrite', async (store) => {
        await ask(store.delete(key));
        return true;
      });
      if (done === null) legacy.remove(key);
    } catch {
      /* a removal that fails is not a fault; see the native door */
    }
  },

  keys: async () => {
    try {
      const all = await tx('readonly', (store) => ask(store.getAllKeys()));
      if (all === null) return legacyKeys();
      return all.filter((k): k is string => typeof k === 'string' && OURS.test(k));
    } catch {
      return [];
    }
  },
};
