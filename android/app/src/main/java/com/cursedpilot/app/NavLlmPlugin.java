package com.cursedpilot.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * NavYeo's language model on the phone. The model file (a GGUF, about 400 MB for Qwen2.5 0.5B Instruct) is chosen once from the phone's storage and copied into
 * the app's private folder, so it works with no network; it is then loaded into memory when the voice assistant needs it.
 */
@CapacitorPlugin(name = "NavLlm")
public class NavLlmPlugin extends Plugin {
    private static final String FILE = "navyeo-llm.gguf";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private long handle = 0;

    private File modelFile() {
        File dir = new File(getContext().getFilesDir(), "models");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, FILE);
    }

    private static long mb(long bytes) { return Math.round(bytes / 1048576.0); }

    @PluginMethod
    public void status(PluginCall call) {
        File f = modelFile();
        JSObject r = new JSObject();
        r.put("installed", f.exists());
        r.put("sizeMb", f.exists() ? mb(f.length()) : 0);
        r.put("loaded", handle != 0);
        call.resolve(r);
    }

    /** Opens the phone's file picker; the chosen GGUF is copied into the app. */
    @PluginMethod
    public void importModel(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(call, intent, "importPicked");
    }

    @ActivityCallback
    private void importPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("No file was chosen.");
            return;
        }
        final Uri uri = result.getData().getData();
        worker.execute(() -> {
            File part = new File(modelFile().getPath() + ".part");
            try {
                long total = -1;
                try (Cursor c = getContext().getContentResolver().query(uri, null, null, null, null)) {
                    if (c != null && c.moveToFirst()) {
                        int i = c.getColumnIndex(OpenableColumns.SIZE);
                        if (i >= 0 && !c.isNull(i)) total = c.getLong(i);
                    }
                }
                try (InputStream in = getContext().getContentResolver().openInputStream(uri); OutputStream out = new FileOutputStream(part)) {
                    if (in == null) throw new RuntimeException("That file could not be opened.");
                    byte[] buf = new byte[1 << 20];
                    long done = 0; int lastPercent = -1; int n; boolean first = true;
                    while ((n = in.read(buf)) > 0) {
                        if (first) {   // a GGUF begins with the letters GGUF
                            if (n < 4 || buf[0] != 'G' || buf[1] != 'G' || buf[2] != 'U' || buf[3] != 'F') throw new RuntimeException("That is not a GGUF model file.");
                            first = false;
                        }
                        out.write(buf, 0, n);
                        done += n;
                        int percent = total > 0 ? (int) (done * 100 / total) : -1;
                        if (percent != lastPercent) { lastPercent = percent; JSObject p = new JSObject(); p.put("percent", percent); p.put("doneMb", mb(done)); notifyListeners("importProgress", p); }
                    }
                    if (first) throw new RuntimeException("That file is empty.");
                }
                unloadNow();
                File dest = modelFile();
                //noinspection ResultOfMethodCallIgnored
                dest.delete();
                if (!part.renameTo(dest)) throw new RuntimeException("The model could not be saved.");
                JSObject r = new JSObject();
                r.put("sizeMb", mb(dest.length()));
                call.resolve(r);
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                part.delete();
                call.reject(e.getMessage() != null ? e.getMessage() : "The model could not be copied.");
            }
        });
    }

    @PluginMethod
    public void load(PluginCall call) {
        worker.execute(() -> {
            try {
                if (handle == 0) {
                    File f = modelFile();
                    if (!f.exists()) throw new RuntimeException("No model is installed yet.");
                    int threads = Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors() / 2));
                    handle = NavLlmNative.load(f.getPath(), threads, getContext().getApplicationInfo().nativeLibraryDir);
                }
                JSObject r = new JSObject();
                r.put("loaded", true);
                call.resolve(r);
            } catch (Throwable e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "The model could not be loaded.");
            }
        });
    }

    @PluginMethod
    public void complete(PluginCall call) {
        final String system = call.getString("system", "");
        final String user = call.getString("user", "");
        final String grammar = call.getString("grammar", "");
        final int maxTokens = call.getInt("maxTokens", 120);
        final Float temperature = call.getFloat("temperature", 0f);
        worker.execute(() -> {
            try {
                if (handle == 0) throw new RuntimeException("The model is not loaded.");
                byte[] bytes = NavLlmNative.complete(handle, system, user, grammar, maxTokens, temperature == null ? 0f : temperature);
                JSObject r = new JSObject();
                r.put("text", new String(bytes, StandardCharsets.UTF_8));
                call.resolve(r);
            } catch (Throwable e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "The model could not answer.");
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (handle != 0) NavLlmNative.stop(handle);
        call.resolve();
    }

    @PluginMethod
    public void unload(PluginCall call) {
        worker.execute(() -> { unloadNow(); call.resolve(); });
    }

    @PluginMethod
    public void removeModel(PluginCall call) {
        worker.execute(() -> {
            unloadNow();
            //noinspection ResultOfMethodCallIgnored
            modelFile().delete();
            call.resolve();
        });
    }

    private void unloadNow() {
        if (handle != 0) { NavLlmNative.release(handle); handle = 0; }
    }

    @Override
    protected void handleOnDestroy() {
        unloadNow();
        worker.shutdown();
    }
}
