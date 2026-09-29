import { useCallback, useMemo, useRef, useState } from 'react';
import type { SlimMask } from '@/components/tools/skinRetouch/plastic';

const AMOUNT_KEY = 'retouch_slim_amount';

/**
 * Маска кисти «Похудеть»: хранится в отдельном canvas в разрешении фото.
 * version меняется после каждого мазка — по нему пересчитывается пластика.
 */
export const useSlimMask = () => {
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const [version, setVersion] = useState(0);
  const [hasPaint, setHasPaint] = useState(false);
  const [amount, setAmountState] = useState<number>(() => {
    const n = Number(localStorage.getItem(AMOUNT_KEY));
    return Number.isFinite(n) && n > 0 ? n : 60;
  });
  const historyRef = useRef<ImageData[]>([]);
  const [historyLen, setHistoryLen] = useState(0);

  const setAmount = useCallback((v: number) => {
    setAmountState(v);
    localStorage.setItem(AMOUNT_KEY, String(v));
  }, []);

  const init = useCallback((w: number, h: number) => {
    const c = canvasRef.current;
    c.width = w;
    c.height = h;
    c.getContext('2d', { willReadFrequently: true })!.clearRect(0, 0, w, h);
    historyRef.current = [];
    setHistoryLen(0);
    setHasPaint(false);
    setVersion((v) => v + 1);
  }, []);

  /** Снимок перед мазком — для «Отменить». */
  const snapshot = useCallback(() => {
    const c = canvasRef.current;
    if (!c.width) return;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    historyRef.current.push(ctx.getImageData(0, 0, c.width, c.height));
    if (historyRef.current.length > 20) historyRef.current.shift();
    setHistoryLen(historyRef.current.length);
  }, []);

  const checkPaint = useCallback(() => {
    const c = canvasRef.current;
    if (!c.width) return false;
    const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 16) if (d[i] > 20) return true;
    return false;
  }, []);

  const commit = useCallback(() => {
    setHasPaint(checkPaint());
    setVersion((v) => v + 1);
  }, [checkPaint]);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    setHistoryLen(historyRef.current.length);
    if (!prev) return;
    canvasRef.current.getContext('2d', { willReadFrequently: true })!.putImageData(prev, 0, 0);
    commit();
  }, [commit]);

  const clear = useCallback(() => {
    const c = canvasRef.current;
    if (!c.width) return;
    snapshot();
    c.getContext('2d', { willReadFrequently: true })!.clearRect(0, 0, c.width, c.height);
    commit();
  }, [snapshot, commit]);

  const slim: SlimMask | null = useMemo(
    () => (hasPaint ? { canvas: canvasRef.current, amount } : null),
    [hasPaint, amount],
  );

  return {
    canvas: canvasRef.current,
    version: version * 1000 + amount,
    hasPaint,
    amount,
    setAmount,
    init,
    snapshot,
    commit,
    undo,
    clear,
    historyLen,
    slim,
  };
};

export type SlimMaskState = ReturnType<typeof useSlimMask>;
