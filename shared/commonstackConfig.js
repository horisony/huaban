function env() {
  return typeof process !== 'undefined' ? process.env : {};
}

export function getCommonstackApiKey() {
  return env().COMMONSTACK_API_KEY || null;
}

export function getCommonstackApiBase() {
  return (env().COMMONSTACK_API_BASE || 'https://api.commonstack.ai').replace(/\/$/, '');
}

export function getCommonstackImageModel() {
  return env().COMMONSTACK_IMAGE_MODEL || 'google/gemini-2.5-flash-image';
}

export function getImageProvider() {
  const configured = env().AI_IMAGE_PROVIDER?.toLowerCase();
  if (configured === 'commonstack' || configured === 'openai') return configured;
  return getCommonstackApiKey() ? 'commonstack' : 'openai';
}
