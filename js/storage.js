import { defaultData, migrate } from './model.js';

const FILE_TYPES = [{ description: 'Postępy gitarowe (JSON)', accept: { 'application/json': ['.json'] } }];
const MODE_KEY = 'gitara.mode';
const DATA_KEY = 'gitara.data';

export function idbKv(dbName = 'gitara') {
  const open = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open(dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('kv', mode);
      const rq = fn(t.objectStore('kv'));
      t.oncomplete = () => {
        db.close();
        res(rq.result);
      };
      t.onerror = () => rej(t.error);
    });
  };
  return {
    get: (k) => run('readonly', (s) => s.get(k)),
    set: (k, v) => run('readwrite', (s) => s.put(v, k)),
    del: (k) => run('readwrite', (s) => s.delete(k)),
  };
}

export function memoryKv() {
  const m = new Map();
  return {
    get: async (k) => m.get(k),
    set: async (k, v) => void m.set(k, v),
    del: async (k) => void m.delete(k),
  };
}

// Tryb 'file': File System Access API (uchwyt w IndexedDB). Tryb 'local': localStorage (awaryjny).
export class Store {
  constructor({ kv, pickers = globalThis, ls = globalThis.localStorage, onStatus = () => {}, delay = 500, now = () => new Date() } = {}) {
    Object.assign(this, { kv, pickers, ls, onStatus, delay, now });
    this.handle = null;
    this.mode = 'local';
    this.pending = null;
    this.timer = null;
    this.chain = Promise.resolve();
  }

  get supported() {
    return typeof this.pickers.showSaveFilePicker === 'function' && typeof this.pickers.showOpenFilePicker === 'function';
  }

  get fileName() {
    return this.handle ? this.handle.name : null;
  }

  lsGet(k) {
    try {
      return this.ls.getItem(k);
    } catch {
      return null;
    }
  }

  lsSet(k, v) {
    try {
      this.ls.setItem(k, v);
    } catch {
      /* tryb prywatny itp. */
    }
  }

  // -> {state: 'ready', data} | {state: 'needs-permission'} | {state: 'needs-setup'} | {state: 'error', error}
  async init() {
    if (this.supported && this.lsGet(MODE_KEY) !== 'local') {
      let handle = null;
      try {
        handle = await this.kv.get('handle');
      } catch {
        /* IndexedDB niedostępne */
      }
      if (!handle) return { state: 'needs-setup' };
      this.handle = handle;
      this.mode = 'file';
      try {
        if ((await this.#permission(handle, false)) === 'granted') return { state: 'ready', data: await this.#read(handle) };
      } catch (e) {
        return { state: 'error', error: e.message };
      }
      return { state: 'needs-permission' };
    }
    this.mode = 'local';
    const raw = this.lsGet(DATA_KEY);
    if (raw) {
      try {
        return { state: 'ready', data: migrate(JSON.parse(raw)) };
      } catch (e) {
        return { state: 'error', error: e.message };
      }
    }
    if (!this.supported) {
      const data = defaultData();
      this.lsSet(DATA_KEY, JSON.stringify(data));
      return { state: 'ready', data };
    }
    return { state: 'needs-setup' };
  }

  // Wymaga gestu użytkownika (requestPermission).
  async connect() {
    if (!this.handle) throw new Error('Brak zapamiętanego pliku.');
    if ((await this.#permission(this.handle, true)) !== 'granted') throw new Error('Brak uprawnień do pliku.');
    return this.#read(this.handle);
  }

  async createFile(data) {
    const handle = await this.pickers.showSaveFilePicker({ suggestedName: 'gitara-postepy.json', types: FILE_TYPES });
    await this.#write(handle, JSON.stringify(data, null, 2));
    await this.#adopt(handle);
    return data;
  }

  async openFile() {
    const [handle] = await this.pickers.showOpenFilePicker({ types: FILE_TYPES, multiple: false, mode: 'readwrite' });
    if ((await this.#permission(handle, true)) !== 'granted') throw new Error('Brak uprawnień do zapisu w tym pliku.');
    const data = await this.#read(handle);
    await this.#adopt(handle);
    return data;
  }

  useLocal(data) {
    this.mode = 'local';
    this.handle = null;
    this.lsSet(MODE_KEY, 'local');
    this.lsSet(DATA_KEY, JSON.stringify(data));
    return data;
  }

  async disconnect() {
    await this.kv.del('handle');
    this.handle = null;
    this.mode = 'local';
  }

  scheduleSave(data) {
    this.pending = data;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  }

  flush() {
    clearTimeout(this.timer);
    if (this.pending) {
      const json = JSON.stringify(this.pending, null, 2);
      this.pending = null;
      this.chain = this.chain.then(() => this.#persist(json));
    }
    return this.chain;
  }

  async #adopt(handle) {
    await this.kv.set('handle', handle);
    this.handle = handle;
    this.mode = 'file';
    this.lsSet(MODE_KEY, 'file');
  }

  async #permission(handle, request) {
    const opts = { mode: 'readwrite' };
    let p = await handle.queryPermission(opts);
    if (p !== 'granted' && request) p = await handle.requestPermission(opts);
    return p;
  }

  async #read(handle) {
    const text = await (await handle.getFile()).text();
    if (!text.trim()) return defaultData();
    try {
      return migrate(JSON.parse(text));
    } catch (e) {
      throw new Error(`Nie można odczytać pliku: ${e.message}`);
    }
  }

  async #write(handle, json) {
    const w = await handle.createWritable();
    await w.write(json);
    await w.close();
  }

  async #persist(json) {
    this.onStatus({ kind: 'saving' });
    try {
      if (this.mode === 'file') await this.#write(this.handle, json);
      else this.ls.setItem(DATA_KEY, json);
      this.onStatus({ kind: 'saved', time: this.now() });
    } catch (e) {
      this.onStatus({ kind: 'error', message: e.message });
    }
  }
}
