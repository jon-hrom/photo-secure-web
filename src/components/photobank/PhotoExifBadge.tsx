import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

const EXTRACT_EXIF_API = 'https://functions.poehali.dev/340b5361-292f-4f16-8d31-f179fa6856b1';

interface ExifData {
  Make?: string;
  Model?: string;
  DateTimeOriginal?: string;
  FocalLength?: string;
  FNumber?: string;
  ExposureTime?: string;
  ISOSpeedRatings?: string;
  [key: string]: any;
}

interface PhotoExifBadgeProps {
  s3Key: string;
  compact?: boolean;
}

const PhotoExifBadge = ({ s3Key, compact = false }: PhotoExifBadgeProps) => {
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (s3Key) {
      fetchExifData();
    }
  }, [s3Key]);

  const fetchExifData = async () => {
    setLoading(true);
    try {
      const response = await fetch(EXTRACT_EXIF_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3_key: s3Key }),
      });

      if (response.ok) {
        const data = await response.json();
        setExifData(data.exif || {});
      }
    } catch (error) {
      console.error('Failed to fetch EXIF:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Badge variant="outline" className="text-xs">
        <Icon name="Loader2" size={10} className="animate-spin mr-1" />
        Загрузка...
      </Badge>
    );
  }

  if (!exifData || Object.keys(exifData).length === 0) {
    return null;
  }

  const camera = [exifData.Make, exifData.Model].filter(Boolean).join(' ');
  const focalLength = exifData.FocalLength;
  const fNumber = exifData.FNumber;
  const iso = exifData.ISOSpeedRatings;

  if (compact) {
    return (
      <div className="flex gap-1 flex-wrap">
        {camera && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
            <Icon name="Camera" size={10} className="mr-1" />
            {camera}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-1 flex-wrap text-xs text-muted-foreground">
      {camera && (
        <span className="flex items-center gap-1">
          <Icon name="Camera" size={12} />
          {camera}
        </span>
      )}
      {focalLength && <span>• {focalLength}</span>}
      {fNumber && <span>• f/{fNumber}</span>}
      {iso && <span>• ISO {iso}</span>}
    </div>
  );
};

export default PhotoExifBadge;
