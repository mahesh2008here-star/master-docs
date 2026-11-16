package com.masterdocs.reader;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

@CapacitorPlugin(
    name = "StorageVault",
    permissions = {
        @Permission(
            alias = "storage",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            }
        )
    }
)
public class StorageVaultPlugin extends Plugin {

    private static final int MAX_SCAN_DEPTH = 6;
    private static final int MAX_SCAN_FILES = 800;
    private static final long MAX_READ_BYTES = 80L * 1024L * 1024L;

    private static final Set<String> SUPPORTED_EXTENSIONS = new HashSet<>(Arrays.asList(
        "pdf", "doc", "docx", "odt", "rtf", "epub",
        "xls", "xlsx", "ods", "csv", "tsv",
        "ppt", "pptx", "odp",
        "txt", "md", "markdown", "log", "json", "xml", "html", "htm", "yaml", "yml"
    ));

    private boolean hasAllFilesAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return Environment.isExternalStorageManager();
        }
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.READ_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void checkAllFilesPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasAllFilesAccess());
        ret.put("sdkInt", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAllFilesPermission(PluginCall call) {
        if (hasAllFilesAccess()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("openedSettings", false);
            call.resolve(ret);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception ex) {
                try {
                    Intent fallback = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(fallback);
                } catch (Exception inner) {
                    call.reject("Unable to open Manage All Files settings screen", inner);
                    return;
                }
            }
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("openedSettings", true);
            call.resolve(ret);
        } else {
            requestPermissionForAlias("storage", call, "storagePermsCallback");
        }
    }

    @PermissionCallback
    private void storagePermsCallback(PluginCall call) {
        boolean granted = getPermissionState("storage") == PermissionState.GRANTED || hasAllFilesAccess();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("openedSettings", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void scanDeviceDocuments(PluginCall call) {
        if (!hasAllFilesAccess()) {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("files", new JSArray());
            call.resolve(ret);
            return;
        }

        getBridge().execute(() -> {
            JSArray filesArray = new JSArray();
            Set<String> seenPaths = new HashSet<>();
            File rootDir = Environment.getExternalStorageDirectory();

            SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

            if (rootDir != null && rootDir.exists() && rootDir.canRead()) {
                scanDirectory(rootDir, 0, seenPaths, filesArray, isoFormat);
            }

            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("files", filesArray);
            call.resolve(ret);
        });
    }

    private void scanDirectory(
        File dir,
        int depth,
        Set<String> seenPaths,
        JSArray out,
        SimpleDateFormat isoFormat
    ) {
        if (depth > MAX_SCAN_DEPTH || out.length() >= MAX_SCAN_FILES) {
            return;
        }
        File[] children = dir.listFiles();
        if (children == null) {
            return;
        }

        for (File child : children) {
            if (out.length() >= MAX_SCAN_FILES) {
                return;
            }
            String name = child.getName();
            if (name.startsWith(".")) {
                continue;
            }

            if (child.isDirectory()) {
                String lowerPath = child.getAbsolutePath().toLowerCase(Locale.US);
                if (
                    lowerPath.contains("/android/data") ||
                    lowerPath.contains("/android/obb") ||
                    lowerPath.contains("/android/media")
                ) {
                    continue;
                }
                scanDirectory(child, depth + 1, seenPaths, out, isoFormat);
            } else if (child.isFile() && child.canRead() && child.length() > 0) {
                int dotIdx = name.lastIndexOf('.');
                if (dotIdx <= 0 || dotIdx >= name.length() - 1) {
                    continue;
                }
                String ext = name.substring(dotIdx + 1).toLowerCase(Locale.US);
                if (!SUPPORTED_EXTENSIONS.contains(ext)) {
                    continue;
                }

                String absPath = child.getAbsolutePath();
                if (seenPaths.contains(absPath)) {
                    continue;
                }
                seenPaths.add(absPath);

                JSObject item = new JSObject();
                item.put("name", name);
                item.put("path", absPath);
                item.put("extension", ext);
                item.put("size", child.length());
                item.put("modifiedAt", isoFormat.format(new Date(child.lastModified())));
                out.put(item);
            }
        }
    }

    @PluginMethod
    public void readDeviceFileBase64(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("Missing file path");
            return;
        }

        File file = new File(path);
        if (!file.exists() || !file.isFile() || !file.canRead()) {
            call.reject("File cannot be accessed: " + path);
            return;
        }
        if (file.length() > MAX_READ_BYTES) {
            call.reject("File exceeds maximum in-memory size (80 MB)");
            return;
        }

        getBridge().execute(() -> {
            try (FileInputStream fis = new FileInputStream(file);
                 ByteArrayOutputStream bos = new ByteArrayOutputStream((int) Math.min(file.length(), 1024 * 1024))) {
                byte[] buffer = new byte[32768];
                int read;
                while ((read = fis.read(buffer)) != -1) {
                    bos.write(buffer, 0, read);
                }
                String base64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
                JSObject ret = new JSObject();
                ret.put("base64", base64);
                ret.put("size", file.length());
                call.resolve(ret);
            } catch (IOException e) {
                call.reject("Failed reading file bytes", e);
            }
        });
    }
}
