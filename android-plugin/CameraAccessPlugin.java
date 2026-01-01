package ru.fotomix.plugins;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import android.database.Cursor;
import android.provider.OpenableColumns;
import java.io.InputStream;

@CapacitorPlugin(
    name = "CameraAccess",
    permissions = {
        @Permission(strings = {Manifest.permission.READ_EXTERNAL_STORAGE}, alias = "storage")
    }
)
public class CameraAccessPlugin extends Plugin {

    private PluginCall pendingCall;
    
    @PluginMethod
    public void pickFiles(PluginCall call) {
        if (!hasRequiredPermissions()) {
            requestAllPermissions(call, "permissionCallback");
            return;
        }

        pendingCall = call;

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        
        String[] mimeTypes = {
            "image/*",
            "video/*",
            "image/x-adobe-dng",
            "image/x-canon-cr2",
            "image/x-nikon-nef",
            "image/x-sony-arw"
        };
        intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, 
                DocumentsContract.buildRootUri("com.android.externalstorage.documents", "primary"));
        }

        startActivityForResult(call, intent, "handleFilesSelected");
    }

    @PluginMethod
    public void permissionCallback(PluginCall call) {
        if (hasRequiredPermissions()) {
            pickFiles(call);
        } else {
            call.reject("Разрешение на доступ к файлам отклонено");
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        if (pendingCall == null) return;
        PluginCall call = pendingCall;
        pendingCall = null;

        if (resultCode != Activity.RESULT_OK || data == null) {
            call.reject("Выбор файлов отменён");
            return;
        }

        try {
            JSArray files = new JSArray();

            if (data.getData() != null) {
                files.put(processFileUri(data.getData()));
            }

            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                for (int i = 0; i < count; i++) {
                    Uri uri = data.getClipData().getItemAt(i).getUri();
                    files.put(processFileUri(uri));
                }
            }

            JSObject result = new JSObject();
            result.put("files", files);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Ошибка обработки файлов: " + e.getMessage(), e);
        }
    }

    private JSObject processFileUri(Uri uri) throws Exception {
        JSObject fileInfo = new JSObject();

        Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null);
        if (cursor != null) {
            try {
                if (cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                    
                    if (nameIndex != -1) {
                        fileInfo.put("name", cursor.getString(nameIndex));
                    }
                    if (sizeIndex != -1) {
                        fileInfo.put("size", cursor.getLong(sizeIndex));
                    }
                }
            } finally {
                cursor.close();
            }
        }

        String mimeType = getContext().getContentResolver().getType(uri);
        fileInfo.put("type", mimeType != null ? mimeType : "application/octet-stream");
        fileInfo.put("uri", uri.toString());

        try {
            InputStream inputStream = getContext().getContentResolver().openInputStream(uri);
            if (inputStream != null) {
                try {
                    byte[] bytes = new byte[inputStream.available()];
                    inputStream.read(bytes);
                    String base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
                    fileInfo.put("data", base64);
                } finally {
                    inputStream.close();
                }
            }
        } catch (Exception e) {
            fileInfo.put("error", "Не удалось прочитать файл: " + e.getMessage());
        }

        return fileInfo;
    }

    private boolean hasRequiredPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return true;
        }
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.READ_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED;
    }
}
