package com.masterdocs.reader;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
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
import java.io.FileOutputStream;
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

    private File getVaultSandboxDir() {
        File dir = new File(getContext().getFilesDir(), "secure_vault");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        File nomedia = new File(dir, ".nomedia");
        if (!nomedia.exists()) {
            try {
                nomedia.createNewFile();
            } catch (IOException ignored) {
                // ignore
            }
        }
        return dir;
    }

    private String sanitizeId(String raw) {
        if (raw == null || raw.isEmpty()) {
            return "doc_" + System.currentTimeMillis();
        }
        return raw.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

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

    /**
     * Moves a file from public internal storage into the app-private sandboxed
     * secure_vault directory and deletes the public copy so system file managers
     * and media scanners can no longer see or open it.
     */
    @PluginMethod
    public void hideFileInVaultStorage(PluginCall call) {
        String path = call.getString("path");
        String vaultId = call.getString("vaultId");
        if (path == null || path.isEmpty()) {
            call.reject("Missing path");
            return;
        }

        File src = new File(path);
        if (!src.exists() || !src.isFile() || !src.canRead()) {
            call.reject("Source file not readable: " + path);
            return;
        }

        getBridge().execute(() -> {
            File vaultDir = getVaultSandboxDir();
            File dest = new File(vaultDir, sanitizeId(vaultId) + ".vlt");

            try (FileInputStream fis = new FileInputStream(src);
                 FileOutputStream fos = new FileOutputStream(dest)) {
                byte[] buf = new byte[32768];
                int len;
                while ((len = fis.read(buf)) != -1) {
                    fos.write(buf, 0, len);
                }
                fos.flush();
            } catch (IOException e) {
                call.reject("Failed copying file into private Vault sandbox", e);
                return;
            }

            boolean deletedOriginal = src.delete();
            try {
                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[] { src.getAbsolutePath() },
                    null,
                    null
                );
            } catch (Exception ignored) {
                // ignore
            }

            JSObject ret = new JSObject();
            ret.put("hidden", true);
            ret.put("deletedOriginal", deletedOriginal);
            ret.put("vaultFilePath", dest.getAbsolutePath());
            call.resolve(ret);
        });
    }

    /**
     * Stores base64 bytes of any document imported into Vault inside app-private
     * sandboxed storage (/files/secure_vault/<id>.vlt), invisible outside the app.
     */
    @PluginMethod
    public void savePrivateBytesToVault(PluginCall call) {
        String base64 = call.getString("base64");
        String vaultId = call.getString("vaultId");
        if (base64 == null) {
            call.reject("Missing base64 data");
            return;
        }

        getBridge().execute(() -> {
            try {
                byte[] decoded = Base64.decode(base64, Base64.DEFAULT);
                File vaultDir = getVaultSandboxDir();
                File dest = new File(vaultDir, sanitizeId(vaultId) + ".vlt");
                try (FileOutputStream fos = new FileOutputStream(dest)) {
                    fos.write(decoded);
                    fos.flush();
                }
                JSObject ret = new JSObject();
                ret.put("vaultFilePath", dest.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed writing Vault sandbox file", e);
            }
        });
    }

    /**
     * Restores a hidden Vault sandbox file back to its original public path
     * when the user explicitly removes it from Secure Vault back to Home.
     */
    @PluginMethod
    public void restoreVaultFileToStorage(PluginCall call) {
        String vaultFilePath = call.getString("vaultFilePath");
        String originalPath = call.getString("originalPath");
        if (vaultFilePath == null || originalPath == null || vaultFilePath.isEmpty() || originalPath.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("restored", false);
            call.resolve(ret);
            return;
        }

        File src = new File(vaultFilePath);
        File dest = new File(originalPath);
        if (!src.exists()) {
            JSObject ret = new JSObject();
            ret.put("restored", false);
            call.resolve(ret);
            return;
        }

        getBridge().execute(() -> {
            boolean restored = false;
            try {
                File parent = dest.getParentFile();
                if (parent != null && !parent.exists()) {
                    parent.mkdirs();
                }
                try (FileInputStream fis = new FileInputStream(src);
                     FileOutputStream fos = new FileOutputStream(dest)) {
                    byte[] buf = new byte[32768];
                    int len;
                    while ((len = fis.read(buf)) != -1) {
                        fos.write(buf, 0, len);
                    }
                    fos.flush();
                }
                src.delete();
                restored = true;
                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[] { dest.getAbsolutePath() },
                    null,
                    null
                );
            } catch (Exception e) {
                restored = false;
            }

            JSObject ret = new JSObject();
            ret.put("restored", restored);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void deleteVaultSandboxFile(PluginCall call) {
        String vaultFilePath = call.getString("vaultFilePath");
        boolean deleted = false;
        if (vaultFilePath != null && !vaultFilePath.isEmpty()) {
            File f = new File(vaultFilePath);
            if (f.exists()) {
                deleted = f.delete();
            }
        }
        JSObject ret = new JSObject();
        ret.put("deleted", deleted);
        call.resolve(ret);
    }

    /**
     * Launches installed Indian UPI payment apps using standard NPCI upi://pay intent
     * without revealing any phone number or using browser popups.
     */
    @PluginMethod
    public void openUpiPayment(PluginCall call) {
        String upiUri = call.getString("upiUri");
        if (upiUri == null || !upiUri.startsWith("upi://")) {
            call.reject("Invalid UPI payment URI");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(upiUri));
            Intent chooser = Intent.createChooser(intent, "Pay with UPI App");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("launched", true);
            call.resolve(ret);
        } catch (Exception ex) {
            JSObject ret = new JSObject();
            ret.put("launched", false);
            ret.put("error", "No UPI app installed on this device.");
            call.resolve(ret);
        }
    }
}
