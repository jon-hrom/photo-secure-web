package ru.fotomix.plugins

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.io.InputStream

@CapacitorPlugin(
    name = "CameraAccess",
    permissions = [
        Permission(
            strings = [Manifest.permission.READ_EXTERNAL_STORAGE],
            alias = "storage"
        )
    ]
)
class CameraAccessPlugin : Plugin() {

    private var pendingCall: PluginCall? = null
    
    /**
     * Открывает системный picker для выбора множественных файлов
     * Поддерживает выбор с MTP устройств (камеры) на Android
     */
    @PluginMethod
    fun pickFiles(call: PluginCall) {
        // Проверка разрешений
        if (!hasRequiredPermissions()) {
            requestAllPermissions(call, "permissionCallback")
            return
        }

        pendingCall = call

        // Запускаем системный file picker с поддержкой множественного выбора
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            
            // Поддержка множественных типов файлов
            val mimeTypes = arrayOf(
                "image/*",
                "video/*",
                "image/x-adobe-dng",
                "image/x-canon-cr2",
                "image/x-nikon-nef",
                "image/x-sony-arw"
            )
            putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
            
            // КРИТИЧНО: включаем множественный выбор
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            
            // Разрешаем доступ к внешним устройствам
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                putExtra(DocumentsContract.EXTRA_INITIAL_URI, DocumentsContract.buildRootUri(
                    "com.android.externalstorage.documents", "primary"
                ))
            }
        }

        startActivityForResult(call, intent, "handleFilesSelected")
    }

    @PluginMethod
    fun permissionCallback(call: PluginCall) {
        if (hasRequiredPermissions()) {
            pickFiles(call)
        } else {
            call.reject("Разрешение на доступ к файлам отклонено")
        }
    }

    /**
     * Обработка результата выбора файлов
     */
    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)

        val call = pendingCall ?: return
        pendingCall = null

        if (resultCode != Activity.RESULT_OK || data == null) {
            call.reject("Выбор файлов отменён")
            return
        }

        try {
            val files = JSArray()

            // Обработка одного файла
            data.data?.let { uri ->
                files.put(processFileUri(uri))
            }

            // Обработка множественных файлов
            data.clipData?.let { clipData ->
                for (i in 0 until clipData.itemCount) {
                    val uri = clipData.getItemAt(i).uri
                    files.put(processFileUri(uri))
                }
            }

            val result = JSObject()
            result.put("files", files)
            call.resolve(result)

        } catch (e: Exception) {
            call.reject("Ошибка обработки файлов: ${e.message}", e)
        }
    }

    /**
     * Извлечение информации о файле из URI
     */
    private fun processFileUri(uri: Uri): JSObject {
        val fileInfo = JSObject()
        val contentResolver = context.contentResolver

        // Получаем имя файла
        val cursor = contentResolver.query(uri, null, null, null, null)
        cursor?.use {
            if (it.moveToFirst()) {
                val nameIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                val sizeIndex = it.getColumnIndex(android.provider.OpenableColumns.SIZE)
                
                if (nameIndex != -1) {
                    fileInfo.put("name", it.getString(nameIndex))
                }
                if (sizeIndex != -1) {
                    fileInfo.put("size", it.getLong(sizeIndex))
                }
            }
        }

        // Получаем MIME тип
        val mimeType = contentResolver.getType(uri)
        fileInfo.put("type", mimeType ?: "application/octet-stream")

        // Сохраняем URI для последующего чтения
        fileInfo.put("uri", uri.toString())

        // Читаем содержимое файла и конвертируем в base64
        try {
            val inputStream: InputStream? = contentResolver.openInputStream(uri)
            inputStream?.use { stream ->
                val bytes = stream.readBytes()
                val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                fileInfo.put("data", base64)
            }
        } catch (e: Exception) {
            fileInfo.put("error", "Не удалось прочитать файл: ${e.message}")
        }

        return fileInfo
    }

    /**
     * Проверка необходимых разрешений
     */
    private fun hasRequiredPermissions(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ не требует READ_EXTERNAL_STORAGE для ACTION_OPEN_DOCUMENT
            true
        } else {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }
    }
}
