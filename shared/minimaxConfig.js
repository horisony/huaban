// MiniMax Token Plan — shared env config (recognition + TTS).

function env() {
  return typeof process !== 'undefined' ? process.env : {};
}

export function getMiniMaxApiKey() {
  const e = env();
  return e.MINIMAX_API_KEY || e.ANTHROPIC_API_KEY || null;
}

export function getMiniMaxAnthropicBaseUrl() {
  const e = env();
  return e.MINIMAX_BASE_URL || e.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic';
}

export function getMiniMaxChatModel() {
  const e = env();
  return e.MINIMAX_MODEL || e.ANTHROPIC_MODEL || 'MiniMax-M2.7';
}

export function getMiniMaxTtsModel() {
  return env().MINIMAX_TTS_MODEL || 'speech-2.8-turbo';
}

export function getMiniMaxVoiceId(lang) {
  const e = env();
  if (lang === 'zh') {
    return e.MINIMAX_VOICE_ZH || 'female-shaonv';
  }
  return e.MINIMAX_VOICE_EN || 'English_Graceful_Lady';
}

export function getMiniMaxApiHost() {
  const e = env();
  return e.MINIMAX_API_HOST || e.MINIMAX_TTS_BASE_URL || 'https://api.minimaxi.com';
}

export function getMiniMaxTtsApi() {
  return getMiniMaxApiHost();
}
