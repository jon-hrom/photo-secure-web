import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import funcUrls from '../../../../backend/func2url.json';
import type {
  DetectResult,
  HumanizeFullResult,
  HumanizerSettings,
  SentenceInfo,
} from './types';

const HUMANIZER_URL = (funcUrls as Record<string, string>).humanizer || '';

async function call<T = unknown>(body: Record<string, unknown>, userId: string | null): Promise<T> {
  if (!HUMANIZER_URL) {
    throw new Error('Инструмент пока не развёрнут на сервере. Напишите в поддержку.');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userId) headers['X-User-Id'] = userId;
  const res = await fetch(HUMANIZER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export function useHumanizerApi(userId: string | null) {
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string>('');

  const parseFile = useCallback(async (file: File): Promise<{ text: string; truncated: boolean }> => {
    setLoading(true);
    setPhase('Читаю файл…');
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = reader.result as string;
          resolve(r.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await call<{ text: string; truncated: boolean }>({
        action: 'parse_file',
        filename: file.name,
        file_base64: b64,
      }, userId);
      if (res.truncated) toast.warning('Файл обрезан до 50 000 символов');
      return res;
    } finally {
      setLoading(false);
      setPhase('');
    }
  }, [userId]);

  const detect = useCallback(async (text: string, useLlm = true): Promise<DetectResult> => {
    setLoading(true);
    setPhase('Анализирую текст…');
    try {
      return await call<DetectResult>({ action: 'detect', text, use_llm: useLlm }, userId);
    } finally {
      setLoading(false);
      setPhase('');
    }
  }, [userId]);

  const rewriteSentence = useCallback(async (
    text: string,
    settings: HumanizerSettings,
    numVariants = 3,
  ): Promise<string[]> => {
    setLoading(true);
    setPhase('Подбираю варианты…');
    try {
      const res = await call<{ variants: string[] }>({
        action: 'rewrite',
        text,
        style: settings.style,
        aggression: settings.aggression,
        preserve_terms: settings.preserveTerms,
        academic_mode: settings.academicMode,
        num_variants: numVariants,
        seed: Math.floor(Math.random() * 100000),
      }, userId);
      return res.variants;
    } finally {
      setLoading(false);
      setPhase('');
    }
  }, [userId]);

  const humanizeFull = useCallback(async (
    text: string,
    settings: HumanizerSettings,
  ): Promise<HumanizeFullResult> => {
    setLoading(true);
    setPhase('Очеловечиваю текст… (может занять до минуты)');
    try {
      return await call<HumanizeFullResult>({
        action: 'humanize_full',
        text,
        style: settings.style,
        aggression: settings.aggression,
        preserve_terms: settings.preserveTerms,
        academic_mode: settings.academicMode,
        target_score: settings.targetScore,
        max_passes: 4,
      }, userId);
    } finally {
      setLoading(false);
      setPhase('');
    }
  }, [userId]);

  const saveDocument = useCallback(async (
    original: string,
    humanized: string,
    scoreBefore: number,
    scoreAfter: number,
    title: string,
    sourceFilename: string,
    sourceType: string,
    settings: HumanizerSettings,
  ): Promise<number> => {
    const res = await call<{ id: number }>({
      action: 'save_document',
      original_text: original,
      humanized_text: humanized,
      ai_score_before: scoreBefore,
      ai_score_after: scoreAfter,
      title,
      source_filename: sourceFilename,
      source_type: sourceType,
      style: settings.style,
      aggression: settings.aggression,
    }, userId);
    return res.id;
  }, [userId]);

  const exportDocx = useCallback(async (text: string, title: string): Promise<void> => {
    const res = await call<{ file_base64: string; filename: string }>({
      action: 'export_docx',
      text,
      title,
    }, userId);
    const bin = atob(res.file_base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [userId]);

  return {
    loading,
    phase,
    parseFile,
    detect,
    rewriteSentence,
    humanizeFull,
    saveDocument,
    exportDocx,
  };
}

export function getSentenceScoreColor(score: number): string {
  // Светлая тема: заливка + чёрный текст. Тёмная тема: мягкий бг + светлый текст.
  if (score >= 80) {
    return 'bg-red-200 text-red-950 hover:bg-red-300 dark:bg-red-900/60 dark:text-red-50 dark:hover:bg-red-800/70 border-l-4 border-red-500';
  }
  if (score >= 60) {
    return 'bg-orange-200 text-orange-950 hover:bg-orange-300 dark:bg-orange-900/50 dark:text-orange-50 dark:hover:bg-orange-800/60 border-l-4 border-orange-500';
  }
  if (score >= 40) {
    return 'bg-yellow-200 text-yellow-950 hover:bg-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-50 dark:hover:bg-yellow-800/60 border-l-4 border-yellow-500';
  }
  if (score >= 20) {
    return 'bg-lime-100 text-lime-950 hover:bg-lime-200 dark:bg-lime-900/30 dark:text-lime-50 dark:hover:bg-lime-800/50 border-l-2 border-lime-400';
  }
  return 'hover:bg-muted/60 border-l-2 border-transparent';
}

export function getOverallColor(score: number): string {
  if (score >= 60) return 'text-red-600 dark:text-red-400';
  if (score >= 35) return 'text-orange-600 dark:text-orange-400';
  if (score >= 15) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

export function buildSentences(text: string): SentenceInfo[] {
  // Клиентский split — для моментальной подсветки до ответа сервера.
  const re = /[^.!?…]+[.!?…]*\s*/g;
  const out: SentenceInfo[] = [];
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    const t = m[0].trim();
    if (!t) continue;
    out.push({
      index: idx++,
      text: t,
      start: m.index,
      end: m.index + m[0].length,
      paragraph: 0,
      ai_score: 0,
    });
  }
  return out;
}