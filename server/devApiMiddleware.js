import { createRealtimeSession } from '../shared/realtimeCore.js';
import { generateScreenDrawing } from '../shared/imageGenerationCore.js';

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

    if (url === '/api/realtime-session' && req.method === 'POST') {
      try {
        const { lang } = await readJsonBody(req);
        const result = await createRealtimeSession({ lang: lang === 'en' ? 'en' : 'zh' });
        if (!result) {
          sendJson(res, 503, { ok: false, reason: 'no_api_key' });
          return;
        }
        sendJson(res, 200, { ok: true, ...result });
      } catch (err) {
        console.error('[api/realtime-session]', err);
        sendJson(res, 500, { ok: false, reason: 'server_error' });
      }
      return;
    }

    if (url === '/api/generate-drawing' && req.method === 'POST') {
      try {
        const { prompt } = await readJsonBody(req);
        const result = await generateScreenDrawing({ prompt });
        if (!result) {
          sendJson(res, 503, { ok: false, reason: 'no_api_key' });
          return;
        }
        sendJson(res, result.ok ? 200 : 400, result);
      } catch (err) {
        console.error('[api/generate-drawing]', err);
        sendJson(res, 500, { ok: false, reason: 'generation_failed' });
      }
      return;
    }

    next();
  };
}
