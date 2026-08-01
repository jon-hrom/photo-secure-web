import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { length: number;[i: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SRConstructor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SRConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  finalText: string;
  interimText: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Распознавание речи через встроенный в браузер Web Speech API.
 * Работает без внешних ключей (Chrome/Edge/Android). Служит витриной сценария;
 * позже распознавание можно заменить на Yandex Realtime API без изменения UI.
 */
export function useSpeechRecognition(lang = 'ru-RU'): UseSpeechRecognitionResult {
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);

  const supported = !!getRecognitionCtor();

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0].transcript;
        if (res.isFinal) final += txt;
        else interim += txt;
      }
      if (final) setFinalText((prev) => (prev ? prev + ' ' : '') + final.trim());
      setInterimText(interim);
    };

    rec.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        setError('Нет доступа к микрофону. Разрешите доступ в браузере.');
        wantListeningRef.current = false;
        setListening(false);
      } else {
        setError('Ошибка распознавания: ' + ev.error);
      }
    };

    rec.onend = () => {
      if (wantListeningRef.current) {
        try { rec.start(); } catch { /* уже запущено */ }
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;
    return () => {
      wantListeningRef.current = false;
      try { rec.abort(); } catch { /* ignore */ }
      recRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    setError(null);
    setInterimText('');
    const rec = recRef.current;
    if (!rec) return;
    wantListeningRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch { /* уже запущено */ }
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    const rec = recRef.current;
    if (rec) { try { rec.stop(); } catch { /* ignore */ } }
    setListening(false);
    setInterimText('');
  }, []);

  const reset = useCallback(() => {
    setFinalText('');
    setInterimText('');
    setError(null);
  }, []);

  return { supported, listening, finalText, interimText, error, start, stop, reset };
}

export default useSpeechRecognition;
