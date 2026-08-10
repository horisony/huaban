// Tutorial player — animates SVG paths step-by-step with stroke-dashoffset.
import { useState, useEffect, useMemo } from 'react';

function pathLength(d) {
  // Approximate by creating a hidden path element
  if (typeof document === 'undefined') return 1000;
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  return p.getTotalLength ? Math.max(20, p.getTotalLength()) : 800;
}

function TutorialPlayer({ tutorial, lang, t, onClose, onPick, onStepChange, stroke = '#fff' }) {
  const [step, setStep] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [animating, setAnimating] = useState(true);

  const total = tutorial?.steps?.length ?? 0;
  const current = tutorial?.steps?.[step];

  const priorPaths = useMemo(() => {
    if (!tutorial) return [];
    const arr = [];
    for (let i = 0; i < step; i++) {
      tutorial.steps[i].paths.forEach((d) => arr.push(d));
    }
    return arr;
  }, [tutorial, step]);

  useEffect(() => {
    if (!current) return undefined;
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 200 + 800 * (current.paths.length || 1));
    return () => clearTimeout(timer);
  }, [step, playKey, current]);

  // 告诉老师当前教程进度（GPT Live 画画指导用）
  useEffect(() => {
    if (onStepChange && tutorial && current) {
      onStepChange({
        id: tutorial.id,
        name: tutorial.name[lang],
        step,
        total,
        hint: current.hint[lang],
      });
    }
  }, [tutorial, step, total, current, lang, onStepChange]);

  if (!tutorial) return null;

  return (
    <div className="tut-panel">
      <div className="tut-head">
        <div className="tut-title">
          <span className="tut-emoji">{tutorial.icon}</span>
          <span>{tutorial.name[lang]}</span>
        </div>
        <button className="tut-x" onClick={onClose} aria-label="close">×</button>
      </div>

      <div className="tut-stage">
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
          {/* faint grid as guide */}
          <defs>
            <pattern id="tutGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="400" height="300" fill="url(#tutGrid)" />
          {/* Previous (settled) strokes */}
          {priorPaths.map((d, i) => (
            <path key={`p${i}`} d={d} fill="none" stroke={stroke} strokeOpacity="0.85"
                  strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {/* Current step animated */}
          {current.paths.map((d, i) => {
            const len = pathLength(d);
            const delay = i * 0.6;
            const dur = Math.max(0.6, Math.min(2.2, len / 220));
            return (
              <path
                key={`c${playKey}-${step}-${i}`}
                d={d}
                fill="none"
                stroke={stroke}
                strokeOpacity="0.95"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: len,
                  strokeDashoffset: len,
                  animation: `tutDraw ${dur}s ${delay}s ease-out forwards`,
                }}
              />
            );
          })}
        </svg>
      </div>

      <div className="tut-hint">{current.hint[lang]}</div>

      <div className="tut-controls">
        <button className="tut-btn ghost" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>
          ‹ {t.prev}
        </button>
        <div className="tut-progress">
          {tutorial.steps.map((_, i) => (
            <span key={i} className={`tut-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>
        <button className="tut-btn" disabled={step >= total - 1} onClick={() => setStep(Math.min(total - 1, step + 1))}>
          {t.next} ›
        </button>
      </div>
      <div className="tut-foot">
        <button className="tut-link" onClick={() => setPlayKey(k => k + 1)}>↻ {t.replay}</button>
        <button className="tut-link" onClick={onPick}>📚 {t.library}</button>
      </div>
    </div>
  );
}

function TutorialLibrary({ tutorials, lang, t, onPick, onClose }) {
  return (
    <div className="lib-overlay" onClick={onClose}>
      <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lib-head">
          <h3>{t.chooseTutorial}</h3>
          <button className="tut-x" onClick={onClose}>×</button>
        </div>
        <div className="lib-grid">
          {tutorials.map((tut) => (
            <button key={tut.id} className="lib-card" onClick={() => onPick(tut)}>
              <div className="lib-emoji">{tut.icon}</div>
              <div className="lib-name">{tut.name[lang]}</div>
              <div className="lib-steps">{tut.steps.length} {lang === 'zh' ? '步' : 'steps'}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { TutorialPlayer, TutorialLibrary };
