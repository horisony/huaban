import { ENABLE_AI_RECOGNIZE_AND_VOICE } from '../shared/features.js';
import { recognizeWithAI } from '../shared/recognizeCore.js';
import { synthesizeSpeech } from '../shared/ttsCore.js';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function createDevApiMiddleware() {
  return async (req, res, next) => {
    const url = req.url?.split('?')[0];

    if (
      !ENABLE_AI_RECOGNIZE_AND_VOICE
      && (url === '/api/recognize' || url === '/api/tts')
    ) {
      sendJson(res, 503, { ok: false, reason: 'feature_disabled' });
      return;
    }

    if (url === '/api/recognize' && req.method === 'POST') {
      try {
        const { image, grid, lang } = await readJsonBody(req);
        if (!image && !grid) {
          sendJson(res, 400, { ok: false, reason: 'missing_image' });
          return;
        }
        const result = await recognizeWithAI({ image, grid, lang: lang || 'zh' });
        sendJson(res, result.ok ? 200 : 422, result);
      } catch (err) {
        console.error('[api/recognize]', err);
        sendJson(res, 500, { ok: false, reason: 'server_error' });
      }
      return;
    }

    if (url === '/api/tts' && req.method === 'POST') {
      try {
        const { text, lang } = await readJsonBody(req);
        if (!text) {
          sendJson(res, 400, { ok: false, reason: 'missing_text' });
          return;
        }
        const result = await synthesizeSpeech({ text, lang: lang || 'zh' });
        if (!result) {
          sendJson(res, 503, { ok: false, reason: 'no_api_key' });
          return;
        }
        sendJson(res, 200, { ok: true, ...result });
      } catch (err) {
        console.error('[api/tts]', err);
        sendJson(res, 500, { ok: false, reason: 'server_error' });
      }
      return;
    }

    next();
  };
}
