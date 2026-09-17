import { useCallback, useEffect, useRef, useState } from 'react';
import func2url from '../../../backend/func2url.json';
import {
  floatTo16BitPCM,
  resample,
  arrayBufferToBase64,
  base64ToInt16,
  int16ToFloat32,
} from './audioUtils';

const REALTIME_API = (func2url as Record<string, string>)['voice-realtime'];

export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

interface RealtimeConfig {
  configured: boolean;
  voice?: string;
  sample_rate?: number;
  message?: string;
}

interface TurnResponse {
  user_text?: string;
  agent_text?: string;
  audio?: string;
  error?: string;
}

interface HistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export interface UseRealtimeVoiceResult {
  status: VoiceStatus;
  error: string | null;
  userTranscript: string;
  assistantTranscript: string;
  connected: boolean;
  connect: (instructions: string) => Promise<void>;
  disconnect: () => void;
}

const IN_RATE = 24000;
const OUT_RATE = 24000;

/** Тишина ниже этого уровня не считается речью (0..1 по амплитуде). */
const SILENCE_LEVEL = 0.012;
/** Пауза, после которой реплика считается законченной. */
const SILENCE_MS = 900;
/** Не отправляем совсем короткие обрывки — это шум. */
const MIN_SPEECH_MS = 400;

/**
 * Голосовой диалог с агентом Yandex Realtime.
 *
 * Браузер не может подключиться к Realtime напрямую: сервис требует HTTP-заголовок
 * Authorization, а WebSocket API в браузере заголовки задавать не умеет (отсюда
 * ошибка «Authorization header is missing»). Поэтому запись речи уходит на нашу
 * функцию voice-realtime, она держит WebSocket к Yandex и возвращает ответ агента.
 *
 * Реплики режем по паузе в речи: пока говорите — копим звук, замолчали — отправляем.
 */
export function useRealtimeVoice(): UseRealtimeVoiceResult {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState('');
  const [assistantTranscript, setAssistantTranscript] = useState('');
  const [connected, setConnected] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const playTimeRef = useRef(0);

  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const chunksRef = useRef<Int16Array[]>([]);
  const speechMsRef = useRef(0);
  const silenceMsRef = useRef(0);
  const voiceRef = useRef('marina');
  const historyRef = useRef<HistoryItem[]>([]);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    busyRef.current = false;
    chunksRef.current = [];
    speechMsRef.current = 0;
    silenceMsRef.current = 0;
    try { procRef.current?.disconnect(); } catch { /* */ }
    try { sourceRef.current?.disconnect(); } catch { /* */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try { audioCtxRef.current?.close(); } catch { /* */ }
    try { playCtxRef.current?.close(); } catch { /* */ }
    procRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    playCtxRef.current = null;
    playTimeRef.current = 0;
  }, []);

  const playPcm = useCallback((int16: Int16Array) => {
    let ctx = playCtxRef.current;
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext({ sampleRate: OUT_RATE });
      playCtxRef.current = ctx;
      playTimeRef.current = ctx.currentTime;
    }
    const float = int16ToFloat32(int16);
    const buffer = ctx.createBuffer(1, float.length, OUT_RATE);
    buffer.getChannelData(0).set(float);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, playTimeRef.current);
    src.start(startAt);
    playTimeRef.current = startAt + buffer.duration;
    return buffer.duration;
  }, []);

  /** Отправляет накопленную реплику на сервер и озвучивает ответ агента. */
  const sendTurn = useCallback(async (pcm: Int16Array) => {
    busyRef.current = true;
    setStatus('thinking');
    try {
      const userId = localStorage.getItem('userId') || '';
      const userName = localStorage.getItem('userName') || '';
      const resp = await fetch(REALTIME_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          action: 'turn',
          audio: arrayBufferToBase64(pcm.buffer as ArrayBuffer),
          user_name: userName,
          voice: voiceRef.current,
          history: historyRef.current.slice(-10),
        }),
      });
      const data: TurnResponse = await resp.json();

      if (data.error) {
        setError(data.error);
        setStatus('error');
        return;
      }

      if (data.user_text) {
        setUserTranscript(data.user_text);
        historyRef.current.push({ role: 'user', text: data.user_text });
      }
      if (data.agent_text) {
        setAssistantTranscript(data.agent_text);
        historyRef.current.push({ role: 'assistant', text: data.agent_text });
      }

      if (data.audio) {
        setStatus('speaking');
        const duration = playPcm(base64ToInt16(data.audio));
        // Пока агент говорит, микрофон не слушаем — иначе он услышит сам себя.
        await new Promise((r) => setTimeout(r, duration * 1000));
      }

      if (activeRef.current) setStatus('listening');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось связаться с агентом');
      setStatus('error');
    } finally {
      busyRef.current = false;
      chunksRef.current = [];
      speechMsRef.current = 0;
      silenceMsRef.current = 0;
    }
  }, [playPcm]);

  const startMic = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    procRef.current = proc;

    proc.onaudioprocess = (e) => {
      if (!activeRef.current || busyRef.current) return;

      const input = e.inputBuffer.getChannelData(0);
      const blockMs = (input.length / ctx.sampleRate) * 1000;

      let peak = 0;
      for (let i = 0; i < input.length; i += 1) {
        const v = Math.abs(input[i]);
        if (v > peak) peak = v;
      }

      const resampled = resample(input, ctx.sampleRate, IN_RATE);
      const pcm = new Int16Array(floatTo16BitPCM(resampled));

      if (peak > SILENCE_LEVEL) {
        chunksRef.current.push(pcm);
        speechMsRef.current += blockMs;
        silenceMsRef.current = 0;
        return;
      }

      // Тишина: короткую паузу внутри фразы тоже пишем, чтобы речь не рвалась
      if (speechMsRef.current > 0) {
        chunksRef.current.push(pcm);
        silenceMsRef.current += blockMs;

        if (silenceMsRef.current >= SILENCE_MS) {
          if (speechMsRef.current >= MIN_SPEECH_MS) {
            const total = chunksRef.current.reduce((n, c) => n + c.length, 0);
            const merged = new Int16Array(total);
            let offset = 0;
            chunksRef.current.forEach((c) => { merged.set(c, offset); offset += c.length; });
            void sendTurn(merged);
          } else {
            chunksRef.current = [];
            speechMsRef.current = 0;
            silenceMsRef.current = 0;
          }
        }
      }
    };

    source.connect(proc);
    proc.connect(ctx.destination);
  }, [sendTurn]);

  const connect = useCallback(async () => {
    setError(null);
    setUserTranscript('');
    setAssistantTranscript('');
    setStatus('connecting');
    historyRef.current = [];
    try {
      const userId = localStorage.getItem('userId') || '';
      const cfgResp = await fetch(REALTIME_API, { headers: { 'X-User-Id': userId } });
      const cfg: RealtimeConfig = await cfgResp.json();
      if (!cfg.configured) {
        throw new Error(cfg.message || 'Голосовой сервис не настроен');
      }
      voiceRef.current = cfg.voice || 'marina';

      activeRef.current = true;
      await startMic();
      setConnected(true);
      setStatus('listening');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка подключения');
      setStatus('error');
      cleanup();
      setConnected(false);
    }
  }, [cleanup, startMic]);

  const disconnect = useCallback(() => {
    cleanup();
    setConnected(false);
    setStatus('idle');
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return {
    status, error, userTranscript, assistantTranscript, connected, connect, disconnect,
  };
}

export default useRealtimeVoice;
