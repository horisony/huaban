import { useCallback, useEffect, useRef, useState } from 'react';

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useVoiceDrawing({ lang = 'zh', onGeneratedImage, onMessage, onError }) {
  const [status, setStatus] = useState('idle');
  const recognitionRef = useRef(null);
  const callbackRef = useRef({ onGeneratedImage, onMessage, onError });
  callbackRef.current = { onGeneratedImage, onMessage, onError };

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1.08;
    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => setStatus('idle');
    window.speechSynthesis.speak(utterance);
  }, [lang]);

  const generate = useCallback(async (prompt) => {
    setStatus('generating');
    callbackRef.current.onMessage?.(prompt);
    try {
      const response = await fetch('/api/generate-drawing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || !result.image) {
        throw new Error(result.reason || 'generation_failed');
      }
      callbackRef.current.onGeneratedImage?.(result);
      const reply = lang === 'zh'
        ? `好了，给你画好${prompt}啦，你可以继续画画啦！`
        : `All done! I made ${prompt} for you. You can keep drawing now!`;
      speak(reply);
    } catch (error) {
      setStatus('idle');
      callbackRef.current.onError?.(error);
      speak(lang === 'zh' ? '这次没有画出来，我们再试一次吧。' : 'That one did not work. Let’s try again.');
    }
  }, [lang, speak]);

  const start = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      callbackRef.current.onError?.(new Error('speech_recognition_unsupported'));
      return;
    }
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort?.();
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setStatus('listening');
    recognition.onerror = (event) => {
      setStatus('idle');
      callbackRef.current.onError?.(new Error(event.error || 'speech_error'));
    };
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (!result.isFinal) return;
      const transcript = result[0]?.transcript?.trim();
      if (transcript) generate(transcript);
    };
    recognition.onend = () => setStatus((current) => current === 'listening' ? 'idle' : current);
    recognition.start();
  }, [generate, lang]);

  useEffect(() => () => {
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel();
  }, []);

  return { status, active: status !== 'idle', start, generate };
}
