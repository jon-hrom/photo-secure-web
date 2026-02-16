export interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

export interface PageDesignSettings {
  coverPhotoId: number | null;
  coverOrientation: 'horizontal' | 'vertical';
  coverFocusX: number;
  coverFocusY: number;
  gridGap: number;
  bgTheme: 'light' | 'dark' | 'auto' | 'custom';
  bgColor: string | null;
  bgImageUrl: string | null;
  bgImageData: string | null;
  bgImageExt: string;
  textColor: string | null;
  coverTextPosition: 'bottom-center' | 'center' | 'bottom-left' | 'bottom-right' | 'top-center';
  coverTitle: string | null;
  coverFontSize: number;
  mobileCoverPhotoId: number | null;
  mobileCoverFocusX: number;
  mobileCoverFocusY: number;
}
