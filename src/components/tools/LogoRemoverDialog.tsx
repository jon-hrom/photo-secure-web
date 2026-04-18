import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';

const LOGO_REMOVE_URL = 'https://functions.poehali.dev/3795ef81-5e3e-451a-b638-0d994d8ee56c';
const MAX_SIDE = 1600;

interface LogoRemoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = 'upload' | 'edit';

const fileToImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

const dataUrlToBase64 = (dataUrl: string) => dataUrl.split(',')[1] || '';

const imageToDataUrl = (img: HTMLImageElement, mime = 'image/jpeg'): string => {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL(mime, 0.92);
};

const LogoRemoverDialog = ({ open, onOpenChange }: LogoRemoverDialogProps) => {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('upload');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [brushSize, setBrushSize] = useState(30);
  const [hasMask, setHasMask] = useState(false);
  const [historyLen, setHistoryLen] = useState(0);

  const originalDataUrlRef = useRef<string>('');
  const currentDataUrlRef = useRef<string>('');
  const historyRef = useRef<string[]>([]);

  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const resetAll = useCallback(() => {
    setStage('upload');
    setLoading(false);
    setLoadingText('');
    setHasMask(false);
    setHistoryLen(0);
    originalDataUrlRef.current = '';
    currentDataUrlRef.current = '';
    historyRef.current = [];
  }, []);

  useEffect(() => {
    if (!open) resetAll();
  }, [open, resetAll]);

  const clearMask = useCallback(() => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const mctx = mask.getContext('2d')!;
    mctx.clearRect(0, 0, mask.width, mask.height);
    setHasMask(false);
  }, []);

  const loadImageIntoCanvas = useCallback(async (dataUrl: string) => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
    currentDataUrlRef.current = dataUrl;

    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas) return;
    imgCanvas.width = img.naturalWidth;
    imgCanvas.height = img.naturalHeight;
    maskCanvas.width = img.naturalWidth;
    maskCanvas.height = img.naturalHeight;
    const ctx = imgCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    ctx.drawImage(img, 0, 0);
    const mctx = maskCanvas.getContext('2d')!;
    mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasMask(false);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setLoadingText('Загружаем фото...');
      const img = await fileToImage(file);
      const dataUrl = imageToDataUrl(img, 'image/jpeg');
      originalDataUrlRef.current = dataUrl;
      historyRef.current = [dataUrl];
      setHistoryLen(1);
      setStage('edit');
      await new Promise((r) => setTimeout(r, 50));
      await loadImageIntoCanvas(dataUrl);
    } catch (e) {
      console.error(e);
      toast({ title: 'Не удалось загрузить фото', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [loadImageIntoCanvas]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawAt = (x: number, y: number, erase: boolean) => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d')!;
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.fillStyle = 'rgba(236, 72, 153, 0.55)';
    const rect = mask.getBoundingClientRect();
    const scale = rect.width ? mask.width / rect.width : 1;
    const r = Math.max(4, brushSize * scale);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (lastPointRef.current) {
      ctx.lineWidth = r * 2;
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.55)';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    lastPointRef.current = { x, y };
    if (!erase) setHasMask(true);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = null;
    const p = getCanvasPoint(e);
    drawAt(p.x, p.y, e.button === 2 || e.ctrlKey);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = getCanvasPoint(e);
    drawAt(p.x, p.y, (e.buttons & 2) === 2 || e.ctrlKey);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastPointRef.current = null;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const detectAI = useCallback(async () => {
    if (!currentDataUrlRef.current) return;
    try {
      setLoading(true);
      setLoadingText('AI ищет логотип...');
      const res = await fetch(`${LOGO_REMOVE_URL}?action=detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrlToBase64(currentDataUrlRef.current) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const maskB64 = data.mask;
      if (!maskB64) throw new Error('AI не вернул маску');

      const mImg = new Image();
      await new Promise<void>((resolve, reject) => {
        mImg.onload = () => resolve();
        mImg.onerror = (e) => reject(e);
        mImg.src = `data:image/png;base64,${maskB64}`;
      });

      const mask = maskCanvasRef.current!;
      const mctx = mask.getContext('2d')!;
      const tmp = document.createElement('canvas');
      tmp.width = mask.width;
      tmp.height = mask.height;
      const tctx = tmp.getContext('2d')!;
      tctx.drawImage(mImg, 0, 0, mask.width, mask.height);
      const imgData = tctx.getImageData(0, 0, tmp.width, tmp.height);
      const px = imgData.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] > 128) {
          px[i] = 236;
          px[i + 1] = 72;
          px[i + 2] = 153;
          px[i + 3] = 140;
        } else {
          px[i + 3] = 0;
        }
      }
      tctx.putImageData(imgData, 0, 0);
      mctx.drawImage(tmp, 0, 0);
      setHasMask(true);

      const total = (data.ocr_pixels || 0) + (data.yolo_pixels || 0);
      if (total === 0) {
        toast({ title: 'AI не нашёл лого', description: 'Выделите область кистью вручную' });
      } else {
        toast({ title: 'Лого найдено', description: 'Проверьте выделение и нажмите «Стереть»' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка AI-детекции', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const inpaint = useCallback(async () => {
    if (!hasMask || !currentDataUrlRef.current) {
      toast({ title: 'Сначала выделите область', description: 'Кисть или «Найти AI»' });
      return;
    }
    try {
      setLoading(true);
      setLoadingText('Стираем лого...');

      const mask = maskCanvasRef.current!;
      const bw = document.createElement('canvas');
      bw.width = mask.width;
      bw.height = mask.height;
      const bwCtx = bw.getContext('2d')!;
      const src = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height);
      const dst = bwCtx.createImageData(mask.width, mask.height);
      for (let i = 0; i < src.data.length; i += 4) {
        const a = src.data[i + 3];
        const v = a > 10 ? 255 : 0;
        dst.data[i] = v;
        dst.data[i + 1] = v;
        dst.data[i + 2] = v;
        dst.data[i + 3] = 255;
      }
      bwCtx.putImageData(dst, 0, 0);
      const maskB64 = dataUrlToBase64(bw.toDataURL('image/png'));

      const res = await fetch(`${LOGO_REMOVE_URL}?action=inpaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrlToBase64(currentDataUrlRef.current),
          mask: maskB64,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.image) throw new Error(data?.error || `HTTP ${res.status}`);

      const resultDataUrl = `data:image/png;base64,${data.image}`;
      historyRef.current.push(resultDataUrl);
      setHistoryLen(historyRef.current.length);
      await loadImageIntoCanvas(resultDataUrl);
      toast({ title: 'Готово', description: 'Лого удалено. Можно продолжить или скачать.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка при стирании', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [hasMask, loadImageIntoCanvas]);

  const undo = useCallback(async () => {
    if (historyRef.current.length < 2) return;
    historyRef.current.pop();
    setHistoryLen(historyRef.current.length);
    const prev = historyRef.current[historyRef.current.length - 1];
    await loadImageIntoCanvas(prev);
    toast({ title: 'Отменено' });
  }, [loadImageIntoCanvas]);

  const download = useCallback(() => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `logo-removed-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="Eraser" size={22} className="text-primary" />
            Убрать лого с фото
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            AI найдёт лого автоматически — или выделите кистью вручную
          </DialogDescription>
        </DialogHeader>

        {stage === 'upload' && (
          <div
            className="mt-3 border-2 border-dashed border-border rounded-xl p-8 sm:p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <Icon name="ImagePlus" size={48} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-sm sm:text-base mb-1">Выберите фото или перетащите сюда</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP — до 20 МБ</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {stage === 'edit' && (
          <div className="mt-3 space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-border" style={{
              backgroundImage: 'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0',
            }}>
              <div className="relative max-h-[60vh] overflow-auto flex items-center justify-center">
                <div className="relative">
                  <canvas
                    ref={imageCanvasRef}
                    className="block max-w-full h-auto select-none"
                    style={{ maxHeight: '60vh' }}
                  />
                  <canvas
                    ref={maskCanvasRef}
                    className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                    style={{ maxHeight: '60vh' }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>
              </div>
              {loading && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm z-10">
                  <Icon name="Loader2" size={36} className="animate-spin mb-2" />
                  <p className="text-sm">{loadingText || 'Обработка...'}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-1">
              <Icon name="Brush" size={16} className="text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground flex-shrink-0 w-10">{brushSize}px</span>
              <Slider
                value={[brushSize]}
                min={5}
                max={80}
                step={1}
                onValueChange={(v) => setBrushSize(v[0])}
                className="flex-1"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={detectAI} disabled={loading} variant="default" size="sm" className="gap-1.5">
                <Icon name="Sparkles" size={16} />
                Найти AI
              </Button>
              <Button onClick={inpaint} disabled={loading || !hasMask} variant="default" size="sm" className="gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90">
                <Icon name="Eraser" size={16} />
                Стереть
              </Button>
              <Button onClick={clearMask} disabled={loading || !hasMask} variant="outline" size="sm" className="gap-1.5">
                <Icon name="X" size={16} />
                Очистить кисть
              </Button>
              <Button onClick={undo} disabled={loading || historyLen < 2} variant="outline" size="sm" className="gap-1.5">
                <Icon name="Undo2" size={16} />
                Отменить
              </Button>
              <Button onClick={download} disabled={loading} variant="outline" size="sm" className="gap-1.5">
                <Icon name="Download" size={16} />
                Скачать
              </Button>
              <Button onClick={resetAll} disabled={loading} variant="ghost" size="sm" className="gap-1.5 ml-auto">
                <Icon name="RotateCcw" size={16} />
                Новое фото
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground px-1">
              Закрасьте лого кистью или нажмите «Найти AI». Правая кнопка мыши или Ctrl — ластик маски. Затем «Стереть».
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LogoRemoverDialog;