// GPT Live 互动老师 — 悬浮气泡：状态 + 最近字幕 + 看画/结束。
function statusLabel(status, t, error) {
  if (status === 'error' && error) return error;
  if (status === 'connecting') return t.teacherConnecting;
  if (status === 'listening') return t.teacherListening;
  if (status === 'speaking') return t.teacherSpeaking;
  return t.teacherLive;
}

export default function TeacherBar({ status, messages, error, t, onLook, onGuess, onStop }) {
  const recent = messages.slice(-2);
  return (
    <div className="fb-bubble teacher-bar">
      <div className="fb-avatar">
        <div className="fb-bear">🐻</div>
      </div>
      <div className="fb-content teacher-content">
        <div className={`teacher-status ${status}`}>
          <span className="teacher-dot" />
          <span>{statusLabel(status, t, error)}</span>
        </div>
        {recent.map((m) => (
          <div key={m.id} className={`teacher-msg ${m.role}`}>
            <span className="teacher-who">{m.role === 'teacher' ? t.teacher : t.me}</span>
            <span className="teacher-text">{m.text}{m.partial ? '…' : ''}</span>
          </div>
        ))}
        <div className="teacher-acts">
          <button className="teacher-look" onClick={onLook}>
            {t.teacherLook}
          </button>
          <button className="teacher-look ghost" onClick={onGuess}>
            {t.teacherGuess}
          </button>
          <button className="teacher-x" onClick={onStop} aria-label="close">×</button>
        </div>
      </div>
    </div>
  );
}
