import { REACTIONS } from '../data/i18n.js';
import { computeFeatures, KID_NOUNS_ZH, KID_NOUNS_EN } from '../../shared/inkFeatures.js';

let currentAudio = null;

function heuristicGuess(features, lang) {
  const { aspect, density } = features;
  const idx =
    aspect > 1.6 ? 0
      : aspect < 0.65 ? 6
        : density > 0.18 ? 2
          : density > 0.1 ? 4
            : 7;
  const list = lang === 'zh' ? KID_NOUNS_ZH : KID_NOUNS_EN;
  return list[idx % list.length];
}

function heuristicResult(features, lang) {
  const thingZh = heuristicGuess(features, 'zh');
  const thingEn = heuristicGuess(features, 'en');
  const reactZh = REACTIONS.zh[Math.floor(Math.random() * REACTIONS.zh.length)].replace('{thing}', thingZh);
  const reactEn = REACTIONS.en[Math.floor(Math.random() * REACTIONS.en.length)].replace('{thing}', thingEn);
  return {
    ok: true,
    source: 'heuristic',
    guess: { zh: thingZh, en: thingEn },
    reaction: { zh: reactZh, en: reactEn },
  };
}

export async function recognizeDrawing({ image, grid, lang }) {
  const features = grid ? computeFeatures(grid) : { inkCells: image ? 999 : 0 };
  if (features.inkCells < 6 && !image) {
    return { ok: false, reason: 'empty' };
  }

  try {
    const res = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, grid, lang }),
    });
    const data = await res.json();
    if (res.ok && data.ok && data.guess && data.reaction) {
      return data;
    }
    if (data.reason === 'no_api_key') {
      console.warn('Recognition: MINIMAX_API_KEY not configured, using heuristic');
    }
  } catch (err) {
    console.warn('API recognition failed:', err);
  }

  if (grid && features.inkCells >= 6) {
    return heuristicResult(features, lang);
  }
  return { ok: false, reason: 'empty' };
}

function speakWithWebSpeech(text, lang = 'zh') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    u.rate = lang === 'zh' ? 0.95 : 1.0;
    u.pitch = 1.15;
    u.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const prefer = voices.find((v) =>
      v.lang.toLowerCase().startsWith(lang === 'zh' ? 'zh' : 'en')
      && /female|girl|woman|samantha|karen|tingting|mei-jia|xiaoxiao/i.test(v.name),
    ) || voices.find((v) => v.lang.toLowerCase().startsWith(lang === 'zh' ? 'zh' : 'en'));
    if (prefer) u.voice = prefer;
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn('Web Speech fallback failed:', e);
  }
}

export async function speak(text, lang = 'zh') {
  if (typeof window === 'undefined') return;
  stopSpeaking();

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.audio) {
        const mime = data.format === 'wav' ? 'audio/wav' : 'audio/mpeg';
        const audio = new Audio(`data:${mime};base64,${data.audio}`);
        currentAudio = audio;
        await audio.play();
        return;
      }
    }
  } catch (err) {
    console.warn('MiniMax TTS failed, using Web Speech:', err);
  }

  speakWithWebSpeech(text, lang);
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
