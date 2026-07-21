/**
 * datasource/weather.js — 気象庁の予報データ取得
 *
 * https://www.jma.go.jp/bosai/forecast/data/forecast/{エリアコード}.json
 * 認証不要・無料。エリアコードは OPEN_QUESTIONS #12（現在は東京 130000 で仮置き）。
 * 天候係数のキーに合わせて sunny / cloudy / rain / snow の4値へ丸める。
 */

/** 当日の天気・最高気温・降水確率を返す。失敗時は例外（呼び元でフォールバック） */
function fetchTodayWeather_() {
  const area = prop_('JMA_AREA_CODE', CONFIG.JMA_AREA_CODE_DEFAULT);
  const url = 'https://www.jma.go.jp/bosai/forecast/data/forecast/' + area + '.json';
  const res = withRetry_('jma', function () {
    return UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  });
  const data = JSON.parse(res.getContentText());

  // data[0] が短期予報。timeSeries[0]=天気, [1]=降水確率, [2]=気温
  const ts = data[0].timeSeries;
  const weatherCode = ts[0].areas[0].weatherCodes[0];
  let precip = null;
  try {
    const pops = ts[1].areas[0].pops.map(Number).filter(function (p) { return !isNaN(p); });
    if (pops.length) precip = Math.max.apply(null, pops);
  } catch (e) { /* 降水確率は任意列 */ }
  let tempMax = null;
  try {
    const temps = ts[2].areas[0].temps.map(Number).filter(function (t) { return !isNaN(t); });
    if (temps.length) tempMax = Math.max.apply(null, temps);
  } catch (e) { /* 気温は任意列 */ }

  return { weather: jmaCodeToCategory_(weatherCode), tempMax: tempMax, precip: precip };
}

/** 気象庁の天気コード（100番台=晴, 200番台=曇, 300番台=雨, 400番台=雪）を係数キーへ */
function jmaCodeToCategory_(code) {
  const head = String(code).charAt(0);
  if (head === '1') return 'sunny';
  if (head === '2') return 'cloudy';
  if (head === '3') return 'rain';
  if (head === '4') return 'snow';
  return 'cloudy'; // 不明はもっとも係数中立な曇り扱い
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { jmaCodeToCategory_ };
}
