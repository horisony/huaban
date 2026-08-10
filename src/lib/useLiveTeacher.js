// React hook 包装 LiveTeacher：状态、字幕、开始/结束/看画/记一笔。
import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveTeacher } from './liveTeacher.js';

export function useLiveTeacher({ lang, getSnapshot, hasInk, onGeneratedImage, autoLook = true }) {
  const [status, setStatus] = useState('idle');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [generationStatus, setGenerationStatus] = useState('idle');

  const teacherRef = useRef(null);
  const langRef = useRef(lang);
  const getSnapshotRef = useRef(getSnapshot);
  const hasInkRef = useRef(hasInk);
  const autoLookRef = useRef(autoLook);
  const onGeneratedImageRef = useRef(onGeneratedImage);

  langRef.current = lang;
  getSnapshotRef.current = getSnapshot;
  hasInkRef.current = hasInk;
  autoLookRef.current = autoLook;
  onGeneratedImageRef.current = onGeneratedImage;

  // 切换语言时同步给正在进行的会话
  useEffect(() => {
    teacherRef.current?.setLang?.(lang);
  }, [lang]);

  // 卸载时结束会话
  useEffect(() => () => teacherRef.current?.stop(), []);

  const start = useCallback(async () => {
    if (teacherRef.current?.active) return;
    setError(null);
    setMessages([]);
    const t = new LiveTeacher({
      lang: langRef.current,
      getSnapshot: () => getSnapshotRef.current?.(),
      hasInk: () => hasInkRef.current?.(),
      autoLook: () => autoLookRef.current,
      onStatus: (s) => setStatus(s),
      onMessage: (m) => setMessages((prev) => {
        const arr = [...prev];
        const last = arr[arr.length - 1];
        // 老师的字幕是流式的，合并到同一条
        if (m.role === 'teacher' && last?.role === 'teacher') {
          last.text = m.text;
          last.partial = m.partial;
          return arr;
        }
        // 用户字幕（整句）直接追加，最多保留最近 40 条
        const next = [...arr, {
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: m.role,
          text: m.text,
          partial: m.partial,
        }];
        return next.length > 40 ? next.slice(-40) : next;
      }),
      onError: (msg) => setError(msg),
      onGeneratedImage: (result) => onGeneratedImageRef.current?.(result),
      onGenerationStatus: setGenerationStatus,
    });
    teacherRef.current = t;
    await t.start();
  }, []);

  const stop = useCallback(() => {
    teacherRef.current?.stop();
    teacherRef.current = null;
    setStatus('idle');
  }, []);

  const lookNow = useCallback((kind) => teacherRef.current?.lookNow(kind), []);
  const noteStroke = useCallback(() => teacherRef.current?.noteStroke(), []);
  const setTutorial = useCallback((info) => teacherRef.current?.setTutorial(info), []);

  return {
    status,
    messages,
    error,
    live: status !== 'idle',
    start,
    stop,
    lookNow,
    noteStroke,
    setTutorial,
    generationStatus,
  };
}
