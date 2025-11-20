# Примеры использования S3 загрузки с фронтенда

## Backend API URLs

```javascript
const API_URLS = {
  uploadUrl: 'https://functions.poehali.dev/85f5163d-cdb4-42ad-96df-ace30518b059',
  multipartUpload: 'https://functions.poehali.dev/b6f11a68-10a4-4805-8d75-86eea3d39449',
  confirmUpload: 'https://functions.poehali.dev/ca7d4e1a-305a-4229-82c8-9584f6f84400',
  downloadUrl: 'https://functions.poehali.dev/8a60ca41-e494-417e-b881-2ce4f1f4247e'
};
```

---

## 1. Простая загрузка (файлы до 100 МБ)

```javascript
async function uploadFileDirect(file, userId) {
  const ext = file.name.split('.').pop();
  
  const urlResponse = await fetch(API_URLS.uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      contentType: file.type,
      ext,
      plannedSize: file.size
    })
  });
  
  if (!urlResponse.ok) {
    const error = await urlResponse.json();
    throw new Error(error.error || 'Failed to get upload URL');
  }
  
  const { url, key } = await urlResponse.json();
  
  const uploadResponse = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  });
  
  if (!uploadResponse.ok) {
    throw new Error('Upload failed');
  }
  
  const confirmResponse = await fetch(API_URLS.confirmUpload, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      key,
      originalFilename: file.name
    })
  });
  
  if (!confirmResponse.ok) {
    throw new Error('Failed to confirm upload');
  }
  
  const metadata = await confirmResponse.json();
  console.log('Upload successful:', metadata);
  
  return metadata;
}
```

**Использование:**
```javascript
const file = document.querySelector('input[type="file"]').files[0];
const userId = 1;

uploadFileDirect(file, userId)
  .then(metadata => console.log('File uploaded:', metadata))
  .catch(error => console.error('Upload error:', error));
```

---

## 2. Multipart Upload (файлы больше 100 МБ)

```javascript
async function uploadFileMultipart(file, userId, onProgress) {
  const CHUNK_SIZE = 10 * 1024 * 1024;
  const ext = file.name.split('.').pop();
  
  const initiateResponse = await fetch(API_URLS.multipartUpload, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'initiate',
      userId,
      contentType: file.type,
      ext,
      plannedSize: file.size
    })
  });
  
  if (!initiateResponse.ok) {
    const error = await initiateResponse.json();
    throw new Error(error.error || 'Failed to initiate upload');
  }
  
  const { uploadId, key } = await initiateResponse.json();
  
  const partCount = Math.ceil(file.size / CHUNK_SIZE);
  
  const urlsResponse = await fetch(API_URLS.multipartUpload, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getPartUrls',
      userId,
      key,
      uploadId,
      partCount
    })
  });
  
  if (!urlsResponse.ok) {
    throw new Error('Failed to get part URLs');
  }
  
  const { partUrls } = await urlsResponse.json();
  
  const uploadedParts = [];
  
  for (let i = 0; i < partUrls.length; i++) {
    const { partNumber, url } = partUrls[i];
    const start = (partNumber - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const uploadResponse = await fetch(url, {
      method: 'PUT',
      body: chunk
    });
    
    if (!uploadResponse.ok) {
      await fetch(API_URLS.multipartUpload, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'abort',
          userId,
          key,
          uploadId
        })
      });
      
      throw new Error(`Failed to upload part ${partNumber}`);
    }
    
    const etag = uploadResponse.headers.get('ETag');
    uploadedParts.push({ partNumber, etag });
    
    if (onProgress) {
      onProgress(Math.round((i + 1) / partUrls.length * 100));
    }
  }
  
  const completeResponse = await fetch(API_URLS.multipartUpload, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      userId,
      key,
      uploadId,
      parts: uploadedParts
    })
  });
  
  if (!completeResponse.ok) {
    throw new Error('Failed to complete upload');
  }
  
  const confirmResponse = await fetch(API_URLS.confirmUpload, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      key,
      originalFilename: file.name
    })
  });
  
  if (!confirmResponse.ok) {
    throw new Error('Failed to confirm upload');
  }
  
  const metadata = await confirmResponse.json();
  console.log('Multipart upload successful:', metadata);
  
  return metadata;
}
```

**Использование:**
```javascript
const file = document.querySelector('input[type="file"]').files[0];
const userId = 1;

uploadFileMultipart(file, userId, (progress) => {
  console.log(`Upload progress: ${progress}%`);
})
  .then(metadata => console.log('File uploaded:', metadata))
  .catch(error => console.error('Upload error:', error));
```

---

## 3. Скачивание файла (только владелец)

```javascript
async function getDownloadUrl(s3Key, userId) {
  const response = await fetch(
    `${API_URLS.downloadUrl}?key=${encodeURIComponent(s3Key)}&userId=${userId}`,
    { method: 'GET' }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get download URL');
  }
  
  const { url, expiresIn } = await response.json();
  
  console.log(`Download URL valid for ${expiresIn} seconds`);
  
  return url;
}

async function downloadFile(s3Key, userId) {
  const downloadUrl = await getDownloadUrl(s3Key, userId);
  
  window.location.href = downloadUrl;
}
```

**Использование:**
```javascript
const s3Key = 'incoming/1/abc123-def456.jpg';
const userId = 1;

downloadFile(s3Key, userId)
  .catch(error => console.error('Download error:', error));
```

---

## 4. Универсальный компонент загрузки

