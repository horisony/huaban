// Main app — Drawing Buddy
import { useState, useEffect, useRef, useCallback } from 'react';
import DrawingCanvas from './components/DrawingCanvas.jsx';
import { TutorialPlayer, TutorialLibrary } from './components/Tutorials.jsx';
import { I18N, TUTORIALS } from './data/i18n.js';
// import { recognizeDrawing, speak } from './lib/recognize.js';
import { applyPageSeo, getInitialLang } from './lib/seo.js';
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRadio,
  TweakToggle,
} from './components/TweaksPanel.jsx';

// 16 chalk colors — dusty pastels that read well on dark green
const CHALK_COLORS = [
  '#ffffff', '#fef9e7', '#fff1b8', '#ffd9a8',
  '#ffb3a8', '#ff8fa3', '#ffb1d8', '#e6b8ff',
  '#bcb6ff', '#9ec5ff', '#9ee0ff', '#9eecd9',
  '#b0e8a8', '#dff0a0', '#c8a878', '#000000',
];

// Crayon palette for kraft paper variant
const CRAYON_COLORS = [
  '#1a1a1a', '#7c3a1f', '#c2410c', '#dc2626',
  '#db2777', '#a21caf', '#6d28d9', '#1d4ed8',
  '#0369a1', '#0891b2', '#047857', '#15803d',
  '#65a30d', '#ca8a04', '#92400e', '#525252',
];

const THEMES = {
  classic: {
    wall: '#e3d2b0',
    wallNoise: 0.06,
    frame: 'linear-gradient(160deg, #6b4423 0%, #8b5a2b 40%, #6b4423 100%)',
    frameInset: 'inset 0 0 0 3px #4a2e1a, inset 0 0 28px rgba(0,0,0,.45), 0 18px 50px rgba(0,0,0,.35)',
    board: '#27433a',
    boardOverlay: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.05), transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(255,255,255,.03), transparent 55%)',
    chalk: CHALK_COLORS,
    paletteBg: '#3a2418',
    paletteText: '#f6ebd7',
    ledgeBg: 'linear-gradient(180deg, #8b5a2b, #5a3818)',
  },
  kraft: {
    wall: '#c9b58e',
    wallNoise: 0.1,
    frame: 'linear-gradient(160deg, #4a3520 0%, #6b4423 50%, #4a3520 100%)',
    frameInset: 'inset 0 0 0 2px #2a1a0a, inset 0 0 22px rgba(0,0,0,.35), 0 14px 40px rgba(0,0,0,.3)',
    board: '#d4b483',
    boardOverlay: 'repeating-linear-gradient(45deg, rgba(120,80,40,.04) 0 2px, transparent 2px 6px), radial-gradient(ellipse at 50% 50%, rgba(80,50,20,.08), transparent 70%)',
    chalk: CRAYON_COLORS,
    paletteBg: '#2a1a0a',
    paletteText: '#f0e0c0',
    ledgeBg: 'linear-gradient(180deg, #6b4423, #3a2010)',
  },
  slate: {
    wall: '#d8c8a8',
    wallNoise: 0.05,
    frame: 'linear-gradient(160deg, #2a2a2a 0%, #3d3d3d 50%, #1f1f1f 100%)',
    frameInset: 'inset 0 0 0 2px #0a0a0a, inset 0 0 24px rgba(0,0,0,.5), 0 16px 45px rgba(0,0,0,.4)',
    board: '#3a3a3e',
    boardOverlay: 'radial-gradient(ellipse at 35% 25%, rgba(255,255,255,.06), transparent 60%), radial-gradient(ellipse at 65% 75%, rgba(0,0,0,.15), transparent 60%)',
    chalk: CHALK_COLORS,
    paletteBg: '#1a1a1a',
    paletteText: '#f0f0f0',
    ledgeBg: 'linear-gradient(180deg, #3d3d3d, #1a1a1a)',
  },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "classic",
  "voice": false,
  "autoRecognize": false,
  "idleHint": true
}/*EDITMODE-END*/;

