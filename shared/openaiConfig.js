// OpenAI Realtime (GPT Live) — shared env config.

function env() {
  return typeof process !== 'undefined' ? process.env : {};
}

export function getOpenAIApiKey() {
  return env().OPENAI_API_KEY || null;
}

export function getRealtimeModel() {
  return env().OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1';
}

export function getRealtimeVoice() {
  return env().OPENAI_REALTIME_VOICE || 'alloy';
}

export function getRealtimeApiBase() {
  return (env().OPENAI_REALTIME_API_BASE || 'https://api.openai.com').replace(/\/$/, '');
}
