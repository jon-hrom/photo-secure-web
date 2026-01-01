# Сборка Android приложения FotoMix

## Предварительные требования

1. **Node.js** и **Bun** уже установлены ✅
2. **Android Studio** - скачать с https://developer.android.com/studio
3. **Java JDK 17** - обычно устанавливается с Android Studio

## Шаг 1: Инициализация Capacitor

```bash
# Инициализация Capacitor (если еще не сделано)
npx cap init

# Или вручную через capacitor.config.ts (уже создан)
```

## Шаг 2: Сборка веб-версии

```bash
# Собираем production билд
bun run build
```

## Шаг 3: Добавление Android платформы

```bash
# Добавляем Android проект
npx cap add android

# Копируем веб-ресурсы и плагины
npx cap sync android
```

## Шаг 4: Интеграция нативного плагина

После `cap add android` будет создана папка `/android`. Нужно:

1. Создать файл плагина:
```
android/app/src/main/java/ru/fotomix/plugins/CameraAccessPlugin.kt
```

2. Скопировать туда код из `/android-plugin/CameraAccessPlugin.kt`

3. Зарегистрировать плагин в `MainActivity.kt`:
```kotlin
package ru.fotomix.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import ru.fotomix.plugins.CameraAccessPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(CameraAccessPlugin::class.java)
    }
}
```

## Шаг 5: Настройка разрешений в AndroidManifest.xml

Добавить в `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" 
    android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
```

## Шаг 6: Открытие проекта в Android Studio

```bash
# Открываем проект в Android Studio
npx cap open android
```

Или вручную: `File → Open → выбрать папку /android`

## Шаг 7: Сборка APK

### Вариант A: Через Android Studio (рекомендуется для первого раза)

1. Дождаться окончания индексации Gradle
2. `Build → Build Bundle(s) / APK(s) → Build APK(s)`
3. APK будет в `android/app/build/outputs/apk/debug/app-debug.apk`

### Вариант B: Через командную строку

```bash
cd android
./gradlew assembleDebug

# APK будет в android/app/build/outputs/apk/debug/app-debug.apk
```

## Шаг 8: Тестирование на телефоне

### USB подключение:
1. Включить "Режим разработчика" на Android
2. Включить "Отладка по USB"
3. Подключить телефон к компьютеру
4. В Android Studio: `Run → Run 'app'`

### Установка APK напрямую:
1. Скопировать `app-debug.apk` на телефон
2. Открыть файл → разрешить установку из неизвестных источников
3. Установить

## Шаг 9: Сборка для публикации (Release)

### Создание подписи (keystore):

```bash
keytool -genkey -v -keystore fotomix-release.keystore -alias fotomix -keyalg RSA -keysize 2048 -validity 10000
```

Сохранить пароли в надежном месте!

### Настройка подписи в `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('../fotomix-release.keystore')
            storePassword 'ВАШ_ПАРОЛЬ'
            keyAlias 'fotomix'
            keyPassword 'ВАШ_ПАРОЛЬ'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### Сборка Release APK:

```bash
cd android
./gradlew assembleRelease

# Готовый APK: android/app/build/outputs/apk/release/app-release.apk
```

## Публикация в RuStore

1. Зарегистрироваться на https://console.rustore.ru
2. Создать новое приложение
3. Заполнить информацию:
   - Название: **FotoMix** (или другое)
   - Описание: **Фотобанк для фотографов - загрузка с камеры одним касанием**
   - Категория: **Фотография**
   - Возрастной рейтинг: **3+**
4. Загрузить `app-release.apk`
5. Добавить скриншоты (минимум 2)
6. Добавить иконку 512x512px
7. Отправить на модерацию

## Обновление приложения

После изменений в коде:

```bash
# 1. Пересобрать веб-версию
bun run build

# 2. Синхронизировать с Android
npx cap sync android

# 3. Пересобрать APK
cd android && ./gradlew assembleRelease
```

## Troubleshooting

### Ошибка "SDK not found"
- Открыть Android Studio → Settings → Android SDK
- Установить Android SDK 34 (или последнюю версию)

### Ошибка Gradle
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Плагин не найден
- Проверить регистрацию в `MainActivity.kt`
- Проверить путь к файлу плагина
- Выполнить `npx cap sync android`

## Полезные команды

```bash
# Обновить Capacitor
npm install @capacitor/cli@latest @capacitor/core@latest @capacitor/android@latest

# Проверить конфигурацию
npx cap doctor

# Посмотреть логи Android
npx cap run android -l

# Удалить и пересоздать Android проект
rm -rf android
npx cap add android
npx cap sync android
```

---

**Вопросы?** Пиши в чат, помогу на любом этапе! 🚀
