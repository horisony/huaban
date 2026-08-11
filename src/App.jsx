// Main app — Drawing Buddy
import { useState, useEffect, useRef, useCallback } from 'react';
import DrawingCanvas from './components/DrawingCanvas.jsx';
import { TutorialPlayer, TutorialLibrary } from './components/Tutorials.jsx';
import TeacherBar from './components/TeacherBar.jsx';
import { I18N, TUTORIALS } from './data/i18n.js';
import { applyPageSeo, getInitialLang } from './lib/seo.js';
import { useLiveTeacher } from './lib/useLiveTeacher.js';
import { Esp32Bridge } from './lib/esp32Bridge.js';
import { useVoiceDrawing } from './lib/useVoiceDrawing.js';
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
  "idleHint": true,
  "autoLook": true
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
  const esp32Ref = useRef(new Esp32Bridge());
  const [esp32Connected, setEsp32Connected] = useState(false);

  const handleGeneratedImage = useCallback((result) => {
    canvasRef.current?.loadDataURL(result.image);
    if (esp32Ref.current.connected) {
      esp32Ref.current.sendImage(result.image).then(() => {
        setToast(lang === 'zh' ? '画好了，已经显示到墨水屏上！' : 'Done — the picture is on the display!');
      }).catch(() => {
        setToast(lang === 'zh' ? '画好了，但发送到墨水屏失败了。' : 'Picture ready, but display transfer failed.');
      });
    } else {
      setToast(lang === 'zh' ? 'AI 已经画好啦！' : 'Your AI picture is ready!');
    }
    setTimeout(() => setToast(''), 3000);
  }, [lang]);

  // GPT Live 互动老师（能看到画板 + 语音对话）
  const teacher = useLiveTeacher({
    lang,
    autoLook: t.autoLook !== false,
    getSnapshot: () => canvasRef.current?.capture(720),
    hasInk: () => canvasRef.current?.hasInk?.(),
    onGeneratedImage: handleGeneratedImage,
  });
  const voiceDrawing = useVoiceDrawing({
    lang,
    onGeneratedImage: handleGeneratedImage,
    onError: (error) => {
      const unsupported = error?.message === 'speech_recognition_unsupported';
      setToast(unsupported
        ? (lang === 'zh' ? '当前浏览器不支持语音识别，请使用 Chrome。' : 'Use Chrome for voice recognition.')
        : (lang === 'zh' ? '语音画画暂时不可用，请再试一次。' : 'Voice drawing is temporarily unavailable.'));
      setTimeout(() => setToast(''), 3000);
    },
  });

  const [tutorial, setTutorial] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [works, setWorks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('huaban_gallery') || '[]'); }
    catch { return []; }
  });
  const [idleVisible, setIdleVisible] = useState(false);
  const [toast, setToast] = useState('');

  // Restore a previously granted Web Serial connection after page reloads.
  useEffect(() => {
    let active = true;
    const bridge = esp32Ref.current;
    bridge.connectAuthorized().then((connected) => {
      if (active && connected) setEsp32Connected(true);
    }).catch(() => {
      if (active) setEsp32Connected(false);
    });

    const handleDisconnect = (event) => {
      if (!bridge.port || event.port === bridge.port) {
        bridge.port = null;
        if (active) setEsp32Connected(false);
      }
    };
    navigator.serial?.addEventListener('disconnect', handleDisconnect);
    return () => {
      active = false;
      navigator.serial?.removeEventListener('disconnect', handleDisconnect);
    };
  }, []);

  // Persist gallery
  useEffect(() => {
    localStorage.setItem('huaban_gallery', JSON.stringify(works));
  }, [works]);

  // 老师出错时用 toast 提示
  useEffect(() => {
    if (!teacher.error) return;
    setToast(teacher.error);
    const id = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(id);
  }, [teacher.error]);

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

  const handleStrokeStart = () => {
    bumpActivity();
    setIdleVisible(false);
  };

  const handleStrokeEnd = () => {
    bumpActivity();
    teacher.noteStroke();
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

  const handleEsp32Connect = async () => {
    try {
      if (esp32Ref.current.connected) {
        await esp32Ref.current.disconnect();
        setEsp32Connected(false);
        return;
      }
      await esp32Ref.current.connect();
      setEsp32Connected(true);
      setToast(lang === 'zh' ? '墨水屏已连接' : 'Display connected');
      setTimeout(() => setToast(''), 2000);
    } catch (error) {
      const unsupported = error?.message === 'web_serial_unsupported';
      setToast(unsupported
        ? (lang === 'zh' ? '当前浏览器不支持 USB 串口，请使用 Chrome。' : 'Use Chrome for USB Serial support.')
        : (lang === 'zh' ? '没有连接墨水屏。' : 'Display was not connected.'));
      setTimeout(() => setToast(''), 3000);
    }
  };

  const handleTeacherLook = (kind = 'manual') => {
    if (!canvasRef.current?.hasInk?.()) {
      setToast(L.empty);
      setTimeout(() => setToast(''), 2000);
      return;
    }
    teacher.lookNow(kind);
  };

  const handleTutorialStep = (info) => {
    teacher.setTutorial(info);
  };

  const startTutorial = (tut) => {
    setTutorial(tut);
    setLibraryOpen(false);
    setIdleVisible(false);
    // 开始学画时告诉老师，让老师跟着这一步指导
    const first = tut.steps?.[0];
    teacher.setTutorial({
      id: tut.id,
      name: tut.name[lang],
      step: 0,
      total: tut.steps?.length ?? 0,
      hint: first?.hint?.[lang] || '',
    });
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
          <button
            className={`hb-iconbtn ${esp32Connected ? 'device-on' : ''}`}
            onClick={handleEsp32Connect}
            title={lang === 'zh' ? '连接墨水屏' : 'Connect display'}
          >
            <span aria-hidden="true">▣</span>
            <span className="lbl">{esp32Connected ? (lang === 'zh' ? '墨水屏已连接' : 'Display on') : (lang === 'zh' ? '连接墨水屏' : 'Connect display')}</span>
          </button>
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
        <div className="hb-top-center">
          {teacher.live && (
            <TeacherBar
              status={teacher.status}
              messages={teacher.messages}
              error={teacher.error}
              t={L}
              onLook={handleTeacherLook}
              onGuess={() => handleTeacherLook('guess')}
              onStop={teacher.stop}
            />
          )}
        </div>
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
                onClose={() => { teacher.setTutorial(null); setTutorial(null); }}
                onPick={() => setLibraryOpen(true)}
                onStepChange={handleTutorialStep}
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
            <button
              className={`cta primary ${voiceDrawing.active ? 'live-on' : ''}`}
              onClick={voiceDrawing.start}
              disabled={voiceDrawing.status === 'generating'}
              title={lang === 'zh' ? '说出你想画的东西' : 'Say what you want to draw'}
            >
              <Icon name="speaker-on" />
              <span>{voiceDrawing.status === 'listening'
                ? (lang === 'zh' ? '正在听…' : 'Listening…')
                : voiceDrawing.status === 'generating'
                  ? (lang === 'zh' ? 'AI 正在画…' : 'AI is drawing…')
                  : voiceDrawing.status === 'speaking'
                    ? (lang === 'zh' ? '正在回答…' : 'Speaking…')
                    : (lang === 'zh' ? '语音画画' : 'Voice drawing')}</span>
            </button>
            <button
              className={`cta primary ${teacher.live ? 'live-on' : ''}`}
              onClick={teacher.live ? teacher.stop : teacher.start}
              title={teacher.live ? L.teacherStop : L.teacherStart}
            >
              <Icon name="sparkle" />
              <span>{teacher.live ? L.teacherStop : L.teacherStart}</span>
            </button>
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
          <TweakToggle label={lang === 'zh' ? '老师自动看画' : 'Teacher auto-look'} value={t.autoLook !== false} onChange={(v) => setTweak('autoLook', v)} />
          <TweakToggle label={lang === 'zh' ? '空闲时提示' : 'Idle hint'} value={t.idleHint} onChange={(v) => setTweak('idleHint', v)} />
        </TweaksPanel>
      )}
    </div>
  );
}

export default App;
