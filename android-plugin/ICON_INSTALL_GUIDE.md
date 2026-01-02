# Установка иконки приложения Foto-Mix

## Шаг 1: Подготовка иконок разных размеров

Исходная иконка: https://cdn.poehali.dev/files/icon.png

Нужно создать следующие размеры:
- **mipmap-mdpi**: 48x48 px
- **mipmap-hdpi**: 72x72 px  
- **mipmap-xhdpi**: 96x96 px
- **mipmap-xxhdpi**: 144x144 px
- **mipmap-xxxhdpi**: 192x192 px

## Шаг 2: Автоматическая генерация через онлайн-инструмент

### Рекомендуемый способ: Android Asset Studio

1. Открой: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html
2. Загрузи файл: `C:\foto-mix.ru\foto-mix-android\android-plugin\icon.png`
3. Настрой параметры:
   - Name: `ic_launcher`
   - Shape: None (чтобы сохранить круглую форму)
   - Background: Transparent
4. Нажми "Download"
5. Распакуй ZIP-архив

## Шаг 3: Размещение иконок в проект

Скопируй содержимое папок из архива в:

```
C:\foto-mix.ru\foto-mix-android\android\app\src\main\res\
```

Структура должна получиться такой:

```
android/app/src/main/res/
├── mipmap-hdpi/
│   ├── ic_launcher.png (72x72)
│   └── ic_launcher_round.png
├── mipmap-mdpi/
│   ├── ic_launcher.png (48x48)
│   └── ic_launcher_round.png
├── mipmap-xhdpi/
│   ├── ic_launcher.png (96x96)
│   └── ic_launcher_round.png
├── mipmap-xxhdpi/
│   ├── ic_launcher.png (144x144)
│   └── ic_launcher_round.png
└── mipmap-xxxhdpi/
    ├── ic_launcher.png (192x192)
    └── ic_launcher_round.png
```

## Шаг 4: Альтернативный способ (вручную)

Если не хочешь использовать онлайн-инструмент, можно использовать Photoshop/GIMP:

1. Открой `icon.png`
2. Измени размер до нужного (см. список выше)
3. Экспортируй как PNG
4. Сохрани как `ic_launcher.png` в соответствующую папку mipmap

## Шаг 5: Пересборка приложения

После размещения иконок:

1. В Android Studio: **Build → Clean Project**
2. Затем: **Build → Rebuild Project**
3. Запусти: **Build → Generate App Bundles or APKs → Generate APKs**

Готово! Новая иконка появится в приложении.

---

## Быстрый скрипт для создания всех размеров (если есть ImageMagick)

```bash
cd C:\foto-mix.ru\foto-mix-android\android-plugin
magick icon.png -resize 48x48 ic_launcher_mdpi.png
magick icon.png -resize 72x72 ic_launcher_hdpi.png
magick icon.png -resize 96x96 ic_launcher_xhdpi.png
magick icon.png -resize 144x144 ic_launcher_xxhdpi.png
magick icon.png -resize 192x192 ic_launcher_xxxhdpi.png
```