```javascript
class S3Uploader {
  constructor(userId, apiUrls) {
    this.userId = userId;
    this.apiUrls = apiUrls;
    this.MULTIPART_THRESHOLD = 100 * 1024 * 1024;
  }
  
  async upload(file, onProgress) {
    if (file.size > this.MULTIPART_THRESHOLD) {
      return this.uploadMultipart(file, onProgress);
    } else {
      return this.uploadDirect(file, onProgress);
    }
  }
  
  async uploadDirect(file, onProgress) {
    const ext = file.name.split('.').pop();
    
    const urlResponse = await fetch(this.apiUrls.uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.userId,
        contentType: file.type,
        ext,
        plannedSize: file.size
      })
    });
    
    if (!urlResponse.ok) {
      const error = await urlResponse.json();
      throw new Error(error.error || 'Failed to get upload URL');
    }
    
    const { url, key } = await urlResponse.json();
    
    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      
      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          const confirmResponse = await fetch(this.apiUrls.confirmUpload, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: this.userId,
              key,
              originalFilename: file.name
            })
          });
          
          if (!confirmResponse.ok) {
            reject(new Error('Failed to confirm upload'));
            return;
          }
          
          const metadata = await confirmResponse.json();
          resolve(metadata);
        } else {
          reject(new Error('Upload failed'));
        }
      });
      
      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }
  
  async uploadMultipart(file, onProgress) {
    const CHUNK_SIZE = 10 * 1024 * 1024;
    const ext = file.name.split('.').pop();
    
    const initiateResponse = await fetch(this.apiUrls.multipartUpload, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'initiate',
        userId: this.userId,
        contentType: file.type,
        ext,
        plannedSize: file.size
      })
    });
    
    if (!initiateResponse.ok) {
      const error = await initiateResponse.json();
      throw new Error(error.error || 'Failed to initiate upload');
    }
    
    const { uploadId, key } = await initiateResponse.json();
    
    const partCount = Math.ceil(file.size / CHUNK_SIZE);
    
    const urlsResponse = await fetch(this.apiUrls.multipartUpload, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getPartUrls',
        userId: this.userId,
        key,
        uploadId,
        partCount
      })
    });
    
    if (!urlsResponse.ok) {
      throw new Error('Failed to get part URLs');
    }
    
    const { partUrls } = await urlsResponse.json();
    
    const uploadedParts = [];
    
    for (let i = 0; i < partUrls.length; i++) {
      const { partNumber, url } = partUrls[i];
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: chunk
      });
      
      if (!uploadResponse.ok) {
        await fetch(this.apiUrls.multipartUpload, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'abort',
            userId: this.userId,
            key,
            uploadId
          })
        });
        
        throw new Error(`Failed to upload part ${partNumber}`);
      }
      
      const etag = uploadResponse.headers.get('ETag');
      uploadedParts.push({ partNumber, etag });
      
      if (onProgress) {
        onProgress(Math.round((i + 1) / partUrls.length * 100));
      }
    }
    
    const completeResponse = await fetch(this.apiUrls.multipartUpload, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'complete',
        userId: this.userId,
        key,
        uploadId,
        parts: uploadedParts
      })
    });
    
    if (!completeResponse.ok) {
      throw new Error('Failed to complete upload');
    }
    
    const confirmResponse = await fetch(this.apiUrls.confirmUpload, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.userId,
        key,
        originalFilename: file.name
      })
    });
    
    if (!confirmResponse.ok) {
      throw new Error('Failed to confirm upload');
    }
    
    return await confirmResponse.json();
  }
}
```

**Использование:**
```javascript
const uploader = new S3Uploader(userId, API_URLS);

const file = document.querySelector('input[type="file"]').files[0];

uploader.upload(file, (progress) => {
  console.log(`Upload progress: ${progress}%`);
  document.querySelector('.progress-bar').style.width = `${progress}%`;
})
  .then(metadata => {
    console.log('Upload successful:', metadata);
    alert('Файл загружен успешно!');
  })
  .catch(error => {
    console.error('Upload error:', error);
    alert('Ошибка загрузки: ' + error.message);
  });
```

---

## 5. React пример с прогресс-баром

```jsx
import { useState } from 'react';

function FileUploader({ userId, apiUrls }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
    setUploadedFile(null);
  };
  
  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setProgress(0);
    setError(null);
    
    try {
      const uploader = new S3Uploader(userId, apiUrls);
      const metadata = await uploader.upload(file, (prog) => {
        setProgress(prog);
      });
      
      setUploadedFile(metadata);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="file-uploader">
      <input 
        type="file" 
        onChange={handleFileChange}
        disabled={uploading}
      />
      
      <button 
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? 'Загрузка...' : 'Загрузить файл'}
      </button>
      
      {uploading && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
          <span>{progress}%</span>
        </div>
      )}
      
      {error && (
        <div className="error">Ошибка: {error}</div>
      )}
      
      {uploadedFile && (
        <div className="success">
          Файл загружен! ID: {uploadedFile.id}
        </div>
      )}
    </div>
  );
}
```

---

## Проверка квоты перед загрузкой

```javascript
async function checkUserQuota(userId) {
  const response = await fetch(
    `${API_BASE_URL}/user-quota?userId=${userId}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to check quota');
  }
  
  const { usedBytes, totalBytes } = await response.json();
  
  return {
    used: usedBytes,
    total: totalBytes,
    available: totalBytes - usedBytes,
    percentUsed: Math.round((usedBytes / totalBytes) * 100)
  };
}
```

---

## Безопасность

1. **Никогда не храните S3 ключи на фронтенде**
2. **Проверяйте userId на бэкенде** перед выдачей URL
3. **Pre-signed URL истекают через 15 минут** для загрузки и 10 минут для скачивания
4. **CORS настроен только для ваших доменов** (foto-mix.ru, localhost:3000)
5. **Бакет приватный** — файлы не доступны без авторизации
