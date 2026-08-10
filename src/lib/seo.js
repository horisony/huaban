const SEO = {
  zh: {
    title: '小画板 Drawing Buddy — 儿童在线画画、AI 互动老师',
    description: '免费儿童在线画板：粉笔涂鸦、分步绘画教程、作品集保存，AI 互动老师能看见孩子的画并温柔引导，陪孩子一起创作。适合 3–8 岁亲子。',
  },
  en: {
    title: 'Drawing Buddy — Kids Online Drawing Board with AI Teacher',
    description: 'Free kids drawing board: chalk doodles, step-by-step tutorials, gallery saves, and a live AI teacher who sees the drawing and guides gently. Ages 3–8.',
  },
};

export function getInitialLang() {
  if (typeof window === 'undefined') return 'zh';
  const q = new URLSearchParams(window.location.search).get('lang');
  if (q === 'en' || q === 'zh') return q;
  const stored = localStorage.getItem('huaban_lang');
  if (stored === 'en' || stored === 'zh') return stored;
  const nav = navigator.language?.toLowerCase() || '';
  return nav.startsWith('en') ? 'en' : 'zh';
}

export function applyPageSeo(lang) {
  const meta = SEO[lang] || SEO.zh;
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  document.title = meta.title;

  let desc = document.querySelector('meta[name="description"]');
  if (!desc) {
    desc = document.createElement('meta');
    desc.name = 'description';
    document.head.appendChild(desc);
  }
  desc.content = meta.description;

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = meta.title;
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.content = meta.description;
  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.content = meta.title;
  const twDesc = document.querySelector('meta[name="twitter:description"]');
  if (twDesc) twDesc.content = meta.description;

  try {
    localStorage.setItem('huaban_lang', lang);
  } catch { /* ignore */ }
}
