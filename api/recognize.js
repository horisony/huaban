import { ENABLE_AI_RECOGNIZE_AND_VOICE } from '../shared/features.js';
import { recognizeWithAI } from '../shared/recognizeCore.js';

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
  if (!ENABLE_AI_RECOGNIZE_AND_VOICE) {
    return res.status(503).json({ ok: false, reason: 'feature_disabled' });
  }

  try {
    const { image, grid, lang } = req.body || {};
    if (!image && !grid) {
      return res.status(400).json({ ok: false, reason: 'missing_image' });
    }
    const result = await recognizeWithAI({ image, grid, lang: lang || 'zh' });
    return res.status(result.ok ? 200 : 422).json(result);
  } catch (err) {
    console.error('[api/recognize]', err);
    return res.status(500).json({ ok: false, reason: 'server_error' });
  }
}