// Small inline SVG icons (kept simple, no decorative slop)
const Icon = ({ name, size = 18 }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'undo': return <svg {...props}><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-6.7L3 9" /></svg>;
    case 'redo': return <svg {...props}><path d="M21 7v6h-6" /><path d="M21 13a9 9 0 1 1-3-6.7L21 9" /></svg>;
    case 'eraser': return <svg {...props}><path d="M3 17l6 6h12" /><path d="M9 23L21 11 14 4 3 15z" /></svg>;
    case 'trash': return <svg {...props}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>;
    case 'save': return <svg {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></svg>;
    case 'gallery': return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>;
    case 'help': return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.8.5-2 1-2 2.5" /><circle cx="12" cy="17" r=".5" /></svg>;
    case 'book': return <svg {...props}><path d="M4 4v16a2 2 0 0 0 2 2h14V4H6a2 2 0 0 0-2 2z" /><path d="M9 4v18" /></svg>;
    case 'speaker-on': return <svg {...props}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.5 8.5a4 4 0 0 1 0 7" /><path d="M19 5a8 8 0 0 1 0 14" /></svg>;
    case 'speaker-off': return <svg {...props}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" /></svg>;
    case 'sparkle': return <svg {...props}><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>;
    case 'check': return <svg {...props}><polyline points="20 6 9 17 4 12" /></svg>;
    case 'x': return <svg {...props}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    default: return null;
  }
};

/* AI_RECOGNIZE_OFF — 画完识别反馈气泡，恢复时取消注释
function FeedbackBubble({ visible, text, onClose, thinking }) {
  if (!visible) return null;
  return (
    <div className="fb-bubble">
      <div className="fb-avatar">
        <div className="fb-bear">🐻</div>
      </div>
      <div className="fb-content">
        {thinking ? (
          <div className="fb-thinking">
            <span className="fb-dot" />
            <span className="fb-dot" />
            <span className="fb-dot" />
          </div>
        ) : (
          <div className="fb-text">{text}</div>
        )}
        {!thinking && <button className="fb-close" onClick={onClose} aria-label="close">×</button>}
      </div>
    </div>
  );
}
*/

function IdleHint({ visible, t, onYes, onNo }) {
  if (!visible) return null;
  return (
    <div className="idle-card">
      <div className="idle-bear">🐻</div>
      <div className="idle-msg">{t.idlePrompt}</div>
      <div className="idle-acts">
        <button className="idle-btn primary" onClick={onYes}>{t.yes}</button>
        <button className="idle-btn ghost" onClick={onNo}>{t.no}</button>
      </div>
    </div>
  );
}

