import { useEffect } from 'react';

export function useGalleryProtection(screenshotProtection?: boolean) {
  useEffect(() => {
    if (screenshotProtection) {
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      
      const preventScreenshot = (e: Event) => {
        if ((e as KeyboardEvent).key === 'PrintScreen') {
          e.preventDefault();
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;background:black;z-index:999999';
          document.body.appendChild(overlay);
          setTimeout(() => overlay.remove(), 100);
        }
      };
      
      const preventContextMenu = (e: Event) => {
        e.preventDefault();
        return false;
      };
      
      window.addEventListener('keyup', preventScreenshot);
      document.addEventListener('contextmenu', preventContextMenu);
      
      return () => {
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        window.removeEventListener('keyup', preventScreenshot);
        document.removeEventListener('contextmenu', preventContextMenu);
      };
    }
  }, [screenshotProtection]);
}
