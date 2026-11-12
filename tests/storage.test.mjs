import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, memoryKv } from '../js/storage.js';
import { defaultData } from '../js/model.js';

function fakeFile() {
  let content = '';
  const f = {
    name: 'gitara-postepy.json',
    writes: 0,
    async queryPermission() { return 'granted'; },
    async requestPermission() { return 'granted'; },
    async getFile() { return { text: async () => content }; },
    async createWritable() {
      let buf = '';
      return { write: async (s) => void (buf += s), close: async () => { content = buf; f.writes++; } };
    },
  };
  return f;
}

const fakeLs = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

test('utwórz plik, "zamknij kartę", otwórz ponownie: dane są', async () => {
  const kv = memoryKv(); // IndexedDB przeżywa zamknięcie karty
  const ls = fakeLs();
  const file = fakeFile(); // plik na dysku
  const pickers = { showSaveFilePicker: async () => file, showOpenFilePicker: async () => [file] };

  const s1 = new Store({ kv, ls, pickers, delay: 5 });
  assert.equal((await s1.init()).state, 'needs-setup');
  const data = await s1.createFile(defaultData());
  data.sessions.push({ id: '1', date: '2026-11-10', startedAt: 'x', category: 'riffs', minutes: 20, itemIds: [], bpm: {}, notes: 'hej' });
  s1.scheduleSave(data);
  await s1.flush();

  const s2 = new Store({ kv, ls: fakeLs(), pickers, delay: 5 }); // nowa karta
  const r = await s2.init();
  assert.equal(r.state, 'ready');
  assert.equal(r.data.sessions.length, 1);
  assert.equal(r.data.sessions[0].notes, 'hej');
  assert.equal(r.data.items.length, 60);
});

test('autozapis łączy szybkie zmiany w jeden zapis i raportuje status', async () => {
  const file = fakeFile();
  const statuses = [];
  const s = new Store({ kv: memoryKv(), ls: fakeLs(), pickers: { showSaveFilePicker: async () => file, showOpenFilePicker: async () => [file] }, delay: 20, onStatus: (st) => statuses.push(st.kind) });
  const data = await s.createFile(defaultData());
  const before = file.writes;
  s.scheduleSave(data);
  s.scheduleSave(data);
  s.scheduleSave(data);
  await new Promise((r) => setTimeout(r, 60));
  await s.flush();
  assert.equal(file.writes - before, 1);
  assert.deepEqual(statuses, ['saving', 'saved']);
});

test('błąd zapisu daje status error', async () => {
  const file = fakeFile();
  const statuses = [];
  const s = new Store({ kv: memoryKv(), ls: fakeLs(), pickers: { showSaveFilePicker: async () => file, showOpenFilePicker: async () => [file] }, delay: 1, onStatus: (st) => statuses.push(st.kind) });
  const data = await s.createFile(defaultData());
  file.createWritable = async () => { throw new Error('dysk pełny'); };
  s.scheduleSave(data);
  await s.flush();
  assert.equal(statuses.at(-1), 'error');
});

test('brak uprawnień po ponownym otwarciu: needs-permission, connect() wczytuje dane', async () => {
  const kv = memoryKv();
  const file = fakeFile();
  const pickers = { showSaveFilePicker: async () => file, showOpenFilePicker: async () => [file] };
  const s1 = new Store({ kv, ls: fakeLs(), pickers, delay: 1 });
  await s1.createFile(defaultData());
  file.queryPermission = async () => 'prompt';
  const s2 = new Store({ kv, ls: fakeLs(), pickers, delay: 1 });
  assert.equal((await s2.init()).state, 'needs-permission');
  const data = await s2.connect();
  assert.equal(data.items.length, 60);
});

test('tryb awaryjny bez File System Access: localStorage', async () => {
  const ls = fakeLs();
  const s1 = new Store({ kv: memoryKv(), ls, pickers: {}, delay: 1 });
  assert.equal(s1.supported, false);
  const r = await s1.init();
  assert.equal(r.state, 'ready');
  r.data.sessions.push({ id: 'z', date: '2026-11-10', category: 'riffs', minutes: 5, itemIds: [], bpm: {}, notes: '' });
  s1.scheduleSave(r.data);
  await s1.flush();
  const r2 = await new Store({ kv: memoryKv(), ls, pickers: {}, delay: 1 }).init();
  assert.equal(r2.data.sessions.length, 1);
});
