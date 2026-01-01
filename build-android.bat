@echo off
chcp 65001 >nul
REM Скрипт автоматической сборки Android приложения Foto-Mix для Windows

echo [Сборка Android приложения Foto-Mix]
echo ========================================

REM Шаг 1: Проверка окружения
echo.
echo [Шаг 1: Проверка окружения...]

where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] Ошибка: Bun не установлен
    exit /b 1
)

where npx >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] Ошибка: Node.js не установлен
    exit /b 1
)

echo [OK] Окружение готово

REM Шаг 2: Сборка веб-версии
echo.
echo [Шаг 2: Сборка веб-версии...]
call bun run build

if not exist "dist" (
    echo [X] Ошибка: папка dist не создана
    exit /b 1
)

echo [OK] Веб-версия собрана

REM Шаг 3: Инициализация Android
echo.
echo [Шаг 3: Инициализация Android...]

if not exist "android" (
    echo Создание Android проекта...
    call npx cap add android
    echo [OK] Android проект создан
) else (
    echo [OK] Android проект уже существует
)

REM Шаг 4: Синхронизация
echo.
echo [Шаг 4: Синхронизация с Android...]
call npx cap sync android
echo [OK] Синхронизация завершена

REM Шаг 5: Интеграция плагина
echo.
echo [Шаг 5: Проверка плагина...]

set PLUGIN_DIR=android\app\src\main\java\ru\fotomix\plugins
set PLUGIN_FILE=%PLUGIN_DIR%\CameraAccessPlugin.kt

if not exist "%PLUGIN_FILE%" (
    echo [!] Плагин не найден, копирую...
    if not exist "%PLUGIN_DIR%" mkdir "%PLUGIN_DIR%"
    copy android-plugin\CameraAccessPlugin.kt "%PLUGIN_FILE%"
    echo [OK] Плагин скопирован
    echo [!] ВАЖНО: Необходимо вручную зарегистрировать плагин в MainActivity.kt
    echo     См. инструкцию в ANDROID_BUILD.md
) else (
    echo [OK] Плагин уже установлен
)

REM Информация
echo.
echo ========================================
echo [OK] Подготовка завершена!
echo.
echo [Следующие шаги:]
echo.
echo 1. Откройте проект в Android Studio:
echo    npx cap open android
echo.
echo 2. Проверьте MainActivity.kt:
echo    android\app\src\main\java\ru\fotomix\app\MainActivity.kt
echo    Должна быть регистрация CameraAccessPlugin
echo.
echo 3. Соберите APK:
echo    Build -^> Build Bundle(s) / APK(s) -^> Build APK(s)
echo.
echo 4. Или через командную строку:
echo    cd android ^&^& gradlew assembleDebug
echo.
echo APK будет здесь:
echo    android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Удачи!
pause