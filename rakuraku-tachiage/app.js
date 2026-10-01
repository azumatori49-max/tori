(() => {
  'use strict';

  const SEED = window.RAKU_SEED;
  const KEY = 'rakuraku-tachiage:v1';
  // デモ表示（Artifact など、ダウンロード・confirm・URLハッシュが使えない環境）
  const DEMO = !!window.RAKU_DEMO;
  if (DEMO) document.documentElement.classList.add('demo');

  const FLAGS = [
    { k: 'credit', label: 'クレジット端末', group: 'pay' },
    { k: 'qr', label: 'QRコード・電子', group: 'pay' },
    { k: 'pay', label: 'PAY提出', group: 'pay' },
    { k: 'lnApply', label: '深夜申請', group: 'night' },
    { k: 'lnPermit', label: '深夜営業許可', group: 'night' },
    { k: 'smoke', label: '喫煙申請', group: 'night' },
  ];
  const PAY = FLAGS.filter((f) => f.group === 'pay');
  const METHODS = [['電子', '電子'], ['要確認', '要確認'], ['', '未設定']];
  const INFO_FIELDS = [
    { k: 'openDate', label: 'オープン日', type: 'date' },
    { k: 'moveIn', label: '入居日・鍵預かり日', type: 'date' },
    { k: 'handover', label: '工事引渡し日', type: 'date' },
    { k: 'owner', label: '立ち上げ責任者', type: 'text' },
    { k: 'am', label: '担当AM', type: 'text' },
    { k: 'manager', label: '店長', type: 'text' },
    { k: 'zip', label: '〒', type: 'text', mode: 'numeric' },
    { k: 'address', label: '住所', type: 'text' },
    { k: 'tel', label: '電話番号', type: 'tel' },
    { k: 'beer', label: 'ビールメーカー', type: 'text' },
    { k: 'rent', label: '家賃', type: 'text' },
  ];
  const CATS = SEED.cats || [];
  const OTHER = 'その他';
  const TITLE_CAT = {};
  SEED.templates.forEach((tp) => tp.tasks.forEach((t) => { if (t.c && !TITLE_CAT[t.t]) TITLE_CAT[t.t] = t.c; }));
  const catOf = (t) => (CATS.includes(t.c) ? t.c : OTHER);
  const HOME_FILTERS = [
    ['all', 'すべて'],
    ['launching', '立ち上げ中'],
    ['payOpen', '決済未完了'],
    ['night', '深夜営業'],
    ['smoke', '喫煙申請'],
    ['電子', '電子'],
    ['要確認', '要確認'],
  ];

  const svg = (d, extra = '') =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  const I = {
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/>'),
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
    chev: svg('<path d="M9 5l7 7-7 7"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.6"'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
    more: svg('<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>', 'stroke-width="3"'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  };

  // ---------- 状態 ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const makeTasks = (tplId) => {
    const tpl = SEED.templates.find((t) => t.id === tplId);
    return tpl ? tpl.tasks.map((t) => ({ id: uid(), t: t.t, c: t.c || '', who: t.who || '', h: t.h, done: false, date: '', person: '', memo: '' })) : [];
  };

  const makeStore = (x = {}) => ({
    id: uid(),
    name: x.name || '',
    method: x.method || '',
    eisei: x.eisei || '',
    bouka: x.bouka || '',
    note: x.note || '',
    credit: !!x.credit,
    qr: !!x.qr,
    pay: !!x.pay,
    lnApply: !!x.lnApply,
    lnPermit: !!x.lnPermit,
    smoke: !!x.smoke,
    docs: {},
    info: {},
    launch: null,
  });

  const pad2 = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const addDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return isoDate(d);
  };

  // デモ用: 進行中の立ち上げチェックがどう見えるかを示すサンプル店舗
  const sampleStore = () => {
    const s = makeStore({ name: '新宿東口（サンプル）', method: '電子', credit: true, qr: true, note: 'デモ用のサンプルです' });
    s.launch = { tpl: 'toriyaro', tasks: makeTasks('toriyaro') };
    s.launch.tasks.forEach((t, i) => {
      const ci = CATS.indexOf(t.c);
      t.done = ci >= 0 && (ci < 3 || (ci === 3 && i % 2 === 0));
    });
    const next = s.launch.tasks.find((t) => !t.done);
    next.date = addDays(-3);
    next.memo = '業者に見積もりを依頼済み';
    s.info.openDate = addDays(14);
    s.info.moveIn = addDays(-21);
    return s;
  };

  const seedState = () => {
    const stores = SEED.stores.map(makeStore);
    if (DEMO) stores.unshift(sampleStore());
    return { v: 1, stores };
  };

  let storageOK = true;

  const normalize = (raw) => {
    if (!raw || raw.v !== 1 || !Array.isArray(raw.stores)) return null;
    raw.stores.forEach((s) => {
      Object.assign(s, { ...makeStore(), ...s });
      s.docs = s.docs || {};
      s.info = s.info || {};
      if (s.launch && !Array.isArray(s.launch.tasks)) s.launch = null;
      if (s.launch) {
        s.launch.tasks.forEach((t) => {
          if (t.c === undefined) t.c = TITLE_CAT[t.t] || '';
          t.who = String(t.who || '').trim();
        });
      }
    });
    return raw;
  };

  const load = () => {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch (e) {
      storageOK = false;
    }
    if (raw) {
      try {
        const st = normalize(JSON.parse(raw));
        if (st) return st;
      } catch (e) {
        /* 読み出せない保存データは下で退避する */
      }
      // 読み出せない保存データは、初期データで上書きされる前に退避しておく
      try {
        localStorage.setItem(`${KEY}:broken`, raw);
      } catch (e) {
        /* 退避できなくても起動は続ける */
      }
    }
    return seedState();
  };

  let state = load();
  let saveTimer = 0;
  let pending = false;
  let warned = false;

  const save = () => {
    clearTimeout(saveTimer);
    pending = false;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storageOK = true;
      warned = false;
    } catch (e) {
      if (!warned) toast('この端末に保存できませんでした。バックアップの書き出しをおすすめします');
      warned = true;
      storageOK = false;
    }
  };
  const saveSoon = () => {
    pending = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  };
  // 何も編集していないタブが、別のタブの新しいデータを古い内容で上書きしないよう、未保存の編集があるときだけ書き込む
  const flush = () => {
    if (pending) save();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.hidden && flush());
  // 別のタブで保存されたら、その内容に切り替える
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || e.newValue == null) return;
    let next = null;
    try {
      next = normalize(JSON.parse(e.newValue));
    } catch (err) {
      next = null;
    }
    if (!next) return;
    state = next;
    const a = document.activeElement;
    if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) render();
  });

  // ---------- ユーティリティ ----------
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const $ = (sel, root = document) => root.querySelector(sel);
  // クリックした要素を、再描画後に見つけ直せるセレクタにする（閉じたシートからフォーカスを戻すため）
  const focusKey = (el) => {
    if (!el || !el.dataset || !el.dataset.act) return '';
    let sel = `[data-act="${el.dataset.act}"]`;
    if (el.dataset.id) sel += `[data-id="${CSS.escape(el.dataset.id)}"]`;
    if (el.dataset.k !== undefined) sel += `[data-k="${CSS.escape(el.dataset.k)}"]`;
    return sel;
  };
  // 検索用: 全角/半角・大文字小文字・空白の違いを無視する
  const norm = (v) => String(v ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const getStore = (id) => state.stores.find((s) => s.id === id);
  const payCount = (s) => PAY.filter((f) => s[f.k]).length;
  const launchStats = (s) => {
    if (!s.launch) return null;
    const tasks = s.launch.tasks;
    const done = tasks.filter((t) => t.done).length;
    const hoursLeft = tasks.reduce((sum, t) => sum + (t.done || !t.h ? 0 : t.h), 0);
    return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0, hoursLeft };
  };
  const isLaunching = (s) => {
    const st = launchStats(s);
    return !!st && st.done < st.total;
  };

  const parseDate = (str) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str || '')) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const fmtDate = (str) => {
    const d = parseDate(str);
    return d ? `${d.getMonth() + 1}/${d.getDate()}(${'日月火水木金土'[d.getDay()]})` : '';
  };
  const daysUntil = (str) => {
    const d = parseDate(str);
    if (!d) return null;
    const now = new Date();
    return Math.round((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  };
  const fmtHours = (h) => `${Math.round(h * 100) / 100}h`;

  let toastTimer = 0;
  const toast = (msg) => {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  };

  const download = (filename, text, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const stamp = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  };

  // ---------- UI 状態 ----------
  const WHO_ALL = '__all__';
  const ui = {
    tab: 'launch', filter: 'all', q: '', who: WHO_ALL, status: 'open', cat: 'all', tq: '', showDone: false, docsOpen: false,
    keep: new Set(), keepDone: new Set(), homeY: 0, sheetClose: null, trigger: '', returnFocus: '', entered: false,
  };
  // 「いま完了にした行」「いま未完了に戻した行」は、次の絞り込み操作まで元の位置に残す
  const clearKeep = () => {
    ui.keep = new Set();
    ui.keepDone = new Set();
  };
  const resetStoreView = () => {
    Object.assign(ui, { tab: 'launch', who: WHO_ALL, status: 'open', cat: 'all', tq: '', showDone: false, docsOpen: false });
    clearKeep();
  };

  // デモ表示では URL ハッシュを使わず、画面遷移をメモリ上で持つ
  let memHash = '#/';
  const getHash = () => (DEMO ? memHash : location.hash);
  const navigate = (hash, { replace = false } = {}) => {
    if (DEMO) {
      memHash = hash;
      onRoute();
    } else if (replace) {
      history.replaceState(null, '', location.pathname + location.search + hash);
      onRoute();
    } else {
      location.hash = hash;
    }
  };
  // 一覧に戻る。アプリ内の操作で開いた画面なら履歴を1つ戻し、そうでなければ履歴を増やさずに置き換える
  const goHome = () => {
    if (!DEMO && ui.entered) history.back();
    else navigate('#/', { replace: true });
  };
  const route = () => {
    const m = getHash().match(/^#\/s\/([^/?]+)/);
    return m ? { name: 'store', id: m[1] } : { name: 'home' };
  };

  // ---------- 一覧画面 ----------
  const matchesFilter = (s, k = ui.filter) => {
    switch (k) {
      case 'launching': return isLaunching(s);
      case 'payOpen': return payCount(s) < PAY.length;
      case 'night': return s.lnApply || s.lnPermit;
      case 'smoke': return s.smoke;
      case '電子':
      case '要確認': return s.method === k;
      default: return true;
    }
  };

  const matchesQuery = (s) => {
    const q = norm(ui.q);
    if (!q) return true;
    return [s.name, s.eisei, s.bouka, s.note, s.info.manager, s.info.owner].some((v) => norm(v).includes(q));
  };

  // 検索語が責任者名にヒットしたときだけ、その名前を行に添える
  const hitPeople = (s) => {
    const q = norm(ui.q);
    if (!q) return '';
    return [['衛生', s.eisei], ['防火', s.bouka], ['店長', s.info.manager], ['責任者', s.info.owner]]
      .filter(([, v]) => v && norm(v).includes(q))
      .map(([l, v]) => `${l} ${v}`)
      .join('　');
  };

  const storeRow = (s) => {
    const n = payCount(s);
    const st = launchStats(s);
    const tags = [
      s.method && `<span class="badge ${s.method === '電子' ? 'ok' : 'warn'}">${esc(s.method)}</span>`,
      `<span class="badge ${n === PAY.length ? 'ok' : 'warn'}">${n === PAY.length ? I.check : ''}決済 ${n}/${PAY.length}</span>`,
      s.lnApply && '<span class="badge warn">深夜申請中</span>',
      s.lnPermit && '<span class="badge ok">深夜許可あり</span>',
      s.smoke && '<span class="badge">喫煙申請</span>',
    ].filter(Boolean).join('');
    const people = hitPeople(s);
    return `
      <a class="store-row" href="#/s/${esc(s.id)}" data-act="go" data-to="#/s/${esc(s.id)}">
        <span class="sr-main">
          <span class="sr-line"><span class="sr-name">${esc(s.name || '(店舗名なし)')}</span><span class="sr-tags">${tags}</span></span>
          ${people ? `<span class="sr-sub">${esc(people)}</span>` : ''}
          ${st ? `<span class="sr-progress"><span class="bar" aria-hidden="true"><i style="width:${st.pct}%"></i></span><span class="small">${st.done}/${st.total}</span></span>` : ''}
        </span>
        ${I.chev}
      </a>`;
  };

  const groupHtml = (title, arr) =>
    `<section class="group"><h2 class="group-head"><span>${esc(title)}</span><span>${arr.length}</span></h2><div class="rows-card">${arr.map(storeRow).join('')}</div></section>`;

  const listHtml = () => {
    const items = state.stores.filter((s) => matchesFilter(s) && matchesQuery(s));
    if (!items.length) {
      return `<div class="empty">${state.stores.length ? '条件に合う店舗がありません' : '店舗がありません。右下の「新しい店舗」から追加してください'}</div>`;
    }
    if (ui.filter === 'all' && !ui.q.trim()) {
      const active = items.filter(isLaunching);
      const rest = items.filter((s) => !isLaunching(s));
      if (active.length) return groupHtml('立ち上げ中', active) + (rest.length ? groupHtml('ほかの店舗', rest) : '');
      return groupHtml('すべての店舗', items);
    }
    return groupHtml('絞り込み結果', items);
  };

  const homeChipsHtml = () =>
    HOME_FILTERS.map(([k, label]) => `<button class="chip" data-act="filter" data-k="${esc(k)}" aria-pressed="${ui.filter === k}">${label} <b>${state.stores.filter((s) => matchesQuery(s) && matchesFilter(s, k)).length}</b></button>`).join('');

  const viewHome = () => `
      <div class="topbar">
        <div class="appbar">
          <h1>らくらく立ち上げチェック</h1>
          <button class="icon-btn" data-act="settings" aria-label="設定">${I.gear}</button>
        </div>
        <div class="bar-search">
          <label class="search">${I.search}<input id="q" type="search" aria-label="店舗名・責任者で検索" placeholder="店舗名・責任者で検索" value="${esc(ui.q)}" autocomplete="off" enterkeyhint="search"></label>
        </div>
      </div>
      <main class="page">
        <div id="home-chips" class="chips" role="group" aria-label="絞り込み">${homeChipsHtml()}</div>
        <div id="list" class="list">${listHtml()}</div>
      </main>
      <button class="fab" data-act="new-store">${I.plus}新しい店舗</button>`;

  // ---------- 店舗画面 ----------
  const taskRow = (t) => {
    const meta = [t.who && esc(t.who), t.h && fmtHours(t.h), t.date && esc(fmtDate(t.date)), t.person && esc(t.person), t.memo && 'メモあり']
      .filter(Boolean)
      .map((m) => `<span>${m}</span>`)
      .join('');
    return `
      <li class="task ${t.done ? 'done' : ''}">
        <button class="check" role="checkbox" aria-checked="${t.done}" aria-label="${esc(t.t)}を完了にする" data-act="toggle-task" data-id="${esc(t.id)}"><span>${I.check}</span></button>
        <button class="task-main" data-act="edit-task" data-id="${esc(t.id)}">
          <span class="task-text"><span class="task-title">${esc(t.t.trim() ? t.t : '(無題)')}</span>${meta ? `<span class="task-meta">${meta}</span>` : ''}</span>
          ${I.chev}
        </button>
      </li>`;
  };

  const whoOk = (t) => ui.who === WHO_ALL || (t.who || '') === ui.who;
  const matchTask = (t) => {
    const q = norm(ui.tq);
    return !q || [t.t, t.who, t.person, t.memo].some((v) => norm(v).includes(q));
  };

  // チェックリストの可変部分（カテゴリのチップ + 項目一覧）。検索入力中はここだけを差し替える
  const launchListHtml = (s) => {
    const tasks = s.launch.tasks;
    const qShown = ui.tq.trim();
    const byWho = tasks.filter(whoOk);
    const base = byWho.filter(matchTask); // 検索語を反映した範囲（件数もこの範囲で数える）
    const allCats = [...CATS, OTHER].filter((c) => byWho.some((t) => catOf(t) === c));
    if (ui.cat !== 'all' && !allCats.includes(ui.cat)) ui.cat = 'all';
    const cat = ui.cat;
    const openIn = (c) => base.filter((t) => !t.done && (c === 'all' || catOf(t) === c)).length;

    const chipCats = allCats.filter((c) => {
      if (cat === c) return true;
      if (ui.status === 'all') return base.some((t) => catOf(t) === c);
      return openIn(c) > 0 || base.some((t) => catOf(t) === c && (ui.keep.has(t.id) || ui.keepDone.has(t.id)));
    });
    const chip = (c, label) => {
      const n = openIn(c);
      return `<button class="chip ${n ? '' : 'is-done'}" data-act="cat" data-k="${esc(c)}" aria-pressed="${cat === c}">${esc(label)} <b>${n || '0'}</b></button>`;
    };

    const inView = base.filter((t) => cat === 'all' || catOf(t) === cat);
    const isDoneRow = (t) => (t.done && !ui.keep.has(t.id)) || ui.keepDone.has(t.id);
    const shown = ui.status === 'all' ? inView : inView.filter((t) => !isDoneRow(t));
    const doneRows = ui.status === 'all' ? [] : inView.filter(isDoneRow);

    let body = '';
    if (cat === 'all') {
      body = [...CATS, OTHER]
        .map((c) => {
          const arr = shown.filter((t) => catOf(t) === c);
          if (!arr.length) return '';
          const all = byWho.filter((t) => catOf(t) === c);
          const done = all.filter((t) => t.done).length;
          return `<section class="group"><h3 class="group-head"><span>${esc(c)}</span><span>${done}/${all.length} 完了</span></h3><ul class="task-list">${arr.map(taskRow).join('')}</ul></section>`;
        })
        .join('');
    } else if (shown.length) {
      body = `<ul class="task-list">${shown.map(taskRow).join('')}</ul>`;
    }
    if (!body) {
      let none;
      if (!tasks.length) none = 'この店舗にはまだ項目がありません。下の「項目を追加」から追加できます';
      else if (doneRows.length) none = qShown ? `「${esc(qShown)}」に合う未完了の項目はありません` : 'この範囲の未完了の項目はありません';
      else if (qShown) none = `「${esc(qShown)}」に合う項目はありません`;
      else if (byWho.some((t) => !t.done && (cat === 'all' || catOf(t) === cat))) none = '該当する項目はありません';
      else none = 'この範囲の項目はすべて完了しています';
      body = `<div class="empty">${none}</div>`;
    }
    const done = doneRows.length
      ? `<section class="group"><button class="done-toggle" data-act="toggle-done" aria-expanded="${ui.showDone}">完了済み ${doneRows.length}件を${ui.showDone ? '隠す' : '表示'}</button>${ui.showDone ? `<ul class="task-list">${doneRows.map(taskRow).join('')}</ul>` : ''}</section>`
      : '';
    const chips = tasks.length ? `<div class="chips" role="group" aria-label="カテゴリで絞り込み">${chip('all', 'すべて')}${chipCats.map((c) => chip(c, c)).join('')}</div>` : '';
    return `
      ${chips}
      ${body}${done}`;
  };

  const tabLaunch = (s) => {
    if (!s.launch) {
      return `
        <section class="card">
          <h2>立ち上げチェック</h2>
          <p style="margin-bottom:14px">この店舗のチェックリストはまだありません。スプレッドシートのひな形から作成できます。</p>
          <div class="btn-stack">
            ${SEED.templates.map((t, i) => `<button class="btn ${i ? '' : 'primary'}" data-act="create-launch" data-tpl="${esc(t.id)}"><span>${esc(t.name)}で作成<small>${t.tasks.length}項目</small></span></button>`).join('')}
          </div>
        </section>`;
    }
    const tasks = s.launch.tasks;
    const st = launchStats(s);
    const days = daysUntil(s.info.openDate);
    let countdown = '';
    if (days !== null) {
      const text = days > 0 ? `オープンまで ${days}日` : days === 0 ? '本日オープン' : `オープンから ${-days}日経過`;
      countdown = `<p class="countdown ${days < 0 && st.done < st.total ? 'late' : ''}">${text}<span class="muted small">　${esc(fmtDate(s.info.openDate))}</span></p>`;
    } else {
      countdown = '<p class="small muted">「情報」でオープン日を入れるとカウントダウンが出ます</p>';
    }
    const whos = [...new Set(tasks.map((t) => t.who || ''))];
    if (ui.who !== WHO_ALL && !whos.includes(ui.who)) ui.who = WHO_ALL;
    const openOf = (w) => tasks.filter((t) => !t.done && (w === WHO_ALL || (t.who || '') === w)).length;
    return `
      <section class="card progress" aria-label="達成率">
        <div class="progress-num">${st.pct}<span>%</span></div>
        <div class="progress-body">
          <div class="bar" aria-hidden="true"><i style="width:${st.pct}%"></i></div>
          <p class="small">${st.done}/${st.total} 完了　残り${st.total - st.done}${st.hoursLeft ? `（目安 ${fmtHours(st.hoursLeft)}）` : ''}</p>
          ${countdown}
        </div>
      </section>
      <div class="tools">
        <label class="search">${I.search}<input id="tq" type="search" aria-label="項目を探す" placeholder="項目を探す（例：看板、POP、保健所）" value="${esc(ui.tq)}" autocomplete="off" enterkeyhint="search"></label>
        <div class="tool-row">
          <div class="segmented compact" role="group" aria-label="表示する項目">
            <button data-act="status" data-k="open" aria-pressed="${ui.status === 'open'}">未完了 ${openOf(WHO_ALL)}</button>
            <button data-act="status" data-k="all" aria-pressed="${ui.status === 'all'}">すべて ${tasks.length}</button>
          </div>
          <label class="select-wrap"><span class="sr-only">担当</span>
            <select id="who-sel">
              <option value="${WHO_ALL}">担当：全員</option>
              ${whos.map((w) => `<option value="${esc(w)}" ${ui.who === w ? 'selected' : ''}>担当：${esc(w || 'なし')}（${openOf(w)}）</option>`).join('')}
            </select>
          </label>
        </div>
      </div>
      <div id="launch-list" class="launch-list">${launchListHtml(s)}</div>
      <button class="btn" data-act="add-task">${I.plus}項目を追加</button>`;
  };

  const switchRow = (label, on, attrs) =>
    `<div class="row"><span class="row-label">${esc(label)}</span><button class="switch" role="switch" aria-checked="${on}" aria-label="${esc(label)}" ${attrs}></button></div>`;

  const tabPermit = (s) => {
    const docs = SEED.docs;
    const docItems = docs.filter((d) => !d.startsWith('・'));
    const docDone = docItems.filter((d) => s.docs[d]).length;
    const docRows = docs
      .map((d) => {
        if (d.startsWith('・')) return `<h3 class="group-title">${esc(d.slice(1))}</h3>`;
        const on = !!s.docs[d];
        return `<div class="row"><button class="check doc-check" role="checkbox" aria-checked="${on}" aria-label="${esc(d)}" data-act="toggle-doc" data-k="${esc(d)}"><span>${I.check}</span></button><span class="row-label plain">${esc(d)}</span></div>`;
      })
      .join('');
    return `
      <section class="card">
        <h2>申請方法</h2>
        <div class="segmented" role="group" aria-label="申請方法">
          ${METHODS.map(([v, label]) => `<button data-act="set-method" data-k="${esc(v)}" aria-pressed="${s.method === v}">${label}</button>`).join('')}
        </div>
      </section>
      <section class="card">
        <h2>責任者</h2>
        <label class="field"><span>衛生管理責任者</span><input data-scope="store" data-f="eisei" value="${esc(s.eisei)}" autocomplete="off"></label>
        <label class="field"><span>防火管理責任者</span><input data-scope="store" data-f="bouka" value="${esc(s.bouka)}" autocomplete="off"></label>
        <label class="field"><span>備考</span><input data-scope="store" data-f="note" value="${esc(s.note)}" autocomplete="off"></label>
      </section>
      <section class="card">
        <h2>決済・端末（${payCount(s)}/${PAY.length}）</h2>
        <div class="rows">${PAY.map((f) => switchRow(f.label, s[f.k], `data-act="toggle-flag" data-k="${f.k}"`)).join('')}</div>
      </section>
      <section class="card">
        <h2>深夜営業・喫煙</h2>
        <div class="rows">${FLAGS.filter((f) => f.group === 'night').map((f) => switchRow(f.label, s[f.k], `data-act="toggle-flag" data-k="${f.k}"`)).join('')}</div>
      </section>
      <section class="card acc-card">
        <button class="acc" data-act="toggle-docs" aria-expanded="${ui.docsOpen}"><span>深夜営業許可 必要書類</span><span class="acc-count">${docDone}/${docItems.length}</span>${I.chev}</button>
        ${ui.docsOpen ? `<div class="rows">${docRows}</div>` : ''}
      </section>`;
  };

  const tabInfo = (s) => `
    <section class="card">
      <h2>店舗情報</h2>
      <label class="field"><span>店舗名</span><input data-scope="name" value="${esc(s.name)}" autocomplete="off"></label>
      ${INFO_FIELDS.map((f) => `<label class="field"><span>${f.label}</span><input data-scope="info" data-f="${f.k}" type="${f.type}" ${f.mode ? `inputmode="${f.mode}"` : ''} value="${esc(s.info[f.k] || '')}" autocomplete="off"></label>`).join('')}
    </section>`;

  const TABS = [['launch', '立ち上げ'], ['permit', '届出・許可'], ['info', '情報']];

  const viewStore = (s) => {
    const body = ui.tab === 'permit' ? tabPermit(s) : ui.tab === 'info' ? tabInfo(s) : tabLaunch(s);
    return `
      <div class="topbar">
        <div class="appbar has-back">
          <a class="icon-btn" href="#/" data-act="back" aria-label="一覧へ戻る">${I.back}</a>
          <h1>${esc(s.name || '(店舗名なし)')}</h1>
          <button class="icon-btn" data-act="more" aria-label="メニュー">${I.more}</button>
        </div>
        <div class="tabs" role="tablist">
          ${TABS.map(([k, label]) => `<button class="tab" role="tab" data-act="tab" data-k="${k}" aria-selected="${ui.tab === k}">${label}</button>`).join('')}
        </div>
      </div>
      <main class="page">${body}</main>`;
  };

  // ---------- 描画 ----------
  const app = $('#app');

  // 横スクロールのチップ行は、再描画で先頭に戻らないよう位置を引き継ぎ、選択中のチップが見えるようにする
  const revealPressed = (row) => {
    const on = row.querySelector('[aria-pressed="true"]');
    if (!on) return;
    const rr = row.getBoundingClientRect();
    const cr = on.getBoundingClientRect();
    if (cr.left < rr.left + 8) row.scrollLeft += cr.left - rr.left - 16;
    else if (cr.right > rr.right - 8) row.scrollLeft += cr.right - rr.right + 16;
  };
  const chipOffsets = (root) => [...root.querySelectorAll('.chips')].map((c) => c.scrollLeft);
  const restoreChips = (root, xs) =>
    root.querySelectorAll('.chips').forEach((c, i) => {
      c.scrollLeft = xs[i] || 0;
      revealPressed(c);
    });
  const setLaunchList = (s) => {
    const box = $('#launch-list');
    const xs = chipOffsets(box);
    box.innerHTML = launchListHtml(s);
    restoreChips(box, xs);
  };

  const render = ({ scroll = true, focus = '' } = {}) => {
    const y = window.scrollY;
    const r = route();
    const s = r.name === 'store' ? getStore(r.id) : null;
    if (r.name === 'store' && !s) {
      navigate('#/', { replace: true });
      return;
    }
    const viewKey = s ? `store:${s.id}:${ui.tab}` : 'home';
    const xs = app.dataset.view === viewKey ? chipOffsets(app) : [];
    app.dataset.view = viewKey;
    app.innerHTML = s ? viewStore(s) : viewHome();
    restoreChips(app, xs);
    if (!DEMO) document.title = s ? `${s.name || '店舗'} | らくらく立ち上げチェック` : 'らくらく立ち上げチェック';
    if (scroll) window.scrollTo(0, y);
    if (focus) $(focus)?.focus({ preventScroll: true });
  };

  let lastRoute = 'home';
  let booted = false;
  const onRoute = () => {
    closeSheet(true);
    const r = route();
    if (lastRoute === 'home' && r.name === 'store') {
      ui.homeY = window.scrollY;
      resetStoreView();
      ui.entered = booted;
      const st = getStore(r.id);
      if (st && !st.launch) ui.tab = 'permit'; // チェックリストが無い店舗は、まず届出・許可を見せる
    }
    render({ scroll: false });
    window.scrollTo(0, r.name === 'home' && lastRoute === 'store' ? ui.homeY : 0);
    lastRoute = r.name;
    booted = true;
  };
  if (!DEMO) window.addEventListener('hashchange', onRoute);

  // ---------- 確認ダイアログ（ブラウザ標準の confirm は使えない環境があるため自前） ----------
  const confirmRoot = $('#confirm-root');
  let confirmResolve = null;

  const confirmDialog = (message, okLabel = '削除する') =>
    new Promise((resolve) => {
      if (confirmResolve) confirmResolve(false);
      confirmResolve = resolve;
      ui.confirmBack = ui.trigger;
      app.inert = true;
      sheetRoot.inert = true;
      confirmRoot.innerHTML = `
        <div class="scrim dialog-scrim" data-act="confirm-no"></div>
        <div class="dialog" role="alertdialog" aria-modal="true" aria-label="確認" aria-describedby="confirm-msg">
          <p id="confirm-msg">${esc(message)}</p>
          <div class="dialog-actions">
            <button class="btn" data-act="confirm-no" id="confirm-cancel">キャンセル</button>
            <button class="btn danger-fill" data-act="confirm-yes">${esc(okLabel)}</button>
          </div>
        </div>`;
      $('#confirm-cancel').focus();
    });

  const closeConfirm = (result) => {
    confirmRoot.innerHTML = '';
    sheetRoot.inert = false;
    app.inert = !!sheetRoot.firstChild;
    guardTaps();
    const r = confirmResolve;
    confirmResolve = null;
    if (!result && ui.confirmBack) $(ui.confirmBack)?.focus({ preventScroll: true });
    if (r) r(result);
  };

  // ---------- ボトムシート ----------
  const sheetRoot = $('#sheet-root');

  // シートやダイアログを閉じた直後の連打が、下の画面を押してしまわないよう、短時間だけタップを受け止める
  function guardTaps() {
    const g = document.createElement('div');
    g.className = 'tap-guard';
    document.body.appendChild(g);
    setTimeout(() => g.remove(), 300);
  }

  const openSheet = (title, bodyHtml, onClose) => {
    if (!sheetRoot.firstChild) ui.returnFocus = ui.trigger;
    closeSheet(true, true);
    ui.sheetClose = onClose || null;
    sheetRoot.innerHTML = `
      <div class="scrim" data-act="close-sheet"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
        <div class="sheet-handle"></div>
        <div class="sheet-head"><h2>${esc(title)}</h2><button class="text-btn" data-act="close-sheet">閉じる</button></div>
        <div class="sheet-body">${bodyHtml}</div>
      </div>`;
    document.body.classList.add('sheet-open');
    app.inert = true;
    $('.sheet', sheetRoot).focus({ preventScroll: true });
  };

  function closeSheet(silent, replacing) {
    if (!sheetRoot.firstChild) return;
    sheetRoot.innerHTML = '';
    document.body.classList.remove('sheet-open');
    if (!replacing) {
      app.inert = false;
      guardTaps();
    }
    const cb = ui.sheetClose;
    ui.sheetClose = null;
    if (cb && !silent) cb();
    if (!silent && !replacing && ui.returnFocus) $(ui.returnFocus)?.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (confirmResolve) closeConfirm(false);
      else closeSheet();
      return;
    }
    // 日本語入力の変換確定の Enter では送信しない
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    const submit = { 'ns-name': 'create-store', 'at-title': 'save-task', 'at-who': 'save-task', rn: 'save-rename' }[e.target.id];
    if (submit) {
      e.preventDefault();
      actions[submit]();
    }
  });

  const curStore = () => {
    const r = route();
    return r.name === 'store' ? getStore(r.id) : null;
  };

  const editTaskSheet = (s, t) => {
    const whos = [...new Set(s.launch.tasks.map((x) => x.who).filter(Boolean))];
    openSheet(
      '項目の編集',
      `
      <label class="field"><span>項目名</span><input data-scope="task" data-id="${esc(t.id)}" data-f="t" value="${esc(t.t)}" autocomplete="off"></label>
      <label class="field"><span>カテゴリ</span><select data-scope="task" data-id="${esc(t.id)}" data-f="c">${[...CATS, OTHER].map((c) => `<option value="${esc(c === OTHER ? '' : c)}" ${catOf(t) === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="field"><span>担当</span><input data-scope="task" data-id="${esc(t.id)}" data-f="who" value="${esc(t.who)}" list="whos" autocomplete="off"></label>
      <datalist id="whos">${whos.map((w) => `<option value="${esc(w)}">`).join('')}</datalist>
      <label class="field"><span>担当者</span><input data-scope="task" data-id="${esc(t.id)}" data-f="person" value="${esc(t.person)}" autocomplete="off"></label>
      <label class="field"><span>日付</span><input type="date" data-scope="task" data-id="${esc(t.id)}" data-f="date" value="${esc(t.date)}"></label>
      <label class="field"><span>目安時間（h）</span><input type="number" inputmode="decimal" min="0" step="0.1" data-scope="task" data-id="${esc(t.id)}" data-f="h" value="${t.h ?? ''}"></label>
      <label class="field"><span>メモ</span><textarea data-scope="task" data-id="${esc(t.id)}" data-f="memo">${esc(t.memo)}</textarea></label>
      <button class="btn primary" data-act="sheet-toggle-task" data-id="${esc(t.id)}">${t.done ? '未完了に戻す' : '完了にする'}</button>
      <button class="btn danger" data-act="delete-task" data-id="${esc(t.id)}">この項目を削除</button>`,
      () => {
        const cur = s.launch && s.launch.tasks.find((x) => x.id === t.id);
        if (cur && !cur.t.trim()) cur.t = '(無題)';
        save();
        render();
      },
    );
  };

  const newStoreSheet = () => {
    openSheet(
      '新しい店舗',
      `
      <label class="field"><span>店舗名</span><input id="ns-name" placeholder="例：新宿東口" autocomplete="off" enterkeyhint="done"></label>
      <div class="field"><span>立ち上げチェック</span>
        <div class="radio-list">
          ${SEED.templates.map((t, i) => `<label class="radio"><input type="radio" name="ns-tpl" value="${esc(t.id)}" ${i ? '' : 'checked'}><span><b>${esc(t.name)}</b><small>${t.tasks.length}項目</small></span></label>`).join('')}
          <label class="radio"><input type="radio" name="ns-tpl" value=""><span><b>作成しない</b><small>届出・許可の管理だけ使う</small></span></label>
        </div>
      </div>
      <label class="field"><span>オープン予定日（任意）</span><input id="ns-open" type="date"></label>
      <button class="btn primary" data-act="create-store">作成する</button>`,
    );
    $('#ns-name')?.focus();
  };

  const moreSheet = (s) => {
    openSheet(
      s.name || '店舗',
      `
      <div class="btn-stack">
        <button class="btn" data-act="rename">店舗名を変更</button>
        ${s.launch ? '<button class="btn danger" data-act="delete-launch">立ち上げチェックを削除</button>' : ''}
        <button class="btn danger" data-act="delete-store">この店舗を削除</button>
      </div>`,
    );
  };

  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csvText = () => {
    const head = ['店舗', '申請方法', '衛生管理責任者', '防火管理責任者', '備考', ...FLAGS.map((f) => f.label), '立ち上げ達成率', 'オープン日'];
    const rows = state.stores.map((s) => {
      const st = launchStats(s);
      return [s.name, s.method, s.eisei, s.bouka, s.note, ...FLAGS.map((f) => (s[f.k] ? '○' : '')), st ? `${st.pct}%` : '', s.info.openDate || ''];
    });
    return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  };

  const copyText = async (ta) => {
    try {
      await navigator.clipboard.writeText(ta.value);
      toast('コピーしました');
    } catch (e) {
      ta.focus();
      ta.select();
      toast('選択しました。コピーしてください');
    }
  };

  const textSheet = (title, text, hint) =>
    openSheet(
      title,
      `<p class="small muted">${esc(hint)}</p>
       <textarea id="out" class="textarea" readonly rows="8">${esc(text)}</textarea>
       <button class="btn primary" data-act="copy-out">コピーする</button>`,
    );

  const importSheet = () =>
    openSheet(
      'バックアップを読み込む',
      `<p class="small muted">書き出したバックアップのテキストを貼り付けてください。</p>
       <textarea id="in" class="textarea" rows="8" placeholder="{&quot;v&quot;:1,..."></textarea>
       <button class="btn primary" data-act="apply-import">読み込む</button>`,
    );

  const applyImport = async (text) => {
    let next = null;
    try {
      next = normalize(JSON.parse(text));
    } catch (e) {
      next = null;
    }
    if (!next) return toast('バックアップを読み込めませんでした');
    if (!(await confirmDialog(`${next.stores.length}店舗のバックアップで、いまの内容を置き換えます。`, '置き換える'))) return;
    state = next;
    save();
    closeSheet(true);
    navigate('#/', { replace: true });
    render();
    toast('バックアップを読み込みました');
  };

  const settingsSheet = () => {
    openSheet(
      '設定',
      `
      <p class="small muted">${DEMO ? 'デモ表示です。' : ''}入力内容はこの端末のブラウザ内に保存されます。端末を替えるときは「バックアップを書き出す」で移してください。${storageOK ? '' : '<br><b>いま保存が無効になっています（プライベートブラウズなど）。</b>'}</p>
      <div class="btn-stack">
        <button class="btn" data-act="export-json">バックアップを書き出す</button>
        ${DEMO
          ? '<button class="btn" data-act="import-text">バックアップを読み込む</button>'
          : '<label class="btn" style="cursor:pointer">バックアップを読み込む<input id="import-file" type="file" accept="application/json,.json" hidden></label>'}
        <button class="btn" data-act="export-csv">一覧をCSVで書き出す</button>
        <button class="btn danger" data-act="reset">初期データに戻す</button>
      </div>`,
    );
  };

  // 完了/未完了の切り替え。未完了表示でも、いま切り替えた項目は次の絞り込み操作まで元の位置に残す（行がずれて押し間違えないように）
  const toggleTask = (t) => {
    t.done = !t.done;
    if (t.done) {
      if (ui.keepDone.has(t.id)) ui.keepDone.delete(t.id);
      else ui.keep.add(t.id);
    } else if (ui.keep.has(t.id)) {
      ui.keep.delete(t.id);
    } else if (ui.status === 'open') {
      ui.keepDone.add(t.id);
    }
  };

  // ---------- 操作 ----------
  const actions = {
    filter: (el) => {
      ui.filter = el.dataset.k;
      render({ focus: `[data-act="filter"][data-k="${el.dataset.k}"]` });
    },
    settings: () => settingsSheet(),
    'new-store': () => newStoreSheet(),
    'close-sheet': () => closeSheet(),
    'create-store': () => {
      const name = $('#ns-name').value.trim();
      if (!name) {
        toast('店舗名を入力してください');
        $('#ns-name').focus();
        return;
      }
      const s = makeStore({ name });
      const tpl = (document.querySelector('input[name="ns-tpl"]:checked') || {}).value;
      if (tpl) s.launch = { tpl, tasks: makeTasks(tpl) };
      s.info.openDate = $('#ns-open').value;
      state.stores.unshift(s);
      save();
      closeSheet(true);
      navigate(`#/s/${s.id}`);
    },
    tab: (el) => {
      ui.tab = el.dataset.k;
      clearKeep();
      render({ scroll: false, focus: `[data-act="tab"][data-k="${ui.tab}"]` });
      window.scrollTo(0, 0);
    },
    more: () => moreSheet(curStore()),
    rename: () => {
      const s = curStore();
      openSheet('店舗名を変更', `<label class="field"><span>店舗名</span><input id="rn" value="${esc(s.name)}" autocomplete="off"></label><button class="btn primary" data-act="save-rename">保存</button>`);
      $('#rn').select();
    },
    'save-rename': () => {
      const name = $('#rn').value.trim();
      if (!name) return toast('店舗名を入力してください');
      curStore().name = name;
      save();
      closeSheet(true);
      render();
    },
    'delete-store': async () => {
      const s = curStore();
      if (!(await confirmDialog(`「${s.name}」を削除します。元に戻せません。`))) return;
      state.stores = state.stores.filter((x) => x.id !== s.id);
      save();
      closeSheet(true);
      goHome();
    },
    'delete-launch': async () => {
      const s = curStore();
      if (!(await confirmDialog('この店舗の立ち上げチェックを削除します。'))) return;
      s.launch = null;
      save();
      closeSheet(true);
      render();
    },
    'create-launch': (el) => {
      const s = curStore();
      s.launch = { tpl: el.dataset.tpl, tasks: makeTasks(el.dataset.tpl) };
      save();
      render();
      window.scrollTo(0, 0);
    },
    'toggle-task': (el) => {
      const t = curStore().launch.tasks.find((x) => x.id === el.dataset.id);
      toggleTask(t);
      save();
      render({ focus: `[data-act="toggle-task"][data-id="${t.id}"]` });
    },
    'edit-task': (el) => {
      const s = curStore();
      editTaskSheet(s, s.launch.tasks.find((x) => x.id === el.dataset.id));
    },
    'sheet-toggle-task': (el) => {
      toggleTask(curStore().launch.tasks.find((x) => x.id === el.dataset.id));
      closeSheet();
    },
    'delete-task': async (el) => {
      const s = curStore();
      const t = s.launch.tasks.find((x) => x.id === el.dataset.id);
      if (!(await confirmDialog(`「${t.t}」を削除します。`))) return;
      s.launch.tasks = s.launch.tasks.filter((x) => x.id !== t.id);
      closeSheet();
    },
    'add-task': () => {
      const s = curStore();
      const whos = [...new Set(s.launch.tasks.map((x) => x.who).filter(Boolean))];
      openSheet(
        '項目を追加',
        `<label class="field"><span>項目名</span><input id="at-title" autocomplete="off" enterkeyhint="done"></label>
         <label class="field"><span>カテゴリ</span><select id="at-cat">${[...CATS, OTHER].map((c) => `<option value="${esc(c === OTHER ? '' : c)}" ${ui.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
         <label class="field"><span>担当</span><input id="at-who" list="whos" value="${esc(ui.who === WHO_ALL ? '' : ui.who)}" autocomplete="off"></label>
         <datalist id="whos">${whos.map((w) => `<option value="${esc(w)}">`).join('')}</datalist>
         <button class="btn primary" data-act="save-task">追加する</button>`,
      );
      $('#at-title').focus();
    },
    'save-task': () => {
      const title = $('#at-title').value.trim();
      if (!title) return toast('項目名を入力してください');
      const task = { id: uid(), t: title, c: $('#at-cat').value, who: $('#at-who').value.trim(), done: false, date: '', person: '', memo: '' };
      curStore().launch.tasks.push(task);
      // いまの絞り込みでは見えない項目を足したときは、絞り込みを外して見えるようにする
      if (!whoOk(task) || !matchTask(task) || (ui.cat !== 'all' && catOf(task) !== ui.cat)) {
        ui.who = WHO_ALL;
        ui.tq = '';
        ui.cat = 'all';
      }
      clearKeep();
      save();
      closeSheet(true);
      render();
      toast(`「${title}」を追加しました`);
    },
    status: (el) => {
      ui.status = el.dataset.k;
      clearKeep();
      render({ focus: `[data-act="status"][data-k="${el.dataset.k}"]` });
    },
    cat: (el) => {
      ui.cat = el.dataset.k;
      clearKeep();
      render({ focus: `[data-act="cat"][data-k="${CSS.escape(el.dataset.k)}"]` });
    },
    'toggle-done': () => {
      ui.showDone = !ui.showDone;
      render({ focus: '[data-act="toggle-done"]' });
    },
    'toggle-docs': () => {
      ui.docsOpen = !ui.docsOpen;
      render({ focus: '[data-act="toggle-docs"]' });
    },
    'set-method': (el) => {
      curStore().method = el.dataset.k;
      save();
      render({ focus: `[data-act="set-method"][data-k="${CSS.escape(el.dataset.k)}"]` });
    },
    'toggle-flag': (el) => {
      const s = curStore();
      s[el.dataset.k] = !s[el.dataset.k];
      save();
      render({ focus: `[data-act="toggle-flag"][data-k="${el.dataset.k}"]` });
    },
    'toggle-doc': (el) => {
      const s = curStore();
      const k = el.dataset.k;
      if (s.docs[k]) delete s.docs[k];
      else s.docs[k] = true;
      save();
      render({ focus: `[data-act="toggle-doc"][data-k="${CSS.escape(k)}"]` });
    },
    'export-json': () => {
      if (DEMO) return textSheet('バックアップ', JSON.stringify(state), '全体をコピーして保存してください。別の端末では「バックアップを読み込む」に貼り付けます。');
      download(`rakuraku-tachiage-backup-${stamp()}.json`, JSON.stringify(state), 'application/json');
      toast('バックアップを書き出しました');
    },
    'export-csv': () => {
      if (DEMO) return textSheet('一覧（CSV）', csvText(), 'コピーして表計算ソフトに貼り付けられます。');
      download(`rakuraku-tachiage-${stamp()}.csv`, '\uFEFF' + csvText(), 'text/csv;charset=utf-8');
    },
    'copy-out': () => copyText($('#out')),
    'import-text': () => importSheet(),
    'apply-import': () => applyImport($('#in').value),
    'confirm-yes': () => closeConfirm(true),
    'confirm-no': () => closeConfirm(false),
    go: (el, e) => {
      e.preventDefault();
      navigate(el.dataset.to);
    },
    back: (el, e) => {
      e.preventDefault();
      goHome();
    },
    reset: async () => {
      if (!(await confirmDialog('すべての入力内容を消して、スプレッドシート由来の初期データに戻します。', '初期化する'))) return;
      state = seedState();
      save();
      closeSheet(true);
      navigate('#/', { replace: true });
      render();
      toast('初期データに戻しました');
    },
  };

  document.addEventListener('click', (e) => {
    let el = e.target.closest('[data-act]');
    if (!el) {
      // 行の文字の部分をタップしても、その行のスイッチ/チェックを切り替える
      const row = e.target.closest('.row');
      el = row && row.querySelector('[data-act]');
      if (!el) return;
    }
    ui.trigger = focusKey(el);
    const fn = actions[el.dataset.act];
    if (fn) fn(el, e);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'q') {
      ui.q = el.value;
      $('#list').innerHTML = listHtml();
      const chips = $('#home-chips');
      const x = chips.scrollLeft;
      chips.innerHTML = homeChipsHtml();
      chips.scrollLeft = x;
      return;
    }
    if (el.id === 'tq') {
      ui.tq = el.value;
      clearKeep();
      const s = curStore();
      if (s && s.launch) setLaunchList(s);
      return;
    }
    const sc = el.dataset && el.dataset.scope;
    if (!sc) return;
    const s = curStore();
    if (!s) return;
    const f = el.dataset.f;
    if (sc === 'store') s[f] = el.value;
    else if (sc === 'info') s.info[f] = el.value;
    else if (sc === 'name') {
      const v = el.value.trim();
      if (v) {
        s.name = v;
        const h1 = $('.appbar h1');
        if (h1) h1.textContent = v;
      }
    } else if (sc === 'task') {
      const t = s.launch.tasks.find((x) => x.id === el.dataset.id);
      if (!t) return;
      t[f] = f === 'h' ? (el.value === '' ? undefined : Number(el.value)) : f === 'who' ? el.value.trim() : el.value;
    }
    saveSoon();
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'who-sel') {
      ui.who = e.target.value;
      clearKeep();
      render({ focus: '#who-sel' });
      return;
    }
    if (e.target.dataset && e.target.dataset.scope === 'name') {
      const s = curStore();
      if (s && !e.target.value.trim()) toast('店舗名は空にできません');
      if (s) e.target.value = s.name;
      return;
    }
    if (e.target.id !== 'import-file') return;
    const file = e.target.files[0];
    if (file) file.text().then(applyImport);
  });

  // ---------- 起動 ----------
  onRoute();

  if (!DEMO && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
