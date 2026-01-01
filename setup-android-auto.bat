@echo off
chcp 65001 >nul
echo ========================================
echo Автоматическая настройка Android проекта
echo ========================================
echo.

echo [Шаг 1/3] Сборка веб-версии...
call npm run build
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось собрать веб-версию
    pause
    exit /b 1
)
echo [OK] Веб-версия собрана
echo.

echo [Шаг 2/3] Создание Android проекта...
if not exist "android" (
    call npx cap add android
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось создать Android проект
        pause
        exit /b 1
    )
    echo [OK] Android проект создан
) else (
    echo [OK] Android проект уже существует
)
echo.

echo [Шаг 3/3] Синхронизация...
call npx cap sync android
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось синхронизировать
    pause
    exit /b 1
)
echo [OK] Синхронизация завершена
echo.

echo ========================================
echo [ГОТОВО!] Теперь вручную:
echo ========================================
echo.
echo 1. Скопируй файлы:
echo    android-plugin\CameraAccessPlugin.kt
echo    в android\app\src\main\java\ru\fotomix\plugins\
echo.
echo 2. Скопируй содержимое:
echo    android-setup\MainActivity.kt
echo    в android\app\src\main\java\ru\fotomix\app\MainActivity.kt
echo.
echo 3. Добавь разрешения из:
echo    android-setup\AndroidManifest-permissions.xml
echo    в android\app\src\main\AndroidManifest.xml
echo.
echo 4. Открой Android Studio:
echo    npx cap open android
echo.
echo 5. Собери APK:
echo    Build -^> Build Bundle(s) / APK(s) -^> Build APK(s)
echo.
echo Подробнее в SETUP_ANDROID_SIMPLE.md
echo.
pause
