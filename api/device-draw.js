import { createDeviceDrawing, deviceRequestAuthorized } from '../shared/deviceDrawingCore.js';

export const config = {
  api: { bodyParser: false },
  maxDuration: 120,
};

function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('audio_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  }
  if (!deviceRequestAuthorized(req.headers.authorization)) {
    return res.status(401).json({ ok: false, reason: 'unauthorized' });
  }

  try {
    let wav;
    try {
      wav = await readBody(req);
    } catch (error) {
      if (error?.message === 'audio_too_large') {
        return res.status(413).json({ ok: false, reason: 'audio_too_large' });
      }
      throw error;
    }
    if (wav.length < 48 || wav.toString('ascii', 0, 4) !== 'RIFF') {
      return res.status(400).json({ ok: false, reason: 'invalid_wav' });
    }
    const result = await createDeviceDrawing(wav);
    if (!result?.ok) return res.status(400).json(result);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', result.frame.length);
    res.setHeader('X-Huaban-Prompt', encodeURIComponent(result.transcript));
    return res.status(200).send(result.frame);
  } catch (error) {
    console.error('[api/device-draw]', error);
    return res.status(500).json({ ok: false, reason: error?.message || 'device_draw_failed' });
  }
}
