/**
 * Cloudflare Worker — Azure Face API プロキシ
 *
 * セットアップ:
 *   npm install -g wrangler
 *   wrangler login
 *   wrangler secret put AZURE_FACE_KEY      # キーを安全に登録
 *   wrangler deploy
 *
 * wrangler.toml の AZURE_FACE_ENDPOINT を自分のリソース名に変更すること。
 */
export default {
  async fetch(request, env) {
    // CORS プリフライト
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405);
    }

    const imageBytes = await request.arrayBuffer();
    if (imageBytes.byteLength === 0) {
      return json({ error: '画像データがありません' }, 400);
    }

    const azureUrl =
      `${env.AZURE_FACE_ENDPOINT}/face/v1.0/detect` +
      `?returnFaceAttributes=age&detectionModel=detection_03&recognitionModel=recognition_04`;

    const azureRes = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': env.AZURE_FACE_KEY,
      },
      body: imageBytes,
    });

    if (!azureRes.ok) {
      const err = await azureRes.text();
      console.error('Azure error', azureRes.status, err);
      return json({ error: 'Azure API エラー' }, 502);
    }

    const faces = await azureRes.json();
    const age = faces[0]?.faceAttributes?.age;

    if (age == null) {
      return json({ error: '顔が検出されませんでした' }, 422);
    }

    return json({ age });
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
