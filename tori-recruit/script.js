// 募集要項タブ切り替え
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.req-table').forEach(t => {
      t.classList.toggle('hidden', t.dataset.pane !== target);
    });
  });
});

// 応募フォーム送信（デモ：ローカル保存のみ）
const form = document.getElementById('entryForm');
const done = document.getElementById('entryDone');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name || !data.tel || !data.job) {
      alert('お名前・電話番号・応募職種は必須です。');
      return;
    }
    const list = JSON.parse(localStorage.getItem('tori_entries') || '[]');
    list.push({ ...data, at: new Date().toISOString() });
    localStorage.setItem('tori_entries', JSON.stringify(list));
    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

// スクロール時のヘッダー強調（任意）
const header = document.querySelector('.header');
let lastY = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (header) header.style.boxShadow = y > 20 ? '0 6px 20px rgba(0,0,0,.3)' : 'none';
  lastY = y;
}, { passive: true });
