# Настройка распознавания лиц для фотоальбома

## Что это дает?
Умная вёрстка фотоальбома автоматически распознает лица на фотографиях и размещает их так, чтобы лица не попадали под корешок книги (синие линии).

## Как подключить модели?

### Вариант 1: Скачать модели вручную
1. Скачайте файлы моделей с GitHub:
   - [tiny_face_detector_model-weights_manifest.json](https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-weights_manifest.json)
   - [tiny_face_detector_model-shard1](https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-shard1)
   - [face_landmark_68_model-weights_manifest.json](https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-weights_manifest.json)
   - [face_landmark_68_model-shard1](https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-shard1)

2. Поместите все 4 файла в папку `public/models/`

### Вариант 2: Команда для быстрой установки
```bash
cd public/models
curl -O https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-weights_manifest.json
curl -O https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-shard1
curl -O https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-weights_manifest.json
curl -O https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-shard1
```

## Возможности редактора

### 1. Автоматическая вёрстка
- ✅ Распознавание лиц на фото
- ✅ Умное размещение с учетом ориентации (горизонт/вертикаль)
- ✅ Защита лиц от попадания под корешок (синие линии)
- ✅ Максимальное заполнение белого поля

### 2. Направляющие и сетка
- **Желтая пунктирная линия** - безопасная зона (фото не выходят за границы)
- **Синяя толстая линия** - корешок книги
- **Синие пунктирные линии** - опасная зона для лиц (±15мм от корешка)
- **Серая сетка** - вспомогательная сетка (вкл/выкл кнопкой "Сетка")
- **Зеленые рамки** - распознанные лица на фото

### 3. Ручное редактирование
- **Перетаскивание фото** - кликните на фото и перемещайте мышью
- **Масштабирование** - выберите фото и используйте кнопки +/-
- **Кнопка "Перегенерировать"** - создать новый вариант вёрстки

### 4. Навигация
- Стрелки внизу - переключение между разворотами
- Кнопка "Далее" - перейти к финальному шагу

## Без моделей
Если модели не загружены, редактор будет работать в упрощенном режиме:
- Фото будут размещаться автоматически
- Распознавание лиц не будет работать
- Защита от корешка будет базовой (случайное размещение)
