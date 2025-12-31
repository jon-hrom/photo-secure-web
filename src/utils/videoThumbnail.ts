export async function generateVideoThumbnail(videoFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(video.duration * 0.25, 2);
    });

    video.addEventListener('seeked', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
            reader.readAsDataURL(blob);
          } else {
            reject(new Error('Could not generate thumbnail'));
          }
          
          video.remove();
        },
        'image/jpeg',
        0.8
      );
    });

    video.addEventListener('error', (e) => {
      reject(new Error(`Video loading error: ${e}`));
      video.remove();
    });

    video.src = URL.createObjectURL(videoFile);
  });
}
