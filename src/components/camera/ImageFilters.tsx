import { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';

interface ImageFiltersProps {
  imageUrl: string;
  onSave: (filteredImageBlob: Blob) => void;
}

interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
  hue: number;
}

const ImageFilters = ({ imageUrl, onSave }: ImageFiltersProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [filters, setFilters] = useState<FilterSettings>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    grayscale: 0,
    sepia: 0,
    hue: 0
  });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setOriginalImage(img);
      if (canvasRef.current) {
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        applyFilters(img, filters);
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (originalImage) {
      applyFilters(originalImage, filters);
    }
  }, [filters, originalImage]);

  const applyFilters = (img: HTMLImageElement, filterSettings: FilterSettings) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.filter = `
      brightness(${filterSettings.brightness}%)
      contrast(${filterSettings.contrast}%)
      saturate(${filterSettings.saturation}%)
      blur(${filterSettings.blur}px)
      grayscale(${filterSettings.grayscale}%)
      sepia(${filterSettings.sepia}%)
      hue-rotate(${filterSettings.hue}deg)
    `;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob);
      }
    }, 'image/jpeg', 0.95);
  };

  const resetFilters = () => {
    setFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      hue: 0
    });
  };

  const applyPreset = (preset: string) => {
    const presets: Record<string, FilterSettings> = {
      vintage: {
        brightness: 110,
        contrast: 120,
        saturation: 80,
        blur: 0,
        grayscale: 0,
        sepia: 40,
        hue: 0
      },
      blackwhite: {
        brightness: 100,
        contrast: 110,
        saturation: 0,
        blur: 0,
        grayscale: 100,
        sepia: 0,
        hue: 0
      },
      vivid: {
        brightness: 110,
        contrast: 130,
        saturation: 140,
        blur: 0,
        grayscale: 0,
        sepia: 0,
        hue: 0
      },
      cool: {
        brightness: 100,
        contrast: 100,
        saturation: 110,
        blur: 0,
        grayscale: 0,
        sepia: 0,
        hue: 200
      },
      warm: {
        brightness: 105,
        contrast: 105,
        saturation: 110,
        blur: 0,
        grayscale: 0,
        sepia: 20,
        hue: -20
      }
    };

    if (presets[preset]) {
      setFilters(presets[preset]);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="overflow-x-auto">
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto border rounded"
        />
      </div>

      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => applyPreset('vintage')} variant="outline">
            Винтаж
          </Button>
          <Button size="sm" onClick={() => applyPreset('blackwhite')} variant="outline">
            Ч/Б
          </Button>
          <Button size="sm" onClick={() => applyPreset('vivid')} variant="outline">
            Яркий
          </Button>
          <Button size="sm" onClick={() => applyPreset('cool')} variant="outline">
            Холодный
          </Button>
          <Button size="sm" onClick={() => applyPreset('warm')} variant="outline">
            Тёплый
          </Button>
          <Button size="sm" onClick={resetFilters} variant="outline">
            <Icon name="RotateCcw" size={16} />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Яркость</label>
            <Slider
              value={[filters.brightness]}
              onValueChange={([v]) => setFilters(prev => ({ ...prev, brightness: v }))}
              min={0}
              max={200}
              step={1}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Контраст</label>
            <Slider
              value={[filters.contrast]}
              onValueChange={([v]) => setFilters(prev => ({ ...prev, contrast: v }))}
              min={0}
              max={200}
              step={1}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Насыщенность</label>
            <Slider
              value={[filters.saturation]}
              onValueChange={([v]) => setFilters(prev => ({ ...prev, saturation: v }))}
              min={0}
              max={200}
              step={1}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Размытие</label>
            <Slider
              value={[filters.blur]}
              onValueChange={([v]) => setFilters(prev => ({ ...prev, blur: v }))}
              min={0}
              max={20}
              step={1}
            />
          </div>
        </div>

        <Button onClick={handleSave} className="w-full" size="lg">
          <Icon name="Save" className="mr-2" />
          Сохранить
        </Button>
      </div>
    </Card>
  );
};

export default ImageFilters;
