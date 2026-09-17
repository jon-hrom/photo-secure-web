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
  sample_rate?: number;
  input_sample_rate?: number;
  message?: string;
}

/** Поля заявки, которые агент распознал в разговоре. */
export interface VoiceFields {
  name?: string;
  phone?: string;
  date?: string;
  shootType?: string;
  comment?: string;
}

interface TurnResponse {
  user_text?: string;
  agent_text?: string;
  audio?: string;
  sample_rate?: number;
  fields?: VoiceFields;
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
  /** Данные заявки, которые агент услышал в разговоре */
  fields: VoiceFields;
  connect: (options?: ConnectOptions) => Promise<void>;
  disconnect: () => void;
}

export interface ConnectOptions {
  /** Имя фотографа — агент поздоровается лично */
  userName?: string;
  /** Реплика, которую агент произнесёт сразу после подключения */
  greeting?: string;
}

// Realtime отдаёт голос в 44100 Гц независимо от запроса. Если проигрывать
// его как 24000, речь растягивается почти вдвое («очень медленный голос»).
// Точные значения приходят с сервера, эти — запасные.
const DEFAULT_IN_RATE = 44100;
const DEFAULT_OUT_RATE = 44100;

/** Тишина ниже этого уровня не считается речью (0..1 по амплитуде).
 *  Порог низкий: с шумоподавлением браузера тихая речь легко уходила под него,
 *  из-за чего запись обрывалась и агент не слышал фразу. */
