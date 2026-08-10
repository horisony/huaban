import { generateScreenDrawing } from '../shared/imageGenerationCore.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  }

  try {
    const result = await generateScreenDrawing({ prompt: req.body?.prompt });
    if (!result) return res.status(503).json({ ok: false, reason: 'no_api_key' });
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    console.error('[api/generate-drawing]', error);
    return res.status(500).json({ ok: false, reason: 'generation_failed' });
  }
}
