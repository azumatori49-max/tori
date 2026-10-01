(() => {
  'use strict';

  const SEED = window.RAKU_SEED;
  const KEY = 'rakuraku-tachiage:v1';

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
    return tpl ? tpl.tasks.map((t) => ({ id: uid(), t: t.t, who: t.who || '', h: t.h, done: false, date: '', person: '', memo: '' })) : [];
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

  const seedState = () => ({ v: 1, stores: SEED.stores.map(makeStore) });

  let storageOK = true;

  const normalize = (raw) => {
    if (!raw || raw.v !== 1 || !Array.isArray(raw.stores)) return null;
    raw.stores.forEach((s) => {
      Object.assign(s, { ...makeStore(), ...s });
      s.docs = s.docs || {};
      s.info = s.info || {};
      if (s.launch && !Array.isArray(s.launch.tasks)) s.launch = null;
    });
    return raw;
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const st = normalize(JSON.parse(raw));
        if (st) return st;
      }
    } catch (e) {
      storageOK = false;
    }
    return seedState();
  };

  let state = load();
  let saveTimer = 0;

  const save = () => {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (storageOK) toast('この端末に保存できませんでした。バックアップの書き出しをおすすめします');
      storageOK = false;
    }
  };
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  };
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => document.hidden && save());

  // ---------- ユーティリティ ----------
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const $ = (sel, root = document) => root.querySelector(sel);
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
  const fmtHours = (h) => `${Math.round(h * 10) / 10}h`;

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
  const ui = { tab: 'launch', filter: 'all', q: '', who: 'all', onlyOpen: false, homeY: 0, sheetClose: null };

  const route = () => {
    const m = location.hash.match(/^#\/s\/([^/?]+)/);
    return m ? { name: 'store', id: m[1] } : { name: 'home' };
  };

  // ---------- 一覧画面 ----------
  const matchesFilter = (s) => {
    switch (ui.filter) {
      case 'launching': return isLaunching(s);
      case 'payOpen': return payCount(s) < PAY.length;
      case 'night': return s.lnApply || s.lnPermit;
      case 'smoke': return s.smoke;
      case '電子':
      case '要確認': return s.method === ui.filter;
      default: return true;
    }
  };

  const matchesQuery = (s) => {
    const q = ui.q.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.eisei, s.bouka, s.note, s.info.manager, s.info.owner].some((v) => (v || '').toLowerCase().includes(q));
  };

  const storeCard = (s) => {
    const n = payCount(s);
    const st = launchStats(s);
    const badges = [
      s.method && `<span class="badge ${s.method === '電子' ? 'ok' : 'warn'}">${esc(s.method)}</span>`,
      `<span class="badge ${n === PAY.length ? 'ok' : 'warn'}">${n === PAY.length ? I.check : ''}決済 ${n}/${PAY.length}</span>`,
      s.lnApply && '<span class="badge warn">深夜申請中</span>',
      s.lnPermit && '<span class="badge ok">深夜許可あり</span>',
      s.smoke && '<span class="badge">喫煙申請</span>',
    ].filter(Boolean).join('');
    const people = [s.eisei && `衛生 ${s.eisei}`, s.bouka && `防火 ${s.bouka}`].filter(Boolean).join('　');
    return `
      <a class="card store" href="#/s/${esc(s.id)}">
        <div class="store-head"><span class="store-name">${esc(s.name || '(店舗名なし)')}</span>${I.chev}</div>
        <div class="badges">${badges}</div>
        ${people ? `<p class="people">${esc(people)}</p>` : ''}
        ${st ? `<div class="mini-progress"><div class="bar" aria-hidden="true"><i style="width:${st.pct}%"></i></div><p class="small">立ち上げチェック ${st.done}/${st.total}（${st.pct}%）</p></div>` : ''}
      </a>`;
  };

  const listHtml = () => {
    const items = state.stores.filter((s) => matchesFilter(s) && matchesQuery(s));
    if (!items.length) {
      return `<div class="empty">${state.stores.length ? '条件に合う店舗がありません' : '店舗がありません。右下の「新しい店舗」から追加してください'}</div>`;
    }
    return items.map(storeCard).join('');
  };

  const viewHome = () => {
    const launching = state.stores.filter(isLaunching).length;
    const payOpen = state.stores.filter((s) => payCount(s) < PAY.length).length;
    const tile = (num, label, cls = '') => `<div class="tile ${cls}"><strong>${num}</strong><span>${label}</span></div>`;
    return `
      <div class="topbar">
        <div class="appbar">
          <h1>らくらく立ち上げチェック</h1>
          <button class="icon-btn" data-act="settings" aria-label="設定">${I.gear}</button>
        </div>
      </div>
      <main class="page">
        <section class="summary" aria-label="サマリー">
          ${tile(state.stores.length, '全店舗')}${tile(launching, '立ち上げ中')}${tile(payOpen, '決済未完了', payOpen ? 'warn' : '')}
        </section>
        <label class="search">${I.search}<input id="q" type="search" placeholder="店舗名・担当者で検索" value="${esc(ui.q)}" autocomplete="off" enterkeyhint="search"></label>
        <div class="chips" role="group" aria-label="絞り込み">
          ${HOME_FILTERS.map(([k, label]) => `<button class="chip" data-act="filter" data-k="${esc(k)}" aria-pressed="${ui.filter === k}">${label}</button>`).join('')}
        </div>
        <div id="list" class="list">${listHtml()}</div>
      </main>
      <button class="fab" data-act="new-store">${I.plus}新しい店舗</button>`;
  };

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
          <span class="task-text"><span class="task-title">${esc(t.t)}</span>${meta ? `<span class="task-meta">${meta}</span>` : ''}</span>
          ${I.chev}
        </button>
      </li>`;
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
      const text = days > 0 ? `オープンまで あと ${days} 日` : days === 0 ? '本日オープン' : `オープンから ${-days} 日経過`;
      countdown = `<p class="countdown ${days < 0 && st.done < st.total ? 'late' : ''}">${text}（${esc(fmtDate(s.info.openDate))}）</p>`;
    } else {
      countdown = '<p class="small muted">「情報」でオープン日を入れるとカウントダウンが出ます</p>';
    }
    const whos = [...new Set(tasks.map((t) => t.who || ''))];
    if (ui.who !== 'all' && !whos.includes(ui.who)) ui.who = 'all';
    const open = (w) => tasks.filter((t) => !t.done && (w === 'all' || (t.who || '') === w)).length;
    const visible = tasks.filter((t) => (ui.who === 'all' || (t.who || '') === ui.who) && (!ui.onlyOpen || !t.done));
    return `
      <section class="card progress" aria-label="達成率">
        <div class="progress-num">${st.pct}<span>%</span></div>
        <div class="progress-body">
          <div class="bar" aria-hidden="true"><i style="width:${st.pct}%"></i></div>
          <p class="small">完了 ${st.done} / ${st.total}　残り ${st.total - st.done}${st.hoursLeft ? `　残り目安 ${fmtHours(st.hoursLeft)}` : ''}</p>
          ${countdown}
        </div>
      </section>
      <div class="chips" role="group" aria-label="担当で絞り込み">
        <button class="chip" data-act="open-only" aria-pressed="${ui.onlyOpen}">未完了のみ</button>
        <button class="chip" data-act="who" data-k="all" aria-pressed="${ui.who === 'all'}">全員 ${open('all')}</button>
        ${whos.map((w) => `<button class="chip" data-act="who" data-k="${esc(w)}" aria-pressed="${ui.who === w}">${esc(w || '担当なし')} ${open(w)}</button>`).join('')}
      </div>
      ${visible.length ? `<ul class="task-list">${visible.map(taskRow).join('')}</ul>` : '<div class="empty">該当する項目はありません</div>'}
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
      <section class="card">
        <h2>深夜営業許可 必要書類（${docDone}/${docItems.length}）</h2>
        <div class="rows">${docRows}</div>
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
          <a class="icon-btn" href="#/" aria-label="一覧へ戻る">${I.back}</a>
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

  const render = ({ scroll = true, focus = '' } = {}) => {
    const y = window.scrollY;
    const r = route();
    const s = r.name === 'store' ? getStore(r.id) : null;
    if (r.name === 'store' && !s) {
      location.hash = '#/';
      return;
    }
    app.innerHTML = s ? viewStore(s) : viewHome();
    document.title = s ? `${s.name || '店舗'} | らくらく立ち上げチェック` : 'らくらく立ち上げチェック';
    if (scroll) window.scrollTo(0, y);
    if (focus) $(focus)?.focus({ preventScroll: true });
  };

  let lastRoute = 'home';
  const onRoute = () => {
    closeSheet(true);
    const r = route();
    if (lastRoute === 'home' && r.name === 'store') {
      ui.homeY = window.scrollY;
      ui.tab = 'launch';
      ui.who = 'all';
      ui.onlyOpen = false;
    }
    render({ scroll: false });
    window.scrollTo(0, r.name === 'home' && lastRoute === 'store' ? ui.homeY : 0);
    lastRoute = r.name;
  };
  window.addEventListener('hashchange', onRoute);

  // ---------- ボトムシート ----------
  const sheetRoot = $('#sheet-root');

  const openSheet = (title, bodyHtml, onClose) => {
    closeSheet(true);
    ui.sheetClose = onClose || null;
    sheetRoot.innerHTML = `
      <div class="scrim" data-act="close-sheet"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-handle"></div>
        <div class="sheet-head"><h2>${esc(title)}</h2><button class="text-btn" data-act="close-sheet">閉じる</button></div>
        <div class="sheet-body">${bodyHtml}</div>
      </div>`;
    document.body.classList.add('sheet-open');
  };

  function closeSheet(silent) {
    if (!sheetRoot.firstChild) return;
    sheetRoot.innerHTML = '';
    document.body.classList.remove('sheet-open');
    const cb = ui.sheetClose;
    ui.sheetClose = null;
    if (cb && !silent) cb();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
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
  const exportCsv = () => {
    const head = ['店舗', '申請方法', '衛生管理責任者', '防火管理責任者', '備考', ...FLAGS.map((f) => f.label), '立ち上げ達成率', 'オープン日'];
    const rows = state.stores.map((s) => {
      const st = launchStats(s);
      return [s.name, s.method, s.eisei, s.bouka, s.note, ...FLAGS.map((f) => (s[f.k] ? '○' : '')), st ? `${st.pct}%` : '', s.info.openDate || ''];
    });
    const text = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    download(`rakuraku-tachiage-${stamp()}.csv`, text, 'text/csv;charset=utf-8');
  };

  const settingsSheet = () => {
    openSheet(
      '設定',
      `
      <p class="small muted">入力内容はこの端末のブラウザ内に保存されます。端末を替えるときは「バックアップを書き出す」で移してください。${storageOK ? '' : '<br><b>いま保存が無効になっています（プライベートブラウズなど）。</b>'}</p>
      <div class="btn-stack">
        <button class="btn" data-act="export-json">バックアップを書き出す</button>
        <label class="btn" style="cursor:pointer">バックアップを読み込む<input id="import-file" type="file" accept="application/json,.json" hidden></label>
        <button class="btn" data-act="export-csv">一覧をCSVで書き出す</button>
        <button class="btn danger" data-act="reset">初期データに戻す</button>
      </div>`,
    );
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
      location.hash = `#/s/${s.id}`;
    },
    tab: (el) => {
      ui.tab = el.dataset.k;
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
    'delete-store': () => {
      const s = curStore();
      if (!confirm(`「${s.name}」を削除します。元に戻せません。よろしいですか？`)) return;
      state.stores = state.stores.filter((x) => x.id !== s.id);
      save();
      closeSheet(true);
      location.hash = '#/';
    },
    'delete-launch': () => {
      const s = curStore();
      if (!confirm('この店舗の立ち上げチェックを削除します。よろしいですか？')) return;
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
      t.done = !t.done;
      save();
      render({ focus: `[data-act="toggle-task"][data-id="${t.id}"]` });
    },
    'edit-task': (el) => {
      const s = curStore();
      editTaskSheet(s, s.launch.tasks.find((x) => x.id === el.dataset.id));
    },
    'sheet-toggle-task': (el) => {
      const t = curStore().launch.tasks.find((x) => x.id === el.dataset.id);
      t.done = !t.done;
      closeSheet();
    },
    'delete-task': (el) => {
      const s = curStore();
      const t = s.launch.tasks.find((x) => x.id === el.dataset.id);
      if (!confirm(`「${t.t}」を削除します。よろしいですか？`)) return;
      s.launch.tasks = s.launch.tasks.filter((x) => x.id !== t.id);
      closeSheet();
    },
    'add-task': () => {
      const s = curStore();
      const whos = [...new Set(s.launch.tasks.map((x) => x.who).filter(Boolean))];
      openSheet(
        '項目を追加',
        `<label class="field"><span>項目名</span><input id="at-title" autocomplete="off" enterkeyhint="done"></label>
         <label class="field"><span>担当</span><input id="at-who" list="whos" autocomplete="off"></label>
         <datalist id="whos">${whos.map((w) => `<option value="${esc(w)}">`).join('')}</datalist>
         <button class="btn primary" data-act="save-task">追加する</button>`,
      );
      $('#at-title').focus();
    },
    'save-task': () => {
      const title = $('#at-title').value.trim();
      if (!title) return toast('項目名を入力してください');
      curStore().launch.tasks.push({ id: uid(), t: title, who: $('#at-who').value.trim(), done: false, date: '', person: '', memo: '' });
      save();
      closeSheet(true);
      render();
    },
    who: (el) => {
      ui.who = el.dataset.k;
      render({ focus: `[data-act="who"][data-k="${CSS.escape(el.dataset.k)}"]` });
    },
    'open-only': () => {
      ui.onlyOpen = !ui.onlyOpen;
      render({ focus: '[data-act="open-only"]' });
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
      download(`rakuraku-tachiage-backup-${stamp()}.json`, JSON.stringify(state), 'application/json');
      toast('バックアップを書き出しました');
    },
    'export-csv': () => exportCsv(),
    reset: () => {
      if (!confirm('すべての入力内容を消して、スプレッドシート由来の初期データに戻します。よろしいですか？')) return;
      state = seedState();
      save();
      closeSheet(true);
      location.hash = '#/';
      render();
      toast('初期データに戻しました');
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'q') {
      ui.q = el.value;
      $('#list').innerHTML = listHtml();
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
      s.name = el.value;
      const h1 = $('.appbar h1');
      if (h1) h1.textContent = el.value || '(店舗名なし)';
    } else if (sc === 'task') {
      const t = s.launch.tasks.find((x) => x.id === el.dataset.id);
      if (!t) return;
      t[f] = f === 'h' ? (el.value === '' ? undefined : Number(el.value)) : el.value;
    }
    saveSoon();
  });

  document.addEventListener('change', (e) => {
    if (e.target.id !== 'import-file') return;
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((text) => {
      let next = null;
      try {
        next = normalize(JSON.parse(text));
      } catch (err) {
        next = null;
      }
      if (!next) return toast('バックアップファイルを読み込めませんでした');
      if (!confirm(`${next.stores.length}店舗のバックアップで、いまの内容を置き換えます。よろしいですか？`)) return;
      state = next;
      save();
      closeSheet(true);
      location.hash = '#/';
      render();
      toast('バックアップを読み込みました');
    });
  });

  // ---------- 起動 ----------
  onRoute();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