function Gallery({ works, lang, t, onClose, onDelete, onLoad }) {
  return (
    <div className="lib-overlay" onClick={onClose}>
      <div className="lib-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="lib-head">
          <h3>{t.gallery} <span className="lib-count">({works.length})</span></h3>
          <button className="tut-x" onClick={onClose}>×</button>
        </div>
        {works.length === 0 ? (
          <div className="gal-empty">{t.galleryEmpty}</div>
        ) : (
          <div className="gal-grid">
            {works.map((w) => (
              <div key={w.id} className="gal-card">
                <img src={w.thumb} alt={w.label || ''} />
                <div className="gal-meta">
                  <div className="gal-label">{w.label || (lang === 'zh' ? '我的画' : 'My drawing')}</div>
                  <div className="gal-actions">
                    <button onClick={() => onLoad(w)}>↑</button>
                    <button onClick={() => onDelete(w.id)}>{t.delete}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme = THEMES[t.theme] || THEMES.classic;
  const [lang, setLang] = useState(getInitialLang);
  const L = I18N[lang];

  useEffect(() => {
    applyPageSeo(lang);
  }, [lang]);

  const [color, setColor] = useState(theme.chalk[0]);
  const [size, setSize] = useState(6);
  const [mode, setMode] = useState('draw'); // draw | eraser
  const canvasRef = useRef(null);

  // const [feedback, setFeedback] = useState({ visible: false, text: '', thinking: false });
  const [tutorial, setTutorial] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [works, setWorks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('huaban_gallery') || '[]'); }
    catch { return []; }
  });
  const [idleVisible, setIdleVisible] = useState(false);
  const [toast, setToast] = useState('');

  // Persist gallery
  useEffect(() => {
    localStorage.setItem('huaban_gallery', JSON.stringify(works));
  }, [works]);

  // Update color when theme switches
  useEffect(() => {
    if (!theme.chalk.includes(color)) setColor(theme.chalk[0]);
  }, [t.theme]);

  // Idle timer for "我不会画" prompt
  const idleTimer = useRef(null);
  const lastActivity = useRef(Date.now());
  // const recognizeTimer = useRef(null);

  const bumpActivity = useCallback(() => {
    lastActivity.current = Date.now();
    setIdleVisible(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!t.idleHint) return;
    idleTimer.current = setTimeout(() => {
      // Show idle only if user has drawn nothing and not in a tutorial
      const inked = canvasRef.current?.hasInk?.();
      if (!inked && !tutorial && !libraryOpen && !galleryOpen) {
        setIdleVisible(true);
      }
    }, 12000);
  }, [t.idleHint, tutorial, libraryOpen, galleryOpen]);

  useEffect(() => {
    bumpActivity();
    return () => idleTimer.current && clearTimeout(idleTimer.current);
  }, [bumpActivity]);

  /* AI_RECOGNIZE_OFF — 语音与画完自动识别
  const speakIfOn = (text) => { if (t.voice) speak(text, lang); };

  const runRecognition = async () => {
    const c = canvasRef.current;
    if (!c) return;
    if (!c.hasInk?.()) {
      setFeedback({ visible: true, text: L.empty, thinking: false });
      speakIfOn(L.empty);
      return;
    }
    setFeedback({ visible: true, text: '', thinking: true });
    const image = c.capture(480);
    const grid = c.getInkGrid(48, 36);
    let res;
    try {
      res = await recognizeDrawing({ image, grid, lang });
    } catch (e) {
      res = { ok: false };
    }
    if (!res.ok) {
      setFeedback({ visible: true, text: L.aiUnavailable, thinking: false });
      speakIfOn(L.aiUnavailable);
      return;
    }
    const txt = res.reaction[lang];
    setFeedback({ visible: true, text: txt, thinking: false });
    speakIfOn(txt);
  };
  */

  const handleStrokeStart = () => {
    bumpActivity();
    setIdleVisible(false);
  };

  const handleStrokeEnd = () => {
    bumpActivity();
  };

  const handleUndo = () => { canvasRef.current?.undo(); bumpActivity(); };
  const handleRedo = () => { canvasRef.current?.redo(); bumpActivity(); };
  const handleClear = () => {
    if (!canvasRef.current?.hasInk?.()) return;
    if (window.confirm(L.confirmClear)) {
      canvasRef.current?.clear();
    }
  };
  const handleSave = () => {
    const c = canvasRef.current;
    if (!c) return;
    if (!c.hasInk?.()) {
      setToast(L.empty);
      setTimeout(() => setToast(''), 2000);
      return;
    }
    const thumb = c.capture(400);
    const id = 'w_' + Date.now();
    setWorks((ws) => [{ id, thumb, ts: Date.now(), label: '' }, ...ws].slice(0, 30));
    setToast(L.saved);
    setTimeout(() => setToast(''), 2200);
  };
  const handleLoadWork = (w) => {
    canvasRef.current?.loadDataURL(w.thumb);
    setGalleryOpen(false);
  };
  const handleDeleteWork = (id) => setWorks((ws) => ws.filter((w) => w.id !== id));

  const startTutorial = (tut) => {
    setTutorial(tut);
    setLibraryOpen(false);
    setIdleVisible(false);
  };

  return (
    <div
      className={`hb-app theme-${t.theme}`}
      style={{ background: theme.wall }}
      onPointerMove={bumpActivity}
    >
      <div className="wall-noise" style={{ opacity: theme.wallNoise }} />

      {/* Top bar */}
      <header className="hb-top">
        <div className="hb-brand">
          <div className="hb-logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="32" height="32">
              <circle cx="16" cy="16" r="14" fill="#f4d7a0" stroke="#5a3818" strokeWidth="1.5" />
              <path d="M9 18c2-1 5-1 7 1s4 2 7 0" stroke="#5a3818" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <circle cx="12" cy="13" r="1.3" fill="#5a3818" />
              <circle cx="20" cy="13" r="1.3" fill="#5a3818" />
            </svg>
          </div>
          <div className="hb-titles">
            <div className="hb-title">{L.appName}</div>
            <div className="hb-tag">{L.tagline}</div>
          </div>
        </div>
        <div className="hb-top-right">
          {/* AI_RECOGNIZE_OFF — 语音开关
          <button
            className="hb-iconbtn"
            onClick={() => setTweak('voice', !t.voice)}
            title={t.voice ? L.voiceOn : L.voiceOff}
          >
            <Icon name={t.voice ? 'speaker-on' : 'speaker-off'} />
          </button>
          */}
          <button
            className="hb-iconbtn lang"
            onClick={() => {
              const next = lang === 'zh' ? 'en' : 'zh';
              setLang(next);
              const url = new URL(window.location.href);
              if (next === 'en') url.searchParams.set('lang', 'en');
              else url.searchParams.delete('lang');
              window.history.replaceState(null, '', url);
            }}
          >
            {lang === 'zh' ? '中 / EN' : 'EN / 中'}
          </button>
          <button className="hb-iconbtn" onClick={() => setLibraryOpen(true)} title={L.library}>
            <Icon name="book" /> <span className="lbl">{L.library}</span>
          </button>
          <button className="hb-iconbtn" onClick={() => setGalleryOpen(true)} title={L.gallery}>
            <Icon name="gallery" /> <span className="lbl">{L.gallery}</span>
          </button>
        </div>
        {/* AI_RECOGNIZE_OFF — 识别反馈气泡
        <div className="hb-top-center">
          <FeedbackBubble
            visible={feedback.visible}
            text={feedback.text}
            thinking={feedback.thinking}
            onClose={() => setFeedback({ visible: false, text: '', thinking: false })}
          />
        </div>
        */}
      </header>

      {/* Main board area */}
      <main className="hb-main">
        <div
          className="board-frame"
          style={{ background: theme.frame, boxShadow: theme.frameInset }}
        >
          <div className="board-inner" style={{ background: theme.board, backgroundImage: theme.boardOverlay }}>
            <DrawingCanvas
              ref={canvasRef}
              color={color}
              size={size}
              mode={mode}
              boardBg={theme.board}
              onStrokeStart={handleStrokeStart}
              onStrokeEnd={handleStrokeEnd}
            />
            <IdleHint
              visible={idleVisible}
              t={L}
              onYes={() => { setIdleVisible(false); setLibraryOpen(true); }}
              onNo={() => setIdleVisible(false)}
            />
            {tutorial && (
              <TutorialPlayer
                tutorial={tutorial}
                lang={lang}
                t={L}
                stroke={color === '#000000' ? '#ffffff' : color}
                onClose={() => setTutorial(null)}
                onPick={() => setLibraryOpen(true)}
              />
            )}
          </div>
          {/* Chalk ledge */}
          <div className="chalk-ledge" style={{ background: theme.ledgeBg }} />
        </div>

        {/* Toolbar */}
        <div className="hb-toolbar" style={{ background: theme.paletteBg, color: theme.paletteText }}>
          <div className="tb-section">
            <div className="tb-label">{L.colors}</div>
            <div className="palette">
              {theme.chalk.map((c) => (
                <button
                  key={c}
                  className={`swatch ${color === c && mode === 'draw' ? 'sel' : ''}`}
                  style={{ background: c }}
                  onClick={() => { setColor(c); setMode('draw'); }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div className="tb-section">
            <div className="tb-label">{L.brushSize}</div>
            <div className="brushes">
              {[3, 6, 10, 16, 24].map((s) => (
                <button
                  key={s}
                  className={`brush-btn ${size === s ? 'sel' : ''}`}
                  onClick={() => setSize(s)}
                >
                  <span className="brush-dot" style={{ width: s + 2, height: s + 2, background: mode === 'eraser' ? '#fff' : color }} />
                </button>
              ))}
            </div>
          </div>
          <div className="tb-section tools">
            <button
              className={`tool ${mode === 'eraser' ? 'on' : ''}`}
              onClick={() => setMode(mode === 'eraser' ? 'draw' : 'eraser')}
              title={L.eraser}
            >
              <Icon name="eraser" /> <span className="tlbl">{L.eraser}</span>
            </button>
            <button className="tool" onClick={handleUndo} title={L.undo}>
              <Icon name="undo" /> <span className="tlbl">{L.undo}</span>
            </button>
            <button className="tool" onClick={handleRedo} title={L.redo}>
              <Icon name="redo" /> <span className="tlbl">{L.redo}</span>
            </button>
            <button className="tool" onClick={handleClear} title={L.clear}>
              <Icon name="trash" /> <span className="tlbl">{L.clear}</span>
            </button>
            <button className="tool primary" onClick={handleSave} title={L.save}>
              <Icon name="save" /> <span className="tlbl">{L.save}</span>
            </button>
          </div>
          <div className="tb-section helpers">
            <button className="cta secondary" onClick={() => setLibraryOpen(true)}>
              <Icon name="help" />
              <span>{L.dontKnow}</span>
            </button>
            {/* AI_RECOGNIZE_OFF — 手动猜画
            <button className="cta primary" onClick={runRecognition} title={L.thinking}>
              <Icon name="sparkle" />
              <span>{lang === 'zh' ? '猜猜我画的是什么' : 'Guess what I drew'}</span>
            </button>
            */}
          </div>
        </div>
      </main>

      {libraryOpen && (
        <TutorialLibrary
          tutorials={TUTORIALS}
          lang={lang}
          t={L}
          onClose={() => setLibraryOpen(false)}
          onPick={startTutorial}
        />
      )}
      {galleryOpen && (
        <Gallery
          works={works}
          lang={lang}
          t={L}
          onClose={() => setGalleryOpen(false)}
          onDelete={handleDeleteWork}
          onLoad={handleLoadWork}
        />
      )}

      {toast && <div className="hb-toast">{toast}</div>}

      {import.meta.env.DEV && (
        <TweaksPanel>
          <TweakSection label={lang === 'zh' ? '视觉风格' : 'Visual style'} />
          <TweakRadio
            label={lang === 'zh' ? '画板' : 'Board'}
            value={t.theme}
            options={['classic', 'kraft', 'slate']}
            onChange={(v) => setTweak('theme', v)}
          />
          <TweakSection label={lang === 'zh' ? '行为' : 'Behavior'} />
          {/* AI_RECOGNIZE_OFF
          <TweakToggle label={lang === 'zh' ? '语音朗读' : 'Voice (TTS)'} value={t.voice} onChange={(v) => setTweak('voice', v)} />
          <TweakToggle label={lang === 'zh' ? '画完自动猜' : 'Auto recognize'} value={t.autoRecognize} onChange={(v) => setTweak('autoRecognize', v)} />
          */}
          <TweakToggle label={lang === 'zh' ? '空闲时提示' : 'Idle hint'} value={t.idleHint} onChange={(v) => setTweak('idleHint', v)} />
        </TweaksPanel>
      )}
    </div>
  );
}

export default App;
