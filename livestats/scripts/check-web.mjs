import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const dist = new URL('../dist/', import.meta.url);
const html = await readFile(new URL('index.html', dist), 'utf8');
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dist), 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.id, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.start_url, '/');
assert.match(html, /viewport-fit=cover/);
assert.match(html, /manifest.webmanifest/);
assert.doesNotMatch(html, /__HOOPLOG_BG__/);
for (const icon of manifest.icons) {
  const png = await readFile(new URL(icon.src.slice(1), dist));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  assert.ok(png.readUInt32BE(16) >= 512);
}

const source = await readFile(new URL('sw.js', dist), 'utf8');
const origin = 'https://hooplog.test';
const handlers = new Map();
const cacheStore = new Map([['another-app', new Map()], ['hooplog-shell-obsolete', new Map()]]);
let online = true;
let networkCalls = 0;
const assetPaths = [];
function absolute(request) { return new URL(typeof request === 'string' ? request : request.url, origin).href; }
const context = {
  URL, Set,
  Request: class { constructor(url) { this.url = absolute(url); } },
  self: {
    location: { origin },
    addEventListener: (name, fn) => handlers.set(name, fn),
    skipWaiting: () => assert.fail('updates cannot interrupt scoring'),
    clients: { claim: () => assert.fail('do not take over an open version of the app') },
  },
  caches: {
    keys: async () => [...cacheStore.keys()],
    delete: async (name) => cacheStore.delete(name),
    open: async (name) => {
      if (!cacheStore.has(name)) cacheStore.set(name, new Map());
      const entries = cacheStore.get(name);
      return {
        addAll: async (requests) => {
          for (const request of requests) {
            const path = new URL(request.url).pathname;
            // Prove every listed offline asset actually exists in the export.
            const data = await readFile(new URL(path.slice(1), dist));
            assetPaths.push(path);
            entries.set(absolute(request), data.toString());
          }
        },
        match: async (request) => entries.get(absolute(request)),
      };
    },
  },
  fetch: async () => {
    networkCalls++;
    if (!online) throw new Error('offline');
    return 'NEW RELEASE FROM NETWORK';
  },
};
runInNewContext(source, context);
let pending;
handlers.get('install')({ waitUntil: (value) => { pending = value; } });
await pending;
assert.ok(assetPaths.includes('/index.html'));
assert.ok(assetPaths.some((path) => path.endsWith('.ttf')), 'fonts are offline');
assert.ok(assetPaths.some((path) => path.endsWith('.js')), 'app code is offline');
assert.ok(!assetPaths.includes('/sw.js'));
handlers.get('activate')({ waitUntil: (value) => { pending = value; } });
await pending;
assert.ok(cacheStore.has('another-app'), 'unrelated caches survive');
assert.ok(!cacheStore.has('hooplog-shell-obsolete'));

async function request(path, mode = 'navigate', method = 'GET') {
  let response;
  handlers.get('fetch')({
    request: { url: new URL(path, origin).href, mode, method },
    respondWith: (value) => { response = value; },
  });
  return response;
}
// Even when the origin has a newer release, an open game retains this shell.
assert.equal(await request('/game'), html);
assert.equal(networkCalls, 0);
online = false;
for (const path of ['/', '/game', '/history/match-1', '/player/p1', '/competition?key=summer']) {
  assert.equal(await request(path), html, `${path} must open offline`);
}
for (const path of assetPaths) assert.ok(await request(path, 'cors'), `${path} is precached`);
for (const path of ['/api/entitlement', '/auth/callback', '/checkout', '/webhooks/paddle']) {
  assert.equal(await request(path), undefined, `${path} must bypass offline cache`);
}
assert.equal(await request('/game', 'cors', 'POST'), undefined);
assert.equal(await request('https://payments.example/checkout'), undefined);
assert.equal(networkCalls, 0, 'offline scoring needs no network request');
console.log(`Web checks passed: install metadata, ${assetPaths.length} cached assets, offline routes, safe update policy, payment bypass.`);
