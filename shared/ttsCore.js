import {
  getMiniMaxApiKey,
  getMiniMaxTtsModel,
  getMiniMaxVoiceId,
  getMiniMaxTtsApi,
} from './minimaxConfig.js';

export async function synthesizeSpeech({ text, lang = 'zh' }) {
  const apiKey = getMiniMaxApiKey();
  if (!apiKey) return null;

  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  const res = await fetch(`${getMiniMaxTtsApi()}/v1/t2a_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getMiniMaxTtsModel(),
      text: trimmed,
      stream: false,
      voice_setting: {
        voice_id: getMiniMaxVoiceId(lang),
        speed: lang === 'zh' ? 0.95 : 1.0,
        vol: 1,
        pitch: 2,
        emotion: 'happy',
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
      language_boost: lang === 'zh' ? 'Chinese' : 'English',
      output_format: 'hex',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax TTS ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (data.base_resp?.status_code !== 0) {
    throw new Error(data.base_resp?.status_msg || 'MiniMax TTS failed');
  }

  const hex = data.data?.audio;
  if (!hex) throw new Error('MiniMax TTS returned no audio');

  const format = data.extra_info?.audio_format || 'mp3';
  return {
    audio: Buffer.from(hex, 'hex').toString('base64'),
    format,
  };
}
