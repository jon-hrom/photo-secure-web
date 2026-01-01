#!/bin/bash

# Скрипт автоматической сборки Android приложения Foto-Mix

set -e  # Прерывать при ошибках

echo "🚀 Сборка Android приложения Foto-Mix"
echo "========================================"

# Шаг 1: Проверка окружения
echo ""
echo "📋 Шаг 1: Проверка окружения..."

if ! command -v bun &> /dev/null; then
    echo "❌ Ошибка: Bun не установлен"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo "❌ Ошибка: Node.js не установлен"
    exit 1
fi

echo "✅ Окружение готово"

# Шаг 2: Сборка веб-версии
echo ""
echo "🔨 Шаг 2: Сборка веб-версии..."
bun run build

if [ ! -d "dist" ]; then
    echo "❌ Ошибка: папка dist не создана"
    exit 1
fi

echo "✅ Веб-версия собрана"

# Шаг 3: Инициализация Android (если еще не создан)
echo ""
echo "📱 Шаг 3: Инициализация Android..."

if [ ! -d "android" ]; then
    echo "Создание Android проекта..."
    npx cap add android
    echo "✅ Android проект создан"
else
    echo "✅ Android проект уже существует"
fi

# Шаг 4: Синхронизация
echo ""
echo "🔄 Шаг 4: Синхронизация с Android..."
npx cap sync android
echo "✅ Синхронизация завершена"

# Шаг 5: Интеграция плагина (если нужно)
echo ""
echo "🔌 Шаг 5: Проверка плагина..."

PLUGIN_DIR="android/app/src/main/java/ru/fotomix/plugins"
PLUGIN_FILE="$PLUGIN_DIR/CameraAccessPlugin.kt"

if [ ! -f "$PLUGIN_FILE" ]; then
    echo "⚠️  Плагин не найден, копирую..."
    mkdir -p "$PLUGIN_DIR"
    cp android-plugin/CameraAccessPlugin.kt "$PLUGIN_FILE"
    echo "✅ Плагин скопирован"
    echo "⚠️  ВАЖНО: Необходимо вручную зарегистрировать плагин в MainActivity.kt"
    echo "   См. инструкцию в ANDROID_BUILD.md"
else
    echo "✅ Плагин уже установлен"
fi

# Шаг 6: Информация для следующих шагов
echo ""
echo "========================================"
echo "✅ Подготовка завершена!"
echo ""
echo "📱 Следующие шаги:"
echo ""
echo "1️⃣  Откройте проект в Android Studio:"
echo "   npx cap open android"
echo ""
echo "2️⃣  Проверьте MainActivity.kt:"
echo "   android/app/src/main/java/ru/fotomix/app/MainActivity.kt"
echo "   Должна быть регистрация CameraAccessPlugin"
echo ""
echo "3️⃣  Соберите APK:"
echo "   Build → Build Bundle(s) / APK(s) → Build APK(s)"
echo ""
echo "4️⃣  Или через командную строку:"
echo "   cd android && ./gradlew assembleDebug"
echo ""
echo "📦 APK будет здесь:"
echo "   android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "🚀 Удачи!"
