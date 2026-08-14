import { createHash, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import { generateScreenDrawing } from './imageGenerationCore.js';
import { getOpenAIApiKey, getRealtimeApiBase } from './openaiConfig.js';

const FRAME_WIDTH = 400;
const FRAME_HEIGHT = 300;
const FRAME_ROW_BYTES = Math.ceil(FRAME_WIDTH / 8);
// Hash of the prototype device's high-entropy bearer token. The raw token lives
// only in the ignored firmware secrets file. Set HUABAN_DEVICE_TOKEN to rotate it.
const PROTOTYPE_DEVICE_TOKEN_SHA256 = 'cc635a3cd5a0af5cb4784a479aec56b7f704c0d32d25e3e8d2c79c02bdb4b747';

export function deviceRequestAuthorized(authorization) {
  const expected = process.env.HUABAN_DEVICE_TOKEN;
  const supplied = String(authorization || '').replace(/^Bearer\s+/i, '');
  if (!supplied) return false;
  if (expected) return authorization === `Bearer ${expected}`;
  const suppliedHash = createHash('sha256').update(supplied).digest();
  const expectedHash = Buffer.from(PROTOTYPE_DEVICE_TOKEN_SHA256, 'hex');
  return suppliedHash.length === expectedHash.length && timingSafeEqual(suppliedHash, expectedHash);
}

export async function transcribeDeviceAudio(wavBytes) {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return null;

  const form = new FormData();
  form.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-transcribe');
  form.append('language', 'zh');
  form.append('file', new Blob([wavBytes], { type: 'audio/wav' }), 'huaban.wav');

  const response = await fetch(`${getRealtimeApiBase()}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Audio transcription ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return String(data.text || '').trim();
}

export async function imageDataUrlToDeviceFrame(dataUrl) {
  const comma = String(dataUrl || '').indexOf(',');
  if (comma < 0) throw new Error('Invalid generated image');
  const input = Buffer.from(dataUrl.slice(comma + 1), 'base64');
  const { data } = await sharp(input)
    .flatten({ background: '#ffffff' })
    .resize(FRAME_WIDTH, FRAME_HEIGHT, {
      fit: 'contain',
      background: '#ffffff',
    })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // ST7305 inversion mode: a 1 bit is visually white and a 0 bit is black.
  const frame = Buffer.alloc(FRAME_ROW_BYTES * FRAME_HEIGHT, 0xff);
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      if (data[y * FRAME_WIDTH + x] < 145) {
        frame[y * FRAME_ROW_BYTES + Math.floor(x / 8)] &= ~(1 << (x & 7));
      }
    }
  }
  return frame;
}

export async function createDeviceDrawing(wavBytes) {
  const transcript = await transcribeDeviceAudio(wavBytes);
  if (!transcript) return { ok: false, reason: 'empty_transcript' };
  const drawing = await generateScreenDrawing({ prompt: transcript });
  if (!drawing?.ok || !drawing.image) {
    return drawing || { ok: false, reason: 'generation_failed' };
  }
  return {
    ok: true,
    transcript,
    frame: await imageDataUrlToDeviceFrame(drawing.image),
  };
}
