const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function loader(mocks = {}) {
  const cache = {};
  return function load(name) {
    if (name in mocks) return mocks[name];
    if (!name.startsWith('@/')) return require(name);
    if (cache[name]) return cache[name].exports;
    const filename = path.join(__dirname, '..', name.slice(2) + '.ts');
    const module = { exports: {} }; cache[name] = module;
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require: load, crypto: global.crypto, console, setTimeout }, { filename });
    return module.exports;
  };
}
function fixture(cloud = false) {
  const disk = new Map();
  const state = { fail: false, settingsFail: false, delay: null, cloudFail: false };
  const load = loader({
    '@/lib/persist': { persist: {
      getItem: async (key) => disk.get(key) ?? null,
      setItem: async (key, value) => {
        if (state.delay && key === 'hygiene:reports') await state.delay;
        if (state.fail || (state.settingsFail && key === 'hygiene:settings')) throw new Error('disk full');
        disk.set(key, value);
      },
    } },
    '@/lib/firebase': { isCloudEnabled: cloud },
    '@/store/authStore': { useAuthStore: { getState: () => ({ org: { id: 'org-a' } }) } },
    '@/lib/cloudReports': {
      cloudFetchReports: async () => { if(state.cloudFail) throw new Error('offline'); return []; },
      cloudUpsertReport: async r => r,
      cloudDeleteReport: async () => {},
    },
  });
  return { store: load('@/store/reportStore').useReportStore, state, disk, load };
}
(async () => {
  const f = fixture(); const get = () => f.store.getState();
  assert.equal(await get().createReport(get().draftReport()), false, 'block writes before hydration');
  await get().hydrate();
  const draft = { ...get().draftReport(), company: 'A社', storeName: '店舗A' };
  assert.equal(await get().createReport(draft), true);
  const id = get().reports[0].id;
  f.state.fail = true;
  assert.equal(await get().updateReport(id, { comment: 'must not commit' }), false);
  assert.equal(get().reports[0].comment, '');
  assert.equal(get().reports.length, 1);
  f.state.fail = false;
  let release; f.state.delay = new Promise(r => release = r);
  const pending = get().createReport({ ...draft, storeName: '店舗B' });
  assert.equal(await get().createReport({ ...draft, storeName: '店舗C' }), false);
  release(); assert.equal(await pending, true); f.state.delay = null;
  assert.equal(get().reports.length, 2);
  f.state.settingsFail = true;
  assert.equal(await get().createReport({ ...draft, storeName: '店舗D' }), true);
  assert.equal(get().reports.length, 3, 'settings failure must retain saved reports');
  assert.equal(await get().updateReport('missing', {comment:'x'}), false);
  f.store.setState({hydrated:false, reports:[]}); await get().hydrate();
  assert.equal(get().reports.length,3, 'saved records survive reload');
  const c = fixture(true); c.state.cloudFail = true; await c.store.getState().hydrate();
  assert.equal(c.store.getState().hydrated, false, 'failed fetch stays retryable');
  c.state.cloudFail = false; await c.store.getState().hydrate(); assert.equal(c.store.getState().hydrated, true);
  const { calcBilling } = f.load('@/lib/billing');
  assert.equal(calcBilling({...draft, ratControl:{...draft.ratControl, done:true}}).rat,0);
  assert.equal(calcBilling({...draft, ratControl:{...draft.ratControl, done:true,initialFee:1234,monthlyFee:500}}).rat,1734);
  const { companyStores } = f.load('@/lib/companyStores');
  const rows = [{company:'A',storeName:'a'},{company:'B',storeName:'b'},{company:'A',storeName:'a'}];
  assert.equal(JSON.stringify(companyStores(rows,'A')), '["a"]');
  assert.equal(companyStores(rows,'').length,0);
  console.log('PASS: save failures, concurrent saves, reload, missing records, cloud retry, manual billing, company filtering');
})().catch(e=>{console.error(e);process.exitCode=1;});

// IndexedDB writes must finish their transaction before reporting success.
(async () => {
  let transaction;
  const request = { result: undefined };
  const db = { transaction: () => transaction = { objectStore: () => ({ put: () => request }) } };
  const idb = { open: () => {
    const open = {result: db}; queueMicrotask(() => open.onsuccess()); return open;
  } };
  const source = fs.readFileSync(path.join(__dirname, '../lib/persist.ts'),'utf8');
  const module = {exports:{}};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {
    module, exports:module.exports, indexedDB:idb,
    require: n => n === 'react-native' ? {Platform:{OS:'web'}} : {storage:{}},
  });
  let settled=false;
  const saving=module.exports.persist.setItem('reports','[]').then(()=>settled=true);
  await new Promise(r=>setImmediate(r));
  request.onsuccess?.(); await Promise.resolve(); assert.equal(settled,false);
  transaction.oncomplete(); await saving; assert.equal(settled,true);
  const failure=module.exports.persist.setItem('reports','[]');
  await new Promise(r=>setImmediate(r));
  transaction.onabort(); await assert.rejects(failure,/aborted/);
  console.log('PASS: IndexedDB commit and abort');
})().catch(e=>{console.error(e);process.exitCode=1;});

const load = loader();
const { makeDefaultReport, DEFAULT_SETTINGS } = load('@/constants/hygiene');
const { buildReportHtml, buildReportsHtml } = load('@/lib/reportHtml');
const portrait = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#dceafa"/><rect x="25" y="25" width="550" height="850" rx="20" fill="none" stroke="#245ab2" stroke-width="10"/><circle cx="300" cy="300" r="120" fill="#5589cd"/><path d="M80 820L300 450 520 820Z" fill="#8ab0df"/><text x="300" y="95" text-anchor="middle" font-size="40">Portrait 2:3</text></svg>').toString('base64');
const report = {...makeDefaultReport(DEFAULT_SETTINGS), storeName:'確認用店舗',company:'確認用会社',workDate:'2026-10-28',photos:[{id:'p',uri:portrait,category:'店舗外観',caption:'縦写真（全体表示）'}]};
const html = buildReportHtml(report,'株式会社店舗ドクター');
assert.ok(html.includes('発行元：株式会社店舗ドクター'));
assert.ok(buildReportsHtml([report,report],'株式会社店舗ドクター').includes('発行元：株式会社店舗ドクター'));
assert.ok(html.includes('repeat(2,minmax(0,1fr))'));
if (process.env.QA_HTML_PATH) fs.writeFileSync(process.env.QA_HTML_PATH,html);
console.log('PASS: individual and combined report HTML, portrait layout');
