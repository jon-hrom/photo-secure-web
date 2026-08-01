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

export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

interface RealtimeConfig {
  configured: boolean;
  ws_url?: string;
  authorization?: string;
  auth_scheme?: string;
  model?: string;
  voice?: string;
  sample_rate?: number;
  message?: string;
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

/**
 * Голосовой диалог через Yandex Realtime API (OpenAI-совместимый протокол).
 * Записывает микрофон в PCM16, шлёт аудио, принимает аудио-ответ и озвучивает его.
 * Точку подключения и авторизацию выдаёт бэкенд voice-realtime (ключ не в браузере).
 */
export function useRealtimeVoice(): UseRealtimeVoiceResult {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState('');
  const [assistantTranscript, setAssistantTranscript] = useState('');
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const playTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    try { procRef.current?.disconnect(); } catch { /* */ }
    try { sourceRef.current?.disconnect(); } catch { /* */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try { audioCtxRef.current?.close(); } catch { /* */ }
    try { playCtxRef.current?.close(); } catch { /* */ }
    try { wsRef.current?.close(); } catch { /* */ }
    procRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    playCtxRef.current = null;
    wsRef.current = null;
    playTimeRef.current = 0;
  }, []);

  const playChunk = useCallback((int16: Int16Array) => {
    let ctx = playCtxRef.current;
    if (!ctx) {
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
  }, []);

  const handleServerEvent = useCallback((evt: Record<string, unknown>) => {
    const type = evt.type as string;
    switch (type) {
      case 'response.audio.delta':
      case 'response.output_audio.delta': {
        const delta = evt.delta as string;
        if (delta) { setStatus('speaking'); playChunk(base64ToInt16(delta)); }
        break;
      }
      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta': {
        const d = evt.delta as string;
        if (d) setAssistantTranscript((prev) => prev + d);
        break;
      }
      case 'conversation.item.input_audio_transcription.delta': {
        const d = evt.delta as string;
        if (d) setUserTranscript((prev) => prev + d);
        break;
      }
      case 'conversation.item.input_audio_transcription.completed': {
        const t = evt.transcript as string;
        if (t) setUserTranscript(t);
        break;
      }
      case 'response.done':
        setStatus('listening');
        break;
      case 'error': {
        const e = evt.error as { message?: string } | undefined;
        setError(e?.message || 'Ошибка Realtime API');
        setStatus('error');
        break;
      }
      default:
        break;
    }
  }, [playChunk]);

  const startMic = useCallback(async (ws: WebSocket) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    procRef.current = proc;

    proc.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const resampled = resample(input, ctx.sampleRate, IN_RATE);
      const pcm = floatTo16BitPCM(resampled);
      ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: arrayBufferToBase64(pcm),
      }));
    };
    source.connect(proc);
    proc.connect(ctx.destination);
  }, []);

  const connect = useCallback(async (instructions: string) => {
    setError(null);
    setUserTranscript('');
    setAssistantTranscript('');
    setStatus('connecting');
    try {
      const userId = localStorage.getItem('userId');
      const cfgResp = await fetch(REALTIME_API, { headers: { 'X-User-Id': userId || '' } });
      const cfg: RealtimeConfig = await cfgResp.json();
      if (!cfg.configured || !cfg.ws_url) {
        throw new Error(cfg.message || 'Голосовой сервис не настроен');
      }

      // Авторизация передаётся query-параметром, т.к. браузер не задаёт заголовки для WS.
      const url = new URL(cfg.ws_url);
      if (cfg.model) url.searchParams.set('model', cfg.model);
      if (cfg.authorization) url.searchParams.set('authorization', cfg.authorization);

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setStatus('listening');
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions,
            modalities: ['audio', 'text'],
            voice: cfg.voice || 'marina',
            input_audio_format: { type: 'audio/pcm', rate: IN_RATE },
            output_audio_format: { type: 'audio/pcm', rate: OUT_RATE },
            input_audio_transcription: { enabled: true },
            turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 500 },
          },
        }));
        startMic(ws).catch((err) => {
          setError('Нет доступа к микрофону: ' + err.message);
          setStatus('error');
        });
      };

      ws.onmessage = (ev) => {
        try { handleServerEvent(JSON.parse(ev.data)); } catch { /* ignore non-json */ }
      };
      ws.onerror = () => {
        setError('Не удалось подключиться к голосовому сервису');
        setStatus('error');
      };
      ws.onclose = () => {
        setConnected(false);
        if (status !== 'error') setStatus('idle');
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка подключения');
      setStatus('error');
      cleanup();
    }
  }, [cleanup, handleServerEvent, startMic, status]);

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