const SILENCE_LEVEL = 0.006;
/** Пауза, после которой реплика считается законченной. */
const SILENCE_MS = 1200;
/** Не отправляем совсем короткие обрывки — это шум. */
const MIN_SPEECH_MS = 500;
/** Аварийная отправка: длинную фразу не копим бесконечно. */
const MAX_SPEECH_MS = 20000;
/** Клиент молчит — агент мягко напомнит о себе. */
const IDLE_REMINDER_MS = 12000;
/** Сколько раз подряд напоминаем, дальше просто ждём молча. */
const MAX_IDLE_REMINDERS = 2;

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
  const [fields, setFields] = useState<VoiceFields>({});

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
  const historyRef = useRef<HistoryItem[]>([]);
  const inRateRef = useRef(DEFAULT_IN_RATE);
  const outRateRef = useRef(DEFAULT_OUT_RATE);
  const preRollRef = useRef<Int16Array[]>([]);
  const userNameRef = useRef('');
  /** Когда в последний раз что-то происходило — для напоминания при молчании */
  const lastActivityRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleCountRef = useRef(0);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    busyRef.current = false;
    chunksRef.current = [];
    preRollRef.current = [];
    speechMsRef.current = 0;
    silenceMsRef.current = 0;
    idleCountRef.current = 0;
    if (idleTimerRef.current) {
      clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    }
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

  const playPcm = useCallback((int16: Int16Array, rate: number) => {
    let ctx = playCtxRef.current;
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext({ sampleRate: rate });
      playCtxRef.current = ctx;
      playTimeRef.current = ctx.currentTime;
    }
    const float = int16ToFloat32(int16);
    const buffer = ctx.createBuffer(1, float.length, rate);
    buffer.getChannelData(0).set(float);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, playTimeRef.current);
    src.start(startAt);
    playTimeRef.current = startAt + buffer.duration;
    return buffer.duration;
  }, []);

  /** Отправляет реплику (запись голоса или текст) и озвучивает ответ агента.
   *  isSystemPrompt — служебная подсказка агенту, её не показываем как речь клиента. */
  const sendTurn = useCallback(async (
    pcm: Int16Array | null,
    textPrompt?: string,
    isSystemPrompt = false,
  ) => {
    busyRef.current = true;
    setStatus('thinking');
    try {
      const userId = localStorage.getItem('userId') || '';
      const resp = await fetch(REALTIME_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          action: 'turn',
          ...(pcm ? { audio: arrayBufferToBase64(pcm.buffer as ArrayBuffer) } : {}),
          ...(textPrompt ? { text: textPrompt } : {}),
          user_name: userNameRef.current,
          history: historyRef.current.slice(-10),
        }),
      });
      const data: TurnResponse = await resp.json();

      if (data.error === 'NO_SPEECH') {
        // Речь не разобрана (тихо/шум). Не гоняем агента впустую —
        // просто продолжаем слушать, чтобы фразу можно было повторить.
        setError('Не расслышал — скажите ещё раз, пожалуйста');
        if (activeRef.current) setStatus('listening');
        return;
      }

      if (data.error) {
        // Сбой одной реплики не должен обрывать разговор: показываем
        // предупреждение и продолжаем слушать — можно просто повторить фразу.
        setError(data.error);
        if (activeRef.current) setStatus('listening');
        else setStatus('error');
        return;
      }

      setError(null);

      // Служебные подсказки агенту (приветствие, «клиент молчит») в историю
      // и в ленту диалога не попадают — иначе выглядят как реплика клиента
      // и агент начинает отвечать сам себе по кругу.
      if (data.user_text && !isSystemPrompt) {
        setUserTranscript(data.user_text);
        historyRef.current.push({ role: 'user', text: data.user_text });
      }
      if (data.agent_text) {
        setAssistantTranscript(data.agent_text);
        historyRef.current.push({ role: 'assistant', text: data.agent_text });
      }

      // Анкета пополняется по ходу разговора: уже заполненное не затираем,
      // если в очередной реплике агент этих данных не услышал.
      if (data.fields) {
        setFields((prev) => {
          const next = { ...prev };
          (Object.keys(data.fields || {}) as (keyof VoiceFields)[]).forEach((key) => {
            const value = data.fields?.[key];
            if (value) next[key] = value;
          });
          return next;
        });
      }

      if (data.audio) {
        setStatus('speaking');
        // Частоту берём из ответа: Realtime может отдать не то, что мы просили
        const rate = data.sample_rate || outRateRef.current;
        const duration = playPcm(base64ToInt16(data.audio), rate);
        // Пока агент говорит, микрофон не слушаем — иначе он услышит сам себя.
        await new Promise((r) => setTimeout(r, duration * 1000));
      }

      if (activeRef.current) setStatus('listening');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось связаться с агентом');
      if (activeRef.current) setStatus('listening');
      else setStatus('error');
    } finally {
      busyRef.current = false;
      chunksRef.current = [];
      preRollRef.current = [];
      speechMsRef.current = 0;
      silenceMsRef.current = 0;
      // Отсчёт молчания начинаем заново после каждой реплики агента
      lastActivityRef.current = Date.now();
    }
  }, [playPcm]);

  const sendTurnRef = useRef(sendTurn);
  sendTurnRef.current = sendTurn;

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

      const resampled = resample(input, ctx.sampleRate, inRateRef.current);
      const pcm = new Int16Array(floatTo16BitPCM(resampled));

      const flush = () => {
        const total = chunksRef.current.reduce((n, c) => n + c.length, 0);
        const merged = new Int16Array(total);
        let offset = 0;
        chunksRef.current.forEach((c) => { merged.set(c, offset); offset += c.length; });
        void sendTurn(merged);
      };

      if (peak > SILENCE_LEVEL) {
        // Человек заговорил — напоминания «говорите, я вас слушаю» больше не нужны
        lastActivityRef.current = Date.now();
        idleCountRef.current = 0;
        // и подсказка «не расслышал» тоже: она относилась к прошлой попытке
        if (speechMsRef.current === 0) setError(null);
        // Держим небольшой «хвост» тишины перед речью: без него у фразы
        // срезается первый слог и распознавание теряет начало.
        if (speechMsRef.current === 0 && preRollRef.current.length) {
          chunksRef.current.push(...preRollRef.current);
          preRollRef.current = [];
        }
        chunksRef.current.push(pcm);
        speechMsRef.current += blockMs;
        silenceMsRef.current = 0;

        // Очень длинную реплику отправляем, не дожидаясь паузы
        if (speechMsRef.current >= MAX_SPEECH_MS) flush();
        return;
      }

      // Тишина до начала речи — копим небольшой запас (~300 мс)
      if (speechMsRef.current === 0) {
        preRollRef.current.push(pcm);
        if (preRollRef.current.length > 4) preRollRef.current.shift();
        return;
      }

      // Тишина: короткую паузу внутри фразы тоже пишем, чтобы речь не рвалась
      if (speechMsRef.current > 0) {
        chunksRef.current.push(pcm);
        silenceMsRef.current += blockMs;

        if (silenceMsRef.current >= SILENCE_MS) {
          if (speechMsRef.current >= MIN_SPEECH_MS) {
            flush();
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

  const connect = useCallback(async (options?: ConnectOptions) => {
    setError(null);
    setUserTranscript('');
    setAssistantTranscript('');
    setFields({});
    setStatus('connecting');
    historyRef.current = [];
    idleCountRef.current = 0;
    userNameRef.current = options?.userName || '';
    try {
      const userId = localStorage.getItem('userId') || '';
      const cfgResp = await fetch(REALTIME_API, { headers: { 'X-User-Id': userId } });
      const cfg: RealtimeConfig = await cfgResp.json();
      if (!cfg.configured) {
        throw new Error(cfg.message || 'Голосовой сервис не настроен');
      }
      outRateRef.current = cfg.sample_rate || DEFAULT_OUT_RATE;
      inRateRef.current = cfg.input_sample_rate || cfg.sample_rate || DEFAULT_IN_RATE;

      activeRef.current = true;
      await startMic();
      setConnected(true);
      lastActivityRef.current = Date.now();

      // Агент здоровается первым — фотографу не нужно начинать разговор самому.
      if (options?.greeting) {
        void sendTurnRef.current(null, options.greeting, true);
      } else {
        setStatus('listening');
      }

      // Клиент молчит — агент мягко напомнит, что ждёт ответа.
      idleTimerRef.current = setInterval(() => {
        if (!activeRef.current || busyRef.current) return;
        if (speechMsRef.current > 0) return; // человек как раз говорит
        if (idleCountRef.current >= MAX_IDLE_REMINDERS) return;
        if (Date.now() - lastActivityRef.current < IDLE_REMINDER_MS) return;

        idleCountRef.current += 1;
        lastActivityRef.current = Date.now();
        void sendTurnRef.current(
          null,
          'Собеседник молчит. Мягко и коротко скажи ровно одну фразу: '
          + '«Говорите, я вас слушаю!» Ничего больше не добавляй.',
          true,
        );
      }, 2000);
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
    status, error, userTranscript, assistantTranscript, connected, fields, connect, disconnect,
  };
}

export default useRealtimeVoice;