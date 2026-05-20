// Server-side recognition — vision (image) first, then text fallback.

import {
  getMiniMaxApiKey,
  getMiniMaxAnthropicBaseUrl,
  getMiniMaxChatModel,
} from './minimaxConfig.js';
import {
  computeFeatures,
  KID_NOUNS_ZH,
  KID_NOUNS_EN,
} from './inkFeatures.js';
import { callMiniMaxVision } from './visionCore.js';

export { computeFeatures, KID_NOUNS_ZH, KID_NOUNS_EN };

export function buildRecognizePrompt(grid, lang) {
  const features = computeFeatures(grid);
  const nounList = (lang === 'zh' ? KID_NOUNS_ZH : KID_NOUNS_EN).join(', ');
  const cols = grid.split('\n')[0]?.length || 0;
  const rows = grid.split('\n').filter(Boolean).length;

  return {
    features,
    prompt: `You are a warm, patient kindergarten art teacher looking at a 6-8 year old child's drawing on a chalkboard.
Below is an ASCII representation (# = chalk mark, . = empty) of the child's drawing on a ${cols}x${rows} grid.

DRAWING:
${grid}

FEATURES: aspect=${features.aspect.toFixed(2)}, density=${features.density.toFixed(3)}, bboxFill=${features.bboxFill.toFixed(2)}

TASK: Guess what simple object the child drew. It will be one of these common kid-drawing subjects:
${nounList}

Rules:
- Be generous and imaginative — kids' drawings are abstract. Pick the most likely match based on the pattern.
- NEVER say "I don't know" or "I'm not sure".
- Respond in JSON ONLY with this exact shape: {"guess_zh":"...","guess_en":"...","reaction_zh":"...","reaction_en":"..."}
- guess_zh/guess_en must come from the list above (matching pair).
- reaction_zh and reaction_en are warm, gentle, encouraging one-liners (under 18 words / 20 字) that mention what they drew. Tone: 温柔陪伴 / gentle companion. Use ～ in Chinese.
- No markdown, no commentary, JSON only.`,
  };
}

export function parseRecognizeResponse(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  const json = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
  const parsed = JSON.parse(json);
  if (!parsed.guess_zh || !parsed.guess_en) {
    throw new Error('Invalid recognition JSON');
  }
  return {
    guess_zh: parsed.guess_zh,
    guess_en: parsed.guess_en,
    reaction_zh: parsed.reaction_zh,
    reaction_en: parsed.reaction_en,
  };
}

function toResult(parsed, source) {
  return {
    ok: true,
    source,
    guess: { zh: parsed.guess_zh, en: parsed.guess_en },
    reaction: { zh: parsed.reaction_zh, en: parsed.reaction_en },
  };
}

export async function callMiniMaxRecognize(prompt) {
  const apiKey = getMiniMaxApiKey();
  if (!apiKey) return null;

  const baseUrl = getMiniMaxAnthropicBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: getMiniMaxChatModel(),
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');
  if (!text) throw new Error('Empty MiniMax response');
  return text;
}

export async function recognizeWithAI({ grid, image, lang }) {
  const features = grid ? computeFeatures(grid) : { inkCells: image ? 999 : 0 };
  if (features.inkCells < 6 && !image) {
    return { ok: false, reason: 'empty' };
  }

  // 1) Vision: send the actual drawing image (Token Plan VLM)
  if (image) {
    try {
      const raw = await callMiniMaxVision(image, lang);
      const parsed = parseRecognizeResponse(raw);
      return toResult(parsed, 'vision');
    } catch (err) {
      console.warn('[recognize] Vision failed, trying text:', err.message);
    }
  }

  // 2) Text: ASCII grid + M2.7
  if (grid && features.inkCells >= 6) {
    try {
      const { prompt } = buildRecognizePrompt(grid, lang);
      const raw = await callMiniMaxRecognize(prompt);
      if (raw) {
        const parsed = parseRecognizeResponse(raw);
        return toResult(parsed, 'text');
      }
    } catch (err) {
      console.warn('[recognize] Text AI failed:', err.message);
    }
  }

  return { ok: false, reason: 'no_api_key' };
}
