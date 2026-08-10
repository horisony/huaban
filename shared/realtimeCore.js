// OpenAI Realtime (GPT Live) — create an ephemeral session token server-side.
// The browser uses this token to open its own WebSocket / WebRTC connection.

import {
  getOpenAIApiKey,
  getRealtimeModel,
  getRealtimeVoice,
  getRealtimeApiBase,
} from './openaiConfig.js';
import { buildTeacherInstructions } from './teacherPrompt.js';

export async function createRealtimeSession({ lang = 'zh' } = {}) {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return null;

  const model = getRealtimeModel();
  const voice = getRealtimeVoice();

  const res = await fetch(`${getRealtimeApiBase()}/v1/realtime/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      modalities: ['audio', 'text'],
      voice,
      instructions: buildTeacherInstructions(lang),
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 700,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI Realtime session ${res.status}: ${err}`);
  }

  const data = await res.json();
  const clientSecret = data.client_secret?.value || data.value;
  if (!clientSecret) {
    throw new Error('OpenAI Realtime: no client secret in response');
  }

  return {
    clientSecret,
    model: data.model || model,
    voice: data.voice || voice,
    expiresAt: data.client_secret?.expires_at || null,
  };
}
