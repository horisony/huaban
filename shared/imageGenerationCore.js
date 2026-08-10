import { getOpenAIApiKey, getRealtimeApiBase } from './openaiConfig.js';
import {
  getCommonstackApiBase,
  getCommonstackApiKey,
  getCommonstackImageModel,
  getImageProvider,
} from './commonstackConfig.js';

const DEFAULT_MODEL = 'gpt-image-2';

function getImageModel() {
  return process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
}

function buildScreenPrompt(prompt) {
  return `Create a child-friendly black-and-white illustration for a 300 x 400 pixel reflective monochrome display.

Subject requested by the child: ${prompt}

Art direction:
- portrait 3:4 composition, one clear focal subject
- pure white background and strong solid black outlines
- simple, charming picture-book line art
- large recognizable shapes, minimal small details
- no gray, no gradients, no shadows, no color, no text, no border
- keep important content away from the outer 5 percent so it survives cropping
- suitable for a young child and easy to understand at a glance`;
}

export async function generateScreenDrawing({ prompt }) {
  const cleanPrompt = String(prompt || '').trim().slice(0, 800);
  if (!cleanPrompt) {
    return { ok: false, reason: 'missing_prompt' };
  }

  if (getImageProvider() === 'commonstack') {
    return generateWithCommonstack(cleanPrompt);
  }
  return generateWithOpenAI(cleanPrompt);
}

async function generateWithCommonstack(cleanPrompt) {
  const apiKey = getCommonstackApiKey();
  if (!apiKey) return null;
  const model = getCommonstackImageModel();
  const response = await fetch(`${getCommonstackApiBase()}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: buildScreenPrompt(cleanPrompt) }],
      }],
      size: '1K',
      aspect_ratio: '3:4',
      response_format: { type: 'base64' },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Commonstack image generation ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.url;
  const base64 = imageUrl?.startsWith('data:') ? imageUrl : null;
  if (!base64) throw new Error('Commonstack image generation returned no image');

  return { ok: true, prompt: cleanPrompt, model, image: base64 };
}

async function generateWithOpenAI(cleanPrompt) {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return null;
  const model = getImageModel();
  const response = await fetch(`${getRealtimeApiBase()}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: buildScreenPrompt(cleanPrompt),
      size: '1024x1536',
      quality: 'low',
      output_format: 'png',
      n: 1,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI image generation ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const base64 = data.data?.[0]?.b64_json;
  if (!base64) throw new Error('OpenAI image generation returned no image');

  return {
    ok: true,
    prompt: cleanPrompt,
    model,
    image: `data:image/png;base64,${base64}`,
  };
}
