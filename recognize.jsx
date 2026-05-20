// AI recognition + TTS feedback.
// Strategy:
//   1. Build a coarse ASCII grid of the drawing (works without vision support).
//   2. Compute simple stroke features (bbox, density, aspect).
//   3. Ask window.claude.complete to pick from a kid-friendly noun list AND
//      return a warm, gentle bilingual sentence.
//   4. Fallback to a heuristic guess if AI fails.

const KID_NOUNS_ZH = [
  '小鱼','小鸟','小猫','小狗','太阳','月亮','星星','小花','大树',
  '小房子','小船','苹果','气球','云朵','彩虹','小车','蝴蝶','兔子',
  '小人儿','心心','蛋糕','冰激凌','西瓜','雪人','蜗牛'
];
const KID_NOUNS_EN = [
  'fish','bird','cat','dog','sun','moon','star','flower','tree',
  'house','boat','apple','balloon','cloud','rainbow','car','butterfly','rabbit',
  'person','heart','cake','ice cream','watermelon','snowman','snail'
];

// Heuristic fallback: pick guess by simple features.
function heuristicGuess(features, lang) {
  const { aspect, density } = features;
  const idx =
    aspect > 1.6 ? 0       // wide → fish
    : aspect < 0.65 ? 6    // tall → star/tree
    : density > 0.18 ? 2   // dense → cat
    : density > 0.1 ? 4    // medium → sun
    : 7;                   // sparse → flower-ish
  const list = lang === 'zh' ? KID_NOUNS_ZH : KID_NOUNS_EN;
  return list[idx % list.length];
}

function computeFeatures(grid) {
  const lines = grid.split('\n').filter(Boolean);
  const rows = lines.length;
  const cols = lines[0]?.length || 1;
  let minX = cols, maxX = 0, minY = rows, maxY = 0, count = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (lines[y][x] === '#') {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return {
    aspect: w / h,
    density: count / (rows * cols),
    bboxFill: count / (w * h),
    inkCells: count,
  };
}

async function recognizeDrawing({ grid, lang }) {
  const features = computeFeatures(grid);
  if (features.inkCells < 6) {
    return { ok: false, reason: 'empty' };
  }

  const nounList = (lang === 'zh' ? KID_NOUNS_ZH : KID_NOUNS_EN).join(', ');
  const prompt =
`You are a warm, patient kindergarten art teacher looking at a 6-8 year old child's drawing on a chalkboard.
Below is an ASCII representation (# = chalk mark, . = empty) of the child's drawing on a ${grid.split('\n')[0].length}x${grid.split('\n').filter(Boolean).length} grid.

DRAWING:
${grid}

FEATURES: aspect=${features.aspect.toFixed(2)}, density=${features.density.toFixed(3)}, bboxFill=${features.bboxFill.toFixed(2)}

TASK: Guess what simple object the child drew. It will be one of these common kid-drawing subjects:
${nounList}

Rules:
- Be generous and imaginative — kids' drawings are abstract. Pick the most likely match.
- NEVER say "I don't know" or "I'm not sure".
- Respond in JSON ONLY with this exact shape: {"guess_zh":"...","guess_en":"...","reaction_zh":"...","reaction_en":"..."}
- guess_zh/guess_en must come from the list above (matching pair).
- reaction_zh and reaction_en are warm, gentle, encouraging one-liners (under 18 words / 20 字) that mention what they drew. Tone: 温柔陪伴 / gentle companion. Use ～ in Chinese.
- No markdown, no commentary, JSON only.`;

  try {
    const raw = await window.claude.complete(prompt);
    // Strip code fences if present
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    const json = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    const parsed = JSON.parse(json);
    if (parsed.guess_zh && parsed.guess_en) {
      return {
        ok: true,
        source: 'ai',
        guess: { zh: parsed.guess_zh, en: parsed.guess_en },
        reaction: { zh: parsed.reaction_zh, en: parsed.reaction_en },
      };
    }
  } catch (err) {
    console.warn('AI recognition failed:', err);
  }

  // Heuristic fallback
  const thingZh = heuristicGuess(features, 'zh');
  const thingEn = heuristicGuess(features, 'en');
  const reactZh = (window.REACTIONS.zh[Math.floor(Math.random() * window.REACTIONS.zh.length)]).replace('{thing}', thingZh);
  const reactEn = (window.REACTIONS.en[Math.floor(Math.random() * window.REACTIONS.en.length)]).replace('{thing}', thingEn);
  return {
    ok: true,
    source: 'heuristic',
    guess: { zh: thingZh, en: thingEn },
    reaction: { zh: reactZh, en: reactEn },
  };
}

// TTS via Web Speech API.
function speak(text, lang = 'zh') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    u.rate = lang === 'zh' ? 0.95 : 1.0;
    u.pitch = 1.15;
    u.volume = 1.0;
    // Prefer a female voice if available
    const voices = window.speechSynthesis.getVoices();
    const prefer = voices.find((v) =>
      v.lang.toLowerCase().startsWith(lang === 'zh' ? 'zh' : 'en') &&
      /female|girl|woman|samantha|karen|tingting|mei-jia|xiaoxiao/i.test(v.name)
    ) || voices.find((v) => v.lang.toLowerCase().startsWith(lang === 'zh' ? 'zh' : 'en'));
    if (prefer) u.voice = prefer;
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn('TTS failed:', e);
  }
}

function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

window.recognizeDrawing = recognizeDrawing;
window.speak = speak;
window.stopSpeaking = stopSpeaking;
