// GPT Live 互动老师 — OpenAI Realtime (WebSocket) + 麦克风 + 语音播放 + 看画。
//
// Flow:
//  1. POST /api/realtime-session → 拿到短期临时 key（server 端用 OPENAI_API_KEY 换）。
//  2. 浏览器用临时 key 连 wss://api.openai.com/v1/realtime?model=...（WebSocket subprotocol）。
//  3. 麦克风 → PCM16 24kHz → input_audio_buffer.append；模型语音 → response.audio.delta → WebAudio 播放。
//  4. 孩子画完一笔（noteStroke）→ 防抖后把画板截图作为 input_image 发给模型并触发回应。

import {
  buildTeacherInstructions,
  buildLookPrompt,
  buildWelcomeSpeech,
} from '../../shared/teacherPrompt.js';

const WS_BASE = 'wss://api.openai.com/v1/realtime';
const TARGET_SAMPLE_RATE = 24000;

// ── 音频工具 ──────────────────────────────────────────────

function resample(input, fromRate, toRate) {
  if (!input.length || fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  let t = 0;
  for (let i = 0; i < outLen; i++) {
    const idx = Math.min(input.length - 1, t);
    const i0 = Math.floor(idx);
    const frac = idx - i0;
    const i1 = Math.min(input.length - 1, i0 + 1);
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    t += ratio;
  }
  return out;
}

function floatToBase64Pcm16(float32, fromRate) {
  const samples = resample(float32, fromRate, TARGET_SAMPLE_RATE);
  const buf = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(buf.buffer);
  let bin = '';
  const CHUNK = 0x4000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToInt16(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const out = new Int16Array(bytes.length / 2);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < out.length; i++) out[i] = dv.getInt16(i * 2, true);
  return out;
}

// ── LiveTeacher ──────────────────────────────────────────

export class LiveTeacher {
  constructor({
    lang = 'zh',
    getSnapshot,
    hasInk,
    onStatus,
    onMessage,
    onError,
    onGeneratedImage,
    onGenerationStatus,
    autoLook = true,
  } = {}) {
    this.lang = lang;
    this.getSnapshot = getSnapshot;
    this.hasInk = hasInk;
    this.onStatus = onStatus;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onGeneratedImage = onGeneratedImage;
    this.onGenerationStatus = onGenerationStatus;
    this.getAutoLook = typeof autoLook === 'function' ? autoLook : () => !!autoLook;

    this.active = false;
    this.ws = null;
    this.audioCtx = null;
    this.micStream = null;
    this.processor = null;
    this.nextPlayTime = 0;
    this.voice = 'alloy';

    this.sessionReady = false;
    this.audioReady = false;
    this.pendingWelcome = false;
    this.pendingLook = false;
    this.isSpeaking = false;
    this.userSpeaking = false;
    this.teacherBuf = '';
    this.tutorial = null;

    this.lastLookAt = 0;
    this.debounceTimer = null;
    this.toolCalls = new Map();
  }

  // ── 生命周期 ───────────────────────────────────────────

  async start() {
    if (this.active) return;
    this.active = true;
    this.onStatus?.('connecting');

    // 尽早（在点击手势内）准备麦克风/音频，iOS Safari 需要
    try {
      await this.setupAudio();
      this.audioReady = true;
    } catch (err) {
      this.active = false;
      this.onError?.(this.errorText(err));
      this.onStatus?.('error');
      return;
    }

    let session;
    try {
      const res = await fetch('/api/realtime-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: this.lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.reason || 'server_error');
      }
      session = data;
    } catch (err) {
      this.active = false;
      this.teardownAudio();
      this.onError?.(this.errorText(err));
      this.onStatus?.('error');
      return;
    }

    this.voice = session.voice || 'alloy';
    try {
      await this.openSocket(session);
    } catch (err) {
      this.active = false;
      this.teardownAudio();
      this.onError?.(this.errorText(err));
      this.onStatus?.('error');
    }
  }

  openSocket(session) {
    return new Promise((resolve, reject) => {
      const url = `${WS_BASE}?model=${encodeURIComponent(session.model)}`;
      const ws = new WebSocket(url, [
        'realtime',
        `openai-insecure-api-key.${session.clientSecret}`,
      ]);
      this.ws = ws;
      let settled = false;

      ws.addEventListener('open', () => {
        if (settled) return;
        settled = true;
        resolve();
        this.onStatus?.('live');
        // 先配好 session，等 session.updated 后打招呼/看画
        this.sendSessionUpdate();
        this.pendingWelcome = true;
      });

      ws.addEventListener('error', () => {
        if (!settled) {
          settled = true;
          reject(new Error('websocket_error'));
        }
      });

      ws.addEventListener('close', () => {
        if (this.active) {
          this.active = false;
          this.teardownAudio();
          this.onStatus?.('idle');
        }
      });

      ws.addEventListener('message', (e) => {
        let evt;
        try { evt = JSON.parse(e.data); } catch { return; }
        this.handleEvent(evt);
      });
    });
  }

  stop() {
    this.active = false;
    clearTimeout(this.debounceTimer);
    this.pendingWelcome = false;
    this.pendingLook = false;
    try { this.ws?.close(); } catch { /* noop */ }
    this.teardownAudio();
    this.ws = null;
    this.onStatus?.('idle');
  }

  setLang(lang) {
    this.lang = lang;
    if (this.active && this.ws?.readyState === WebSocket.OPEN) {
      this.sendSessionUpdate();
    }
  }

  // 告诉老师孩子正在跟着哪个教程、画到第几步
  setTutorial(info) {
    this.tutorial = info || null;
  }

  // ── 配置与事件 ─────────────────────────────────────────

  send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  sendSessionUpdate() {
    this.send({
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        instructions: buildTeacherInstructions(this.lang),
        voice: this.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
        },
        tools: [{
          type: 'function',
          name: 'generate_drawing',
          description: 'Generate a child-friendly picture and display it on the drawing board and connected reflective display.',
          parameters: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A complete description of the picture the child wants, including subject, action, setting, and mood.',
              },
            },
            required: ['prompt'],
          },
        }],
        tool_choice: 'auto',
      },
    });
  }

  handleEvent(evt) {
    switch (evt.type) {
      case 'session.updated':
        this.sessionReady = true;
        this.tryWelcome();
        break;

      case 'input_audio_buffer.speech_started':
        this.userSpeaking = true;
        this.onStatus?.('listening');
        break;
      case 'input_audio_buffer.speech_stopped':
        this.userSpeaking = false;
        this.onStatus?.('live');
        break;

      case 'response.created':
        this.isSpeaking = true;
        this.teacherBuf = '';
        this.onStatus?.('speaking');
        break;

      case 'response.output_audio.delta':
      case 'response.audio.delta':
        if (evt.delta) this.playAudio(evt.delta);
        break;

      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        this.teacherBuf += evt.delta || '';
        this.onMessage?.({ role: 'teacher', text: this.teacherBuf, partial: true });
        break;

      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        this.teacherBuf = evt.transcript || this.teacherBuf;
        this.onMessage?.({ role: 'teacher', text: this.teacherBuf, partial: false });
        break;

      case 'response.done':
        this.isSpeaking = false;
        this.onStatus?.(this.userSpeaking ? 'listening' : 'live');
        if (this.pendingLook) {
          this.pendingLook = false;
          this.sendLook('auto');
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (evt.transcript && evt.transcript.trim()) {
          this.onMessage?.({ role: 'user', text: evt.transcript.trim(), partial: false });
        }
        break;

      case 'response.function_call_arguments.done':
        this.runToolCall({
          name: evt.name,
          callId: evt.call_id,
          argumentsText: evt.arguments,
        });
        break;

      case 'response.output_item.done':
        if (evt.item?.type === 'function_call') {
          this.runToolCall({
            name: evt.item.name,
            callId: evt.item.call_id,
            argumentsText: evt.item.arguments,
          });
        }
        break;

      case 'error':
        if (evt.error?.message) this.onError?.(evt.error.message);
        break;

      default:
        break;
    }
  }

  async runToolCall({ name, callId, argumentsText }) {
    if (name !== 'generate_drawing' || !callId || this.toolCalls.has(callId)) return;
    this.toolCalls.set(callId, true);
    this.onGenerationStatus?.('generating');

    let args = {};
    try { args = JSON.parse(argumentsText || '{}'); } catch { /* handled below */ }

    try {
      const response = await fetch('/api/generate-drawing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: args.prompt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || !result.image) {
        throw new Error(result.reason || 'generation_failed');
      }

      this.onGeneratedImage?.(result);
      this.onGenerationStatus?.('ready');
      this.sendToolResult(callId, { ok: true, prompt: result.prompt });
    } catch (error) {
      this.onGenerationStatus?.('error');
      this.onError?.(this.lang === 'zh' ? '图片暂时没有画出来，请再试一次～' : 'The picture could not be generated. Please try again~');
      this.sendToolResult(callId, { ok: false, reason: error?.message || 'generation_failed' });
    }
  }

  sendToolResult(callId, output) {
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(output),
      },
    });
    this.send({ type: 'response.create', response: { modalities: ['audio', 'text'] } });
  }

  // ── 看画 & 互动 ────────────────────────────────────────

  tryWelcome() {
    if (this.sessionReady && this.audioReady && this.pendingWelcome) {
      this.pendingWelcome = false;
      this.doWelcome();
    }
  }

  doWelcome() {
    const inked = this.hasInk ? this.hasInk() : false;
    if (inked) {
      this.lastLookAt = Date.now();
      this.sendLook('welcome');
    } else {
      this.send({
        type: 'response.create',
        response: {
          modalities: ['audio', 'text'],
          instructions: buildWelcomeSpeech(this.lang),
        },
      });
    }
  }

  lookNow(kind = 'manual') {
    this.sendLook(kind);
  }

  sendLook(kind = 'manual') {
    if (!this.active || this.ws?.readyState !== WebSocket.OPEN) return;
    if (!this.sessionReady) return;
    if (this.isSpeaking) {
      this.pendingLook = true;
      return;
    }
    const image = this.getSnapshot ? this.getSnapshot() : null;
    if (!image) return;
    this.lastLookAt = Date.now();
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_text', text: buildLookPrompt(kind, this.lang, this.tutorial) },
          { type: 'input_image', image_url: image },
        ],
      },
    });
    this.send({ type: 'response.create', response: { modalities: ['audio', 'text'] } });
  }

  noteStroke() {
    if (!this.active || !this.getAutoLook()) return;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (!this.active) return;
      if (Date.now() - this.lastLookAt < 5000) return;
      if (this.isSpeaking) {
        this.pendingLook = true;
        return;
      }
      this.sendLook('auto');
    }, 2000);
  }

  // ── 麦克风 ─────────────────────────────────────────────

  async setupAudio() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('no_mic_support');
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioCtx();
    await this.audioCtx.resume();

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const source = this.audioCtx.createMediaStreamSource(this.micStream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.active || this.ws?.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const audio = floatToBase64Pcm16(input, this.audioCtx.sampleRate);
      this.send({ type: 'input_audio_buffer.append', audio });
    };

    // 接一个 0 音量 gain 防止自己听到自己
    const zero = this.audioCtx.createGain();
    zero.gain.value = 0;
    source.connect(this.processor);
    this.processor.connect(zero);
    zero.connect(this.audioCtx.destination);

    this.nextPlayTime = this.audioCtx.currentTime + 0.1;
  }

  teardownAudio() {
    try { this.processor?.disconnect(); } catch { /* noop */ }
    try { this.micStream?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { this.audioCtx?.close(); } catch { /* noop */ }
    this.processor = null;
    this.micStream = null;
    this.audioCtx = null;
    this.nextPlayTime = 0;
  }

  // ── 播放 ───────────────────────────────────────────────

  playAudio(b64) {
    if (!this.audioCtx) return;
    try {
      const pcm = base64ToInt16(b64);
      const float = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) float[i] = pcm[i] / 32768;
      const buf = this.audioCtx.createBuffer(1, float.length, TARGET_SAMPLE_RATE);
      buf.getChannelData(0).set(float);
      const src = this.audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(this.audioCtx.destination);
      const when = Math.max(this.audioCtx.currentTime + 0.02, this.nextPlayTime);
      src.start(when);
      this.nextPlayTime = when + buf.duration;
    } catch (err) {
      console.warn('[liveTeacher] playAudio failed:', err);
    }
  }

  // ── 错误文案 ───────────────────────────────────────────

  errorText(err) {
    const msg = err?.message || String(err);
    const zh = this.lang === 'zh';
    if (msg === 'no_api_key') {
      return zh
        ? '老师还没准备好：请先在服务端配置 OPENAI_API_KEY。'
        : 'The teacher is not ready yet: please set OPENAI_API_KEY on the server.';
    }
    if (msg === 'no_mic_support') {
      return zh
        ? '这个浏览器不支持麦克风，换个浏览器试试吧～'
        : 'This browser cannot access the microphone — try another browser~';
    }
    if (msg === 'websocket_error') {
      return zh
        ? '和老师连不上，再试一次吧～'
        : 'Could not reach the teacher — please try again~';
    }
    if (/NotAllowedError|Permission denied|permission/i.test(msg)) {
      return zh
        ? '需要打开麦克风权限才能和老师说话哦～'
        : 'Please allow microphone access so you can talk to the teacher~';
    }
    if (msg === 'server_error') {
      return zh
        ? '老师那边出了点小状况，再试一次吧～'
        : 'The teacher hit a small hiccup — please try again~';
    }
    return zh
      ? `和老师说话时出了点问题：${msg}`
      : `Something went wrong talking to the teacher: ${msg}`;
  }
}
