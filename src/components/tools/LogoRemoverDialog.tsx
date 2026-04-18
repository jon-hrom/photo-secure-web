import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import PhotoBankPicker from '@/components/tools/PhotoBankPicker';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';
import UploadStage from '@/components/tools/logoRemover/UploadStage';
import EditorCanvas from '@/components/tools/logoRemover/EditorCanvas';
import EditorToolbar from '@/components/tools/logoRemover/EditorToolbar';
import {
  LOGO_REMOVE_URL,
  PHOTOBANK_URL,
  Stage,
  urlToImage,
  fileToImage,
  dataUrlToBase64,
  imageToDataUrl,
} from '@/components/tools/logoRemover/utils';

interface LogoRemoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LogoRemoverDialog = ({ open, onOpenChange }: LogoRemoverDialogProps) => {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('upload');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [brushSize, setBrushSize] = useState(30);
  const [hasMask, setHasMask] = useState(false);
  const [historyLen, setHistoryLen] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showPicker, setShowPicker] = useState(false);
  const [showSaver, setShowSaver] = useState(false);
  const [saving, setSaving] = useState(false);

  const originalDataUrlRef = useRef<string>('');
  const currentDataUrlRef = useRef<string>('');
  const historyRef = useRef<string[]>([]);

  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number; centerX: number; centerY: number; panX: number; panY: number } | null>(null);

  const resetAll = useCallback(() => {
    setStage('upload');
    setLoading(false);
    setLoadingText('');
    setHasMask(false);
    setHistoryLen(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    originalDataUrlRef.current = '';
    currentDataUrlRef.current = '';
    historyRef.current = [];
    pointersRef.current.clear();
    pinchRef.current = null;
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
  }, [loadImageIntoCanvas, toast]);

  const handlePickFromBank = useCallback(async (photo: { s3_url: string; file_name: string }) => {
    setShowPicker(false);
    try {
      setStage('edit');
      setLoading(true);
      setLoadingText('Загружаем фото из фотобанка...');
      await new Promise((r) => setTimeout(r, 50));
      const img = await urlToImage(photo.s3_url);
      const dataUrl = imageToDataUrl(img, 'image/jpeg');
      originalDataUrlRef.current = dataUrl;
      historyRef.current = [dataUrl];
      setHistoryLen(1);
      await loadImageIntoCanvas(dataUrl);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Не удалось загрузить фото',
        description: 'Возможно, фото защищено CORS. Попробуйте скачать и загрузить файл.',
        variant: 'destructive',
      });
      setStage('upload');
    } finally {
      setLoading(false);
    }
  }, [loadImageIntoCanvas, toast]);

  const handleSaveToFolder = useCallback(async (folder: { id: number; folder_name: string }) => {
    const userId = getAuthUserId();
    if (!userId) {
      toast({ title: 'Не удалось определить пользователя', variant: 'destructive' });
      return;
    }
    const canvas = imageCanvasRef.current;
    if (!canvas) return;
    try {
      setSaving(true);
      setLoading(true);
      setLoadingText('Сохраняем в фотобанк...');
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const fileName = `logo-removed-${Date.now()}.jpg`;
      const res = await fetch(PHOTOBANK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          action: 'upload_direct',
          folder_id: folder.id,
          file_name: fileName,
          file_data: dataUrl,
          width: canvas.width,
          height: canvas.height,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast({ title: 'Сохранено', description: `Фото загружено в «${folder.folder_name}»` });
      setShowSaver(false);
    } catch (e) {
      console.error(e);
      toast({ title: 'Не удалось сохранить', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }, [toast]);

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
    const canvas = e.target as HTMLCanvasElement;
    canvas.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      drawingRef.current = false;
      lastPointRef.current = null;
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchRef.current = {
        dist: Math.hypot(dx, dy),
        zoom,
        centerX: (pts[0].x + pts[1].x) / 2,
        centerY: (pts[0].y + pts[1].y) / 2,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }

    drawingRef.current = true;
    lastPointRef.current = null;
    const p = getCanvasPoint(e);
    drawAt(p.x, p.y, e.button === 2 || e.ctrlKey);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const newZoom = Math.min(6, Math.max(1, pinchRef.current.zoom * (dist / pinchRef.current.dist)));
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      setZoom(newZoom);
      setPan({
        x: pinchRef.current.panX + (cx - pinchRef.current.centerX),
        y: pinchRef.current.panY + (cy - pinchRef.current.centerY),
      });
      return;
    }

    if (!drawingRef.current) return;
    const p = getCanvasPoint(e);
    drawAt(p.x, p.y, (e.buttons & 2) === 2 || e.ctrlKey);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    drawingRef.current = false;
    lastPointRef.current = null;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(6, Math.max(1, z * delta)));
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
          <UploadStage
            fileInputRef={fileInputRef}
            onFile={handleFile}
            onOpenPicker={() => setShowPicker(true)}
          />
        )}

        {stage === 'edit' && (
          <div className="mt-3 space-y-3">
            <EditorCanvas
              viewportRef={viewportRef}
              imageCanvasRef={imageCanvasRef}
              maskCanvasRef={maskCanvasRef}
              pointersRef={pointersRef}
              zoom={zoom}
              pan={pan}
              loading={loading}
              loadingText={loadingText}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              setZoom={setZoom}
              resetZoom={resetZoom}
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />

            <EditorToolbar
              loading={loading}
              hasMask={hasMask}
              historyLen={historyLen}
              onDetectAI={detectAI}
              onInpaint={inpaint}
              onClearMask={clearMask}
              onUndo={undo}
              onDownload={download}
              onOpenSaver={() => setShowSaver(true)}
              onReset={resetAll}
            />
          </div>
        )}
      </DialogContent>

      <PhotoBankPicker
        open={showPicker}
        onOpenChange={setShowPicker}
        mode="pick"
        onPick={handlePickFromBank}
      />

      <PhotoBankPicker
        open={showSaver}
        onOpenChange={setShowSaver}
        mode="save"
        onSave={handleSaveToFolder}
        saveDisabled={saving}
      />
    </Dialog>
  );
};

export default LogoRemoverDialog;
