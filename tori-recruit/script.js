// =====================
// 店舗データ
// =====================
const STORES = [
  // 東北
  { region:"tohoku", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 八戸店", addr:"〒031-0033 青森県八戸市六日町8−１ やま正ビル 1階", tel:"0178-38-3226" },
  { region:"tohoku", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 盛岡大通り店", addr:"〒020-0022 岩手県盛岡市大通２丁目７−２６ 杉山ビル 1階", tel:"019-656-6161" },
  { region:"tohoku", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 仙台国分町店", addr:"〒980-0811 宮城県仙台市青葉区一番町４丁目２−１０ 2F", tel:"022-398-6246" },
  { region:"tohoku", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 福島いわき店", addr:"〒970-8026 福島県いわき市平三町目29番２９ ベルツリ 2階", tel:"0246-88-9088" },
  { region:"tohoku", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 福島栄町店", addr:"〒960-8031 福島県福島市栄町１１−１０ 栄町ビル 2階", tel:"024-563-1331" },

  // 関東（茨城・栃木・群馬）
  { region:"kanto", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 土浦店", addr:"〒300-0036 茨城県土浦市大和町３−１", tel:"029-828-7135" },
  { region:"kanto", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 東武宇都宮店", addr:"〒320-0801 栃木県宇都宮市池上町２−１ プラチナビル 1.2F", tel:"028-612-6479" },
  { region:"kanto", brand:"maruke", name:"秩父ホルモン焼肉まる助 高崎駅前店", addr:"〒370-0826 群馬県高崎市連雀町１３６", tel:"027-387-0049" },

  // 埼玉
  { region:"saitama", brand:"maruke", name:"秩父焼肉ホルモン酒場 まる助 大宮一番街店", addr:"〒330-0802 埼玉県さいたま市大宮区宮町１丁目５３ ラック大宮一番街 1F", tel:"048-780-2260" },
  { region:"saitama", brand:"maruke", name:"秩父焼肉ホルモン酒場 まる助 東松山駅前店", addr:"〒355-0028 埼玉県東松山市箭弓町１丁目１２−８ 大谷ビル 1F", tel:"0493-53-4777" },
  { region:"saitama", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 大宮店", addr:"〒330-0802 埼玉県さいたま市大宮区宮町１丁目９７−２", tel:"048-662-9352" },
  { region:"saitama", brand:"maruke", name:"秩父ホルモン酒場 まる助 川越クレアモール店", addr:"〒350-0043 埼玉県川越市新富町２丁目９−１７", tel:"049-227-9844" },
  { region:"saitama", brand:"maruke", name:"秩父焼肉ホルモン酒場 まる助 熊谷駅前店", addr:"〒360-0037 埼玉県熊谷市筑波２丁目４９−１ 熊谷駅前ビル B1", tel:"048-577-8477" },
  { region:"saitama", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 志木店", addr:"〒352-0001 埼玉県新座市東北２丁目３７−１０ 高野ビル １階", tel:"048-423-4232" },
  { region:"saitama", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 南越谷店", addr:"〒343-0845 埼玉県越谷市南越谷1-20-6 高木ビル 2F", tel:"048-971-9993" },
  { region:"saitama", brand:"tori", name:"居酒屋 魚と焼鳥 鶏ヤロー！ 草加店", addr:"〒340-0015 埼玉県草加市高砂２丁目１２−１０ ２階", tel:"048-950-8861" },
  { region:"saitama", brand:"maruke", name:"秩父焼肉ホルモン酒場 まる助 西武秩父駅前店", addr:"〒368-0032 埼玉県秩父市熊木町９−５ 1F", tel:"0494-26-6989" },
  { region:"saitama", brand:"maruke", name:"秩父焼肉ホルモンまる助 みやのかわ本店", addr:"〒368-0046 埼玉県秩父市宮側町１５−１０", tel:"0494-24-0707" },

  // 千葉
  { region:"chiba", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 津田沼店", addr:"〒274-0825 千葉県船橋市前原西２丁目１５−２０", tel:"047-406-5379" },
  { region:"chiba", brand:"tori", name:"居酒屋 魚と焼鳥 鶏ヤロー！ 柏店", addr:"〒277-0005 千葉県柏市柏２丁目５−４ TMビル ２F", tel:"04-7137-7764" },
  { region:"chiba", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 千葉駅東口店", addr:"〒260-0015 千葉県千葉市中央区富士見２丁目４−１６ 金子ビル ２階", tel:"043-216-4998" },
  { region:"chiba", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 柏店", addr:"〒277-0005 千葉県柏市柏３丁目７−２１", tel:"04-7189-8887" },
  { region:"chiba", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 松戸店", addr:"〒271-0091 千葉県松戸市本町4−８ 芳風 建物", tel:"047-701-5535" },
  { region:"chiba", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 船橋店", addr:"〒273-0005 千葉県船橋市本町４丁目５−２６ 2F", tel:"047-409-5513" },

  // 東京
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 新宿西口店", addr:"〒160-0023 東京都新宿区西新宿１丁目１２−９ 田畑ビル ２F", tel:"03-6302-0929" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 北千住店", addr:"〒120-0026 東京都足立区千住旭町３−８ ウイングビル ２階", tel:"03-6806-1445" },
  { region:"tokyo", brand:"tori", name:"居酒屋 魚と焼鳥鶏ヤロー！ 秋葉原店", addr:"〒101-0025 東京都千代田区神田佐久間町１丁目２４ Gato 秋葉原ビル 地下1F", tel:"03-6384-0369" },
  { region:"tokyo", brand:"tori", name:"居酒屋 魚鶏ヤロー！ 立川駅北口店", addr:"〒190-0012 東京都立川市曙町２丁目６−５ 地下一階", tel:"042-506-0100" },
  { region:"tokyo", brand:"tori", name:"酒場 魚と鶏ヤロー 御徒町店", addr:"〒110-0005 東京都台東区上野５丁目２０−１５", tel:"03-6803-0029" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 東小金井店", addr:"〒184-0011 東京都小金井市東町４丁目４２−２０ 2F", tel:"050-5456-0992" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 池袋店", addr:"〒171-0022 東京都豊島区南池袋１丁目２３−１ 富士ビル 1階", tel:"03-5944-8188" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 錦糸町店", addr:"〒130-0022 東京都墨田区江東橋３丁目１１−３ ソシアル錦糸町ビル 2F", tel:"03-5669-0885" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 高田馬場店", addr:"〒169-0075 東京都新宿区高田馬場１丁目２７−１", tel:"03-6233-8644" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 新橋店", addr:"〒105-0004 東京都港区新橋２丁目９−１ 青葉ビル 2階", tel:"03-6457-9578" },
  { region:"tokyo", brand:"tori", name:"カラオケ付き居酒屋鶏ヤロー！ 池袋東口店", addr:"〒171-0022 東京都豊島区南池袋１丁目２７−８ サンパレス 4F", tel:"03-5810-3666" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 渋谷駅前店", addr:"〒150-0043 東京都渋谷区道玄坂２丁目３−１ 渋谷駅前ビル １F", tel:"03-6416-3336" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 渋谷道玄坂店", addr:"〒150-0043 東京都渋谷区道玄坂２丁目２５−１４ カネダイビル 2・3階", tel:"03-6455-2939" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 町田店", addr:"〒194-0013 東京都町田市原町田６丁目１１−１１ T-wingmachida 4F", tel:"042-851-8480" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 立川店", addr:"〒190-0022 東京都立川市錦町１丁目２−１８ 澤田ビル 1階", tel:"042-512-8668" },
  { region:"tokyo", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 新宿歌舞伎町店", addr:"〒160-0021 東京都新宿区歌舞伎町１丁目１７−４ ポケットビル", tel:"03-6380-3951" },

  // 神奈川
  { region:"kanagawa", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 川崎駅東口店", addr:"〒210-0007 神奈川県川崎市川崎区駅前本町３−３ ムラタヤビル ４階", tel:"044-589-4494" },
  { region:"kanagawa", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 溝の口店", addr:"〒213-0001 神奈川県川崎市高津区溝口１丁目１１−２３ タイムワンビル ２階", tel:"044-455-4944" },
  { region:"kanagawa", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 藤沢店", addr:"〒251-0025 神奈川県藤沢市鵠沼石上１丁目３−３ 相模プラザ第5ビル 3階", tel:"0466-52-8466" },

  // 東海
  { region:"tokai", brand:"tori", name:"居酒屋鶏ヤロー 名古屋栄2号店", addr:"〒460-0008 愛知県名古屋市中区栄３丁目９−２７", tel:"052-228-4655" },
  { region:"tokai", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 名古屋駅前店", addr:"〒450-0002 愛知県名古屋市中村区名駅３丁目１８−９ Mizunoビル 1F", tel:"052-433-6733" },
  { region:"tokai", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 名古屋栄1号店", addr:"〒460-0008 愛知県名古屋市中区栄３丁目２−２９ 長谷川ビル 1F", tel:"052-253-9949" },

  // 関西
  { region:"kansai", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 京都三条店", addr:"〒604-8004 京都府京都市中京区中島町４４９−１ Aune京都三条 4階", tel:"075-708-8776" },
  { region:"kansai", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ なんば千日前店", addr:"〒542-0075 大阪府大阪市中央区難波千日前11-20 遊企画ビル 2F", tel:"06-6626-9985" },
  { region:"kansai", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 京都西院店", addr:"〒615-0014 京都府京都市右京区西院巽町-2-2", tel:"075-950-0470" },
  { region:"kansai", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 心斎橋店", addr:"〒542-0083 大阪府大阪市中央区東心斎橋１丁目１８−６ ギャラリービル B1階", tel:"06-4963-3574" },
  { region:"kansai", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 梅田茶屋町店", addr:"〒530-0013 大阪府大阪市北区茶屋町３−４ チロル茶屋町ビル 5階", tel:"06-4256-8107" },
  { region:"kansai", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 三宮2F店", addr:"〒650-0012 兵庫県神戸市中央区北長狭通１丁目１０−６ ムーンライトビル 2F", tel:"078-381-5842" },
  { region:"kansai", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 三宮B1F店", addr:"〒650-0012 兵庫県神戸市中央区北長狭通１丁目７−６ ホワイトローズタワ Ｂ１Ｆ", tel:"078-954-7448" },
  { region:"kansai", brand:"tori", name:"居酒屋それゆけ！鶏ヤロー！ 姫路店", addr:"〒670-0927 兵庫県姫路市駅前町３１７ 冨貴駅前ビル ４F", tel:"079-240-7058" },
];

const REGION_MATCH = {
  all: () => true,
  tohoku: s => s.region === "tohoku",
  tokyo: s => s.region === "tokyo",
  saitama: s => s.region === "saitama",
  chiba: s => s.region === "chiba",
  kanagawa: s => s.region === "kanagawa",
  kanto: s => ["kanto","tokyo","saitama","chiba","kanagawa"].includes(s.region),
  tokai: s => s.region === "tokai",
  kansai: s => s.region === "kansai",
};

// =====================
// 店舗描画
// =====================
const storesEl = document.getElementById('stores');
const countEl = document.getElementById('storeCount');
const searchEl = document.getElementById('storeSearch');
const filtersEl = document.getElementById('storeFilters');
let currentRegion = 'all';

function renderStores() {
  if (!storesEl) return;
  const kw = (searchEl?.value || '').trim().toLowerCase();
  const list = STORES.filter(REGION_MATCH[currentRegion] || REGION_MATCH.all).filter(s => {
    if (!kw) return true;
    return (s.name + s.addr).toLowerCase().includes(kw);
  });

  if (list.length === 0) {
    storesEl.innerHTML = '<p class="store-empty">該当する店舗が見つかりませんでした。</p>';
    countEl.textContent = '';
    return;
  }

  storesEl.innerHTML = list.map(s => `
    <article class="store-card brand-${s.brand}">
      <p class="store-name">
        <span class="store-badge">${s.brand === 'tori' ? '鶏ヤロー' : 'まる助'}</span>
        ${s.name}
      </p>
      <p class="store-addr">${s.addr}</p>
      <a class="store-tel" href="tel:${s.tel.replace(/[^0-9]/g,'')}">📞 ${s.tel}</a>
    </article>
  `).join('');
  countEl.textContent = `${list.length}店舗を表示中（全${STORES.length}店舗）`;
}

if (filtersEl) {
  // 件数表示
  const allCntEl = filtersEl.querySelector('[data-region="all"] .cnt');
  if (allCntEl) allCntEl.textContent = `(${STORES.length})`;

  filtersEl.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      filtersEl.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      currentRegion = c.dataset.region;
      renderStores();
    });
  });
}
if (searchEl) searchEl.addEventListener('input', renderStores);
renderStores();

// 応募フォームの店舗プルダウン生成
const storeSelect = document.getElementById('storeSelect');
if (storeSelect) {
  STORES.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    storeSelect.appendChild(opt);
  });
}

// =====================
// 募集要項タブ
// =====================
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.req-table').forEach(t => {
      t.classList.toggle('hidden', t.dataset.pane !== target);
    });
  });
});

// =====================
// 応募フォーム
// =====================
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

// ヘッダー影
const header = document.querySelector('.header');
window.addEventListener('scroll', () => {
  if (header) header.style.boxShadow = window.scrollY > 20 ? '0 6px 20px rgba(0,0,0,.3)' : 'none';
}, { passive: true });
