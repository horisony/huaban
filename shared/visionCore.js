// MiniMax Token Plan — image understanding (/v1/coding_plan/vlm)

import { getMiniMaxApiKey, getMiniMaxApiHost } from './minimaxConfig.js';
import { KID_NOUNS_ZH, KID_NOUNS_EN } from './inkFeatures.js';

export function buildVisionPrompt(lang) {
  const nounsZh = KID_NOUNS_ZH.join('、');
  const nounsEn = KID_NOUNS_EN.join(', ');

  return `You are a warm kindergarten art teacher looking at a 6-8 year old child's chalk drawing on a green chalkboard.

Look carefully at the ACTUAL drawing in the image (chalk strokes on the board). Do not guess randomly.

The child likely drew one of these simple subjects:
Chinese: ${nounsZh}
English: ${nounsEn}

Pick the best matching pair from the lists above.

Respond with JSON ONLY (no markdown):
{"guess_zh":"...","guess_en":"...","reaction_zh":"...","reaction_en":"..."}

Rules:
- guess_zh and guess_en MUST be exact words from the lists (matching pair).
- reaction_zh: warm encouraging one line under 20 Chinese chars, use ～, mention what they drew.
- reaction_en: warm encouraging one line under 18 words.
- Be generous — kids' drawings are abstract, but must relate to visible strokes.
- Language for reactions: ${lang === 'zh' ? 'prefer reaction_zh tone' : 'prefer reaction_en tone'}.`;
}

export async function callMiniMaxVision(imageDataUrl, lang = 'zh') {
  const apiKey = getMiniMaxApiKey();
  if (!apiKey) return null;
  if (!imageDataUrl) return null;

  const host = getMiniMaxApiHost().replace(/\/$/, '');
  const res = await fetch(`${host}/v1/coding_plan/vlm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'MM-API-Source': 'huaban-drawing-buddy',
    },
    body: JSON.stringify({
      prompt: buildVisionPrompt(lang),
      image_url: imageDataUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax VLM ${res.status}: ${err}`);
  }

  const data = await res.json();
  const baseResp = data.base_resp;
  if (baseResp && baseResp.status_code !== 0) {
    throw new Error(`MiniMax VLM: ${baseResp.status_msg || baseResp.status_code}`);
  }

  const content = data.content;
  if (!content) throw new Error('Empty VLM response');
  return content;
}
