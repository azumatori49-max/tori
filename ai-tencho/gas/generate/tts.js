/**
 * generate/tts.js — 音声合成と MP3 キャッシュ（§7）
 *
 * Web Speech API はブラウザの自動再生制限で自走できないため、サーバー側で
 * Google Cloud Text-to-Speech により MP3 を生成し、Drive に置いて URL を配る。
 *
 * キャッシュ: キー = SHA-256(text + voice + rate)。固定文言は初回生成後ずっと再利用され、
 * 日々合成されるのは数字を含む朝礼などの可変部分のみ。
 */

const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/**
 * テキストを MP3 化して再生用 URL を返す。失敗時は null（音声なしで表示のみ継続）。
 */
function ttsToUrl_(text) {
  try {
    const voice = prop_('TTS_VOICE', 'ja-JP-Neural2-B');
    const rate = prop_('TTS_RATE', '1.0');
    const key = ttsCacheKey_(text, voice, rate);
    const folder = DriveApp.getFolderById(requiredProp_('DRIVE_AUDIO_FOLDER_ID'));

    // キャッシュ命中確認（ファイル名 = キー.mp3）
    const cached = folder.getFilesByName(key + '.mp3');
    if (cached.hasNext()) return driveAudioUrl_(cached.next());

    const res = withRetry_('tts', function () {
      return UrlFetchApp.fetch(TTS_ENDPOINT + '?key=' + requiredProp_('TTS_API_KEY'), {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          input: { text: text },
          voice: { languageCode: 'ja-JP', name: voice },
          audioConfig: { audioEncoding: 'MP3', speakingRate: Number(rate) }
        }),
        muteHttpExceptions: true
      });
    });
    if (res.getResponseCode() !== 200) throw new Error('TTS HTTP ' + res.getResponseCode());
    const audio = Utilities.base64Decode(JSON.parse(res.getContentText()).audioContent);
    const file = folder.createFile(Utilities.newBlob(audio, 'audio/mpeg', key + '.mp3'));
    // kiosk から認証なしで再生するための共有設定（CHANGES_FROM_SPEC.md #8）
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return driveAudioUrl_(file);
  } catch (e) {
    logError_(e, 'TTS');
    return null; // 音声なしでも表示は続ける（劣化して動き続ける）
  }
}

function driveAudioUrl_(file) {
  return 'https://drive.google.com/uc?export=download&id=' + file.getId();
}

function ttsCacheKey_(text, voice, rate) {
  const raw = text + '|' + voice + '|' + rate;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return digest.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** 固定フレーズの事前生成（開店前に一度手動実行しておく。§7 キャッシュ設計） */
function pregenerateFixedPhrases() {
  Object.keys(FALLBACK_TEXTS).forEach(function (k) {
    ttsToUrl_(FALLBACK_TEXTS[k]);
  });
  appendLog('info', 'system', '', '固定フレーズのMP3を事前生成', '');
}
