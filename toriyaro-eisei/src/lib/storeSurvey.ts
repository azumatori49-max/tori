const centralSurveyOrigin = 'https://toriyaro-surveys.azumatori49.chatgpt.site';
const additionalSurveyStores: Record<string, string> = {
  store_e567a64b: 'd-1',
  store_2a3747cb: 'd-3',
  store_4187419d: 'd-4',
  store_a5905d10: 'd-6',
  store_309aa02b: 'd-7',
  store_2e97ebfc: 'd-8',
  store_d833a293: 'd-9',
  store_2eaa937b: 'd-10',
  store_fac0e68a: 'd-11',
  store_bef8d6b0: 'd-12',
  store_38026f88: 'd-13',
  store_0993469b: 'd-16',
  store_1b9f586d: 'izakara-machida',
  store_1bd14808: 'd-17',
  store_5b276e7a: 'd-19',
  store_bffb116a: 'd-20',
  store_e67bf1b5: 'd-29',
  store_c97c5661: 'd-30',
  store_703035d0: 'd-31',
  store_e13bfd3d: 'd-32',
  store_e68ac327: 'd-33',
  store_7c565cf0: 'd-35',
  store_d4bd5ec3: 'd-36',
  store_3c821643: 'd-37',
  store_5f362261: 'd-38',
  store_554b1e76: 'd-39',
  store_51353a62: 'd-40',
  store_bcfcdf5a: 'd-41',
  store_dcd3114b: 'd-42',
  store_71503e92: 'd-43',
  store_7f4bbb4a: 'd-44',
  store_c2b9cb8e: 'd-45',
  store_476970d8: 'd-46',
  store_64fd20a6: 'd-47',
  store_fc219b2f: 'd-48',
  store_979a3c69: 'd-49',
  store_3e6bb520: 'd-50',
  store_b6ffeb26: 'd-51',
  store_dc10332e: 'd-52',
  store_602dfdf7: 'd-54',
  store_970aeb56: 'd-55',
  store_757e8a58: 'd-56',
  store_51adf5e5: 'd-59',
  store_a18e101d: 'kamiooka',
  store_f7320ec3: 'sushitori-okachimachi',
  store_d7f97d5c: 'sushitori-shimbashi',
  store_60cd8d7f: 'sushitori-akihabara',
  store_c3bba8b1: 'sushitori-shiki',
  store_2acc3ccf: 'sushitori-kashiwa',
  store_7d8d5f35: 'sushitori-dotonbori',
  store_e16746f6: 'sushitori-kitasenju',
  store_f1b8e7de: 'marusuke-machida',
  store_7a2c4dd6: 'marusuke-omiya-ichibangai',
  store_b39a9c11: 'marusuke-kumagaya',
  store_74982693: 'marusuke-seibu-chichibu',
  store_654ba2d2: 'marusuke-higashimatsuyama',
  store_0826b21e: 'marusuke-kawagoe',
  store_4a76043d: 'marusuke-miyanokawa',
  store_a799bbbb: 'marusuke-takasaki',
  store_b1a0c9b7: 'yakutoriya-soka',
};
const surveys: Record<string, string> = {
  store_0a122e63: 'https://toriyaro-okayama-survey.azumatori49.chatgpt.site/staff',
  store_8076d145: 'https://toriyaro-chibachuo-survey.azumatori49.chatgpt.site/staff',
  store_4683aab2: 'https://toriyaro-nagasaki-survey.azumatori49.chatgpt.site/staff',
};
const sessionKey = (storeKey: string) => 'toriyaro-eisei.survey-session.' + storeKey;
export function storeSurveyUrl(storeKey: string): string | null {
  if (Object.prototype.hasOwnProperty.call(surveys, storeKey)) return surveys[storeKey];
  if (!Object.prototype.hasOwnProperty.call(additionalSurveyStores, storeKey)) return null;
  return centralSurveyOrigin + '/staff?store=' + encodeURIComponent(additionalSurveyStores[storeKey]);
}
export function clearStoreSurveySessions() {
  if (typeof window === 'undefined') return;
  try {
    for (const storeKey of [...Object.keys(surveys), ...Object.keys(additionalSurveyStores)]) window.localStorage.removeItem(sessionKey(storeKey));
  } catch { /* Browser storage can be disabled. */ }
}
export async function connectStoreSurvey(storeKey: string, password: string, firebaseIdToken: string, fetcher: typeof fetch = fetch) {
  const url = storeSurveyUrl(storeKey);
  if (!url) return;
  const response = await fetcher(new URL('/api/store-session', url), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeKey, password, firebaseIdToken }),
    signal: AbortSignal.timeout(12000), cache: 'no-store',
  });
  const data = await response.json() as { token?: string; expiresAt?: number; error?: string };
  if (!response.ok || typeof data.token !== 'string' || !data.token || typeof data.expiresAt !== 'number' || data.expiresAt <= Date.now()) {
    throw new Error(data.error || 'アンケートに接続できませんでした。');
  }
  window.localStorage.setItem(sessionKey(storeKey), JSON.stringify({ token: data.token, expiresAt: data.expiresAt }));
}
export function storeSurveyAccessUrl(storeKey: string): string | null {
  const url = storeSurveyUrl(storeKey);
  if (!url || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(sessionKey(storeKey));
    if (!raw) return null;
    const session = JSON.parse(raw) as { token?: string; expiresAt?: number };
    if (typeof session.token !== 'string' || !session.token || session.token.length > 2048 || typeof session.expiresAt !== 'number' || session.expiresAt <= Date.now()) {
      window.localStorage.removeItem(sessionKey(storeKey));
      return null;
    }
    return url + '#access=' + encodeURIComponent(session.token);
  } catch { return null; }
}
