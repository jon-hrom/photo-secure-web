# 🧠 Модели для распознавания лиц

## Быстрая установка

Выполните команду в корне проекта:

```bash
cd public/models && \
curl -LO https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-weights_manifest.json && \
curl -LO https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model.bin -o tiny_face_detector_model-shard1.bin && \
curl -LO https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-weights_manifest.json && \
curl -LO https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model.bin -o face_landmark_68_model-shard1.bin && \
echo "✅ Модели загружены!"
```

## Что это даёт?

После установки моделей редактор фотоальбома сможет:
- 👤 Автоматически находить лица на фотографиях
- 🎯 Размещать фото так, чтобы лица не попадали под корешок книги
- ✨ Создавать более красивую и продуманную вёрстку

## Размер файлов

- `tiny_face_detector_model-*` - ~1.1 MB
- `face_landmark_68_model-*` - ~350 KB
- **Всего:** ~1.5 MB

## Альтернатива

Редактор будет работать и без моделей, но без умного позиционирования лиц.
