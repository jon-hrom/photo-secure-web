#!/bin/bash

echo "📥 Скачивание моделей для распознавания лиц..."
echo ""

cd "$(dirname "$0")/../public/models" || exit 1

MODELS=(
  "https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-weights_manifest.json"
  "https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-shard1"
  "https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-weights_manifest.json"
  "https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-shard1"
)

for model_url in "${MODELS[@]}"; do
  filename=$(basename "$model_url")
  echo "⬇️  Скачивание $filename..."
  
  if command -v curl &> /dev/null; then
    curl -L -o "$filename" "$model_url" --progress-bar
  elif command -v wget &> /dev/null; then
    wget -q --show-progress -O "$filename" "$model_url"
  else
    echo "❌ Ошибка: curl или wget не найдены"
    exit 1
  fi
  
  if [ $? -eq 0 ]; then
    echo "✅ $filename скачан"
  else
    echo "❌ Ошибка при скачивании $filename"
    exit 1
  fi
done

echo ""
echo "🎉 Все модели успешно скачаны!"
echo "📊 Размер файлов:"
ls -lh | grep -v total | awk '{print "   ", $9, "-", $5}'
echo ""
echo "✨ Теперь редактор фотоальбома сможет распознавать лица!"
