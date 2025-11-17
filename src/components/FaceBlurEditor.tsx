import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface Face {
  box: { x: number; y: number; width: number; height: number };
  blurred: boolean;
}

export default function FaceBlurEditor() {
  const [image, setImage] = useState<string | null>(null);
  const [faces, setFaces] = useState<Face[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
      ]);
      
      setModelsLoaded(true);
      console.log('Модели загружены успешно');
    } catch (error) {
      console.error('Ошибка загрузки моделей:', error);
      alert('Не удалось загрузить модели распознавания лиц');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
      setFaces([]);
    };
    reader.readAsDataURL(file);
  };

  const detectFaces = async () => {
    if (!imageRef.current || !modelsLoaded) return;

    setLoading(true);
    try {
      const detections = await faceapi
        .detectAllFaces(imageRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      const newFaces: Face[] = detections.map((d) => ({
        box: {
          x: d.detection.box.x,
          y: d.detection.box.y,
          width: d.detection.box.width,
          height: d.detection.box.height
        },
        blurred: true
      }));

      setFaces(newFaces);
      drawCanvas();
    } catch (error) {
      console.error('Ошибка распознавания лиц:', error);
      alert('Не удалось распознать лица на фото');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (image && modelsLoaded) {
      const img = new Image();
      img.onload = () => {
        detectFaces();
      };
      img.src = image;
    }
  }, [image, modelsLoaded]);

  useEffect(() => {
    drawCanvas();
  }, [faces]);

  const drawCanvas = () => {
    if (!imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    faces.forEach((face) => {
      if (face.blurred) {
        ctx.save();
        ctx.filter = 'blur(20px)';
        ctx.drawImage(
          img,
          face.box.x,
          face.box.y,
          face.box.width,
          face.box.height,
          face.box.x,
          face.box.y,
          face.box.width,
          face.box.height
        );
        ctx.restore();
      }

      ctx.strokeStyle = face.blurred ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(face.box.x, face.box.y, face.box.width, face.box.height);
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const clickedFaceIndex = faces.findIndex(
      (face) =>
        x >= face.box.x &&
        x <= face.box.x + face.box.width &&
        y >= face.box.y &&
        y <= face.box.y + face.box.height
    );

    if (clickedFaceIndex !== -1) {
      const newFaces = [...faces];
      newFaces[clickedFaceIndex].blurred = !newFaces[clickedFaceIndex].blurred;
      setFaces(newFaces);
    }
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = 'photo-secure.png';
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <Card className="p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Защита лиц на фото
            </h1>
            <p className="text-gray-600">
              Загрузите фото - лица автоматически размоются. Кликните на лицо чтобы размыть/размылить.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="lg"
                disabled={loading}
              >
                <Icon name="Upload" className="mr-2" />
                {loading ? 'Загрузка...' : 'Загрузить фото'}
              </Button>
            </div>

            {image && (
              <div className="space-y-4">
                <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    ref={imageRef}
                    src={image}
                    alt="Uploaded"
                    className="hidden"
                    crossOrigin="anonymous"
                  />
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="w-full h-auto cursor-pointer"
                    style={{ maxHeight: '70vh' }}
                  />
                </div>

                <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className="text-sm text-gray-700">Размыто</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm text-gray-700">Открыто</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    Найдено лиц: <span className="font-bold">{faces.length}</span>
                  </div>
                </div>

                {faces.length > 0 && (
                  <div className="flex justify-center">
                    <Button onClick={downloadImage} size="lg">
                      <Icon name="Download" className="mr-2" />
                      Скачать фото
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!modelsLoaded && !loading && (
              <div className="text-center text-red-500">
                Модели не загружены. Обновите страницу.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
