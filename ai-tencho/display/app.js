/**
 * display/app.js — 店内モニター
 *
 * 役割は Firebase の購読・表示・MP3再生のみ（§9）。判定も生成も行わない。
 * - 通信断でもローカルの最終状態を表示し続ける（onValue のキャッシュ + 自前の状態保持）
 * - heartbeat が20分途絶したら「サーバー未接続」を表示（現場が障害に気づけるように）
 * - 同じ発話をリロード後に再再生しないよう、最後に再生した at を localStorage に持つ
 */

(function () {
  'use strict';

  const HEARTBEAT_STALE_MIN = 20;

  const el = {
    stage: document.getElementById('stage'),
    clock: document.getElementById('clock'),
    status: document.getElementById('status'),
    orb: document.getElementById('orb'),
    label: document.getElementById('label'),
    message: document.getElementById('message'),
    messageTime: document.getElementById('message-time'),
    player: document.getElementById('player'),
    kpi: {
      sales: document.getElementById('kpi-sales'),
      guests: document.getElementById('kpi-guests'),
      avg: document.getElementById('kpi-avg'),
      gap: document.getElementById('kpi-gap'),
      baseline: document.getElementById('kpi-baseline'),
      task: document.getElementById('kpi-task')
    }
  };

  let lastHeartbeat = null;
  let killSwitch = false;

  // ---------- Firebase ----------
  firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.database();

  db.ref('store/current').on('value', function (snap) {
    const cur = snap.val();
    if (!cur) return;
    render(cur);
    maybePlay(cur);
  });

  db.ref('store/kpi').on('value', function (snap) {
    const kpi = snap.val() || {};
    el.kpi.sales.textContent = fmtYen(kpi.y_sales);
    el.kpi.guests.textContent = kpi.y_guests != null ? kpi.y_guests + '名' : '—';
    el.kpi.avg.textContent = fmtYen(kpi.y_avg);
    el.kpi.gap.textContent = kpi.y_gap_pct != null ? (kpi.y_gap_pct > 0 ? '+' : '') + kpi.y_gap_pct + '%' : '—';
    el.kpi.gap.classList.toggle('kpi__value--bad', kpi.y_gap_pct != null && kpi.y_gap_pct <= -5);
    el.kpi.gap.classList.toggle('kpi__value--good', kpi.y_gap_pct != null && kpi.y_gap_pct >= 8);
    el.kpi.baseline.textContent = fmtYen(kpi.baseline);
    el.kpi.task.textContent = kpi.task_rate != null ? Math.round(kpi.task_rate * 100) + '%' : '—';
  });

  db.ref('store/heartbeat').on('value', function (snap) {
    lastHeartbeat = snap.val();
    updateStatus();
  });

  db.ref('store/kill_switch').on('value', function (snap) {
    killSwitch = !!snap.val();
    updateStatus();
  });

  // ---------- 表示 ----------

  function render(cur) {
    el.message.textContent = cur.text || '';
    el.label.textContent = cur.label || '';
    el.messageTime.textContent = cur.at ? fmtTime(cur.at) : '';
    setOrbState(orbStateOf(cur.type));
  }

  function orbStateOf(type) {
    if (type === 'alert') return 'alert';
    if (type === 'brief' || type === 'praise') return 'brief';
    if (type === 'check' || type === 'task' || type === 'info') return 'info';
    return 'idle';
  }

  function setOrbState(state) {
    el.orb.className = 'orb orb--' + state;
  }

  function updateStatus() {
    if (killSwitch) {
      el.status.textContent = '停止中（キルスイッチ）';
      el.status.className = 'status status--stop';
      setOrbState('idle');
      return;
    }
    const stale = !lastHeartbeat ||
      (Date.now() - new Date(lastHeartbeat).getTime()) / 60000 > HEARTBEAT_STALE_MIN;
    if (stale) {
      el.status.textContent = 'サーバー未接続';
      el.status.className = 'status status--warn';
    } else {
      el.status.textContent = '稼働中';
      el.status.className = 'status status--ok';
    }
  }

  // heartbeat は書き込みイベントが来ないと on() が発火しないため、経過は自前で監視する
  setInterval(updateStatus, 60 * 1000);

  // ---------- 音声再生 ----------
  // Chrome kiosk（--autoplay-policy=no-user-gesture-required）前提。§2

  function maybePlay(cur) {
    if (!cur.audio_url || !cur.at) return;
    if (killSwitch) return;
    const lastPlayed = localStorage.getItem('lastPlayedAt');
    if (lastPlayed && lastPlayed >= cur.at) return; // 再読込時の再再生防止
    // 古い発話（30分以上前）は再生しない。深夜の再起動で朝礼が鳴るのを防ぐ
    if (Date.now() - new Date(cur.at).getTime() > 30 * 60 * 1000) return;

    el.player.src = cur.audio_url;
    const p = el.player.play();
    if (p && p.then) {
      p.then(function () {
        localStorage.setItem('lastPlayedAt', cur.at);
        el.orb.classList.add('orb--speaking');
      }).catch(function (err) {
        console.warn('自動再生に失敗（kiosk フラグ未設定の可能性）', err);
      });
    }
  }

  el.player.addEventListener('ended', function () {
    el.orb.classList.remove('orb--speaking');
  });
  el.player.addEventListener('error', function () {
    el.orb.classList.remove('orb--speaking');
  });

  // ---------- 時計・焼き付き対策 ----------

  setInterval(function () {
    const d = new Date();
    el.clock.textContent =
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }, 1000);

  // 24時間表示しっぱなしのため、5分ごとに全体を±4px範囲で微小シフトする（§9）
  setInterval(function () {
    const dx = Math.floor(Math.random() * 9) - 4;
    const dy = Math.floor(Math.random() * 9) - 4;
    el.stage.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }, 5 * 60 * 1000);

  // ---------- ヘルパー ----------

  function fmtYen(n) {
    return n != null ? Number(n).toLocaleString('ja-JP') + '円' : '—';
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' 更新';
  }
})();
