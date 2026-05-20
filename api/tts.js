import { ENABLE_AI_RECOGNIZE_AND_VOICE } from '../shared/features.js';
import { synthesizeSpeech } from '../shared/ttsCore.js';

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
    const { text, lang } = req.body || {};
    if (!text) {
      return res.status(400).json({ ok: false, reason: 'missing_text' });
    }

    const result = await synthesizeSpeech({ text, lang: lang || 'zh' });
    if (!result) {
      return res.status(503).json({ ok: false, reason: 'no_api_key' });
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[api/tts]', err);
    return res.status(500).json({ ok: false, reason: 'server_error' });
  }
}
