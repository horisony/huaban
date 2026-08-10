import { createRealtimeSession } from '../shared/realtimeCore.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  }

  try {
    const { lang } = req.body || {};
    const result = await createRealtimeSession({ lang: lang === 'en' ? 'en' : 'zh' });
    if (!result) {
      return res.status(503).json({ ok: false, reason: 'no_api_key' });
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[api/realtime-session]', err);
    return res.status(500).json({ ok: false, reason: 'server_error' });
  }
}
