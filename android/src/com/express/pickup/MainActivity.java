package com.express.pickup;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Insets;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.provider.Telephony;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.util.Locale;

import org.json.JSONArray;
import org.json.JSONObject;

/** Loads only packaged assets. No internet permission is requested. */
public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int SMS_PERMISSION_REQUEST = 1002;
    private static final long AUTO_SMS_COOLDOWN_MS = 15000L;
    private static final int MAX_SMS_ROWS = 300;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private volatile boolean webReady = false;
    private volatile boolean smsScanRunning = false;
    private int pendingSmsScanDays = 7;
    private long lastAutoSmsRunMs = 0L;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final FrameLayout container = new FrameLayout(this);
        container.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        container.setBackgroundColor(Color.WHITE);
        container.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                if (Build.VERSION.SDK_INT >= 30) {
                    Insets bars = insets.getInsets(
                            WindowInsets.Type.systemBars()
                                    | WindowInsets.Type.displayCutout()
                                    | WindowInsets.Type.ime());
                    v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                    return WindowInsets.CONSUMED;
                }
                v.setPadding(
                        insets.getSystemWindowInsetLeft(),
                        insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(),
                        insets.getSystemWindowInsetBottom());
                return insets.consumeSystemWindowInsets();
            }
        });

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(Color.WHITE);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        if (Build.VERSION.SDK_INT >= 33) {
            settings.setAlgorithmicDarkeningAllowed(false);
        } else if (Build.VERSION.SDK_INT >= 29) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) return false;
                String url = request.getUrl().toString();
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    openExternalUri(url, true);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                webReady = true;
                notifyStatusChanged();
                dispatchPendingMessages();
                if (hasWindowFocus()) {
                    maybeRunAutoSmsSync();
                    evalJs("window.onAndroidAppFocused && window.onAndroidAppFocused()");
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                String[] actions = new String[] { Intent.ACTION_GET_CONTENT, Intent.ACTION_OPEN_DOCUMENT };
                for (String action : actions) {
                    try {
                        Intent intent = new Intent(action);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType("image/*");
                        startActivityForResult(Intent.createChooser(intent, "选择条码截图"), FILE_CHOOSER_REQUEST);
                        return true;
                    } catch (Throwable ignored) {
                        // Try fallback picker action on restricted OEM ROMs.
                    }
                }
                filePathCallback = null;
                return false;
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidApp");
        container.addView(webView);
        setContentView(container);
        configureSystemBars();
        container.requestApplyInsets();
        handleIncomingIntent(getIntent());
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl("file:///android_asset/index.html");
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        PickupMessageStore.setListener(new PickupMessageStore.OnPendingChangedListener() {
            @Override
            public void onPendingChanged() {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        notifyStatusChanged();
                        dispatchPendingMessages();
                    }
                });
            }
        });
        if (webReady) {
            notifyStatusChanged();
            dispatchPendingMessages();
        }
    }

    @Override
    protected void onPause() {
        PickupMessageStore.setListener(null);
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && webReady && !isFinishing() && !isDestroyed()) {
            notifyStatusChanged();
            dispatchPendingMessages();
            maybeRunAutoSmsSync();
            evalJs("window.onAndroidAppFocused && window.onAndroidAppFocused()");
        }
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String mime = intent.getType();
        if (Intent.ACTION_SEND.equals(intent.getAction()) && mime != null && mime.startsWith("text/")) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            intent.removeExtra(Intent.EXTRA_TEXT);
            intent.removeExtra(Intent.EXTRA_SUBJECT);
            if (sharedText != null && !sharedText.trim().isEmpty()) {
                PickupMessageStore.enqueue(
                        this,
                        "share",
                        "分享",
                        sharedSubject != null ? sharedSubject : "",
                        sharedText,
                        System.currentTimeMillis());
                if (webReady) {
                    dispatchPendingMessages();
                }
            }
        }
    }

    private void configureSystemBars() {
        Window window = getWindow();
        if (window == null) return;
        final View decorView = window.getDecorView();
        if (decorView == null) return;
        decorView.setBackgroundColor(Color.WHITE);
        if (Build.VERSION.SDK_INT < 35) {
            window.setStatusBarColor(Color.WHITE);
            window.setNavigationBarColor(Color.WHITE);
        }
        applyLightSystemBars(decorView);
        decorView.post(new Runnable() {
            @Override
            public void run() {
                if (!isFinishing() && !isDestroyed()) {
                    applyLightSystemBars(decorView);
                }
            }
        });
    }

    private void applyLightSystemBars(View decorView) {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = decorView.getWindowInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(mask, mask);
            }
        } else {
            int flags = decorView.getSystemUiVisibility()
                    | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                    | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            decorView.setSystemUiVisibility(flags);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == SMS_PERMISSION_REQUEST) {
            boolean granted = grantResults != null
                    && grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            notifyStatusChanged();
            if (granted) {
                scanSmsAsync(pendingSmsScanDays, false);
            } else {
                boolean canAskAgain = shouldShowRequestPermissionRationale(Manifest.permission.READ_SMS);
                evalJs("window.onAndroidSmsPermissionDenied && window.onAndroidSmsPermissionDenied(" + canAskAgain + ")");
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            if (results == null && resultCode == RESULT_OK && data != null) {
                if (data.getData() != null) {
                    results = new Uri[] { data.getData() };
                } else if (data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                    Uri first = data.getClipData().getItemAt(0).getUri();
                    if (first != null) results = new Uri[] { first };
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : false", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled) && !isFinishing() && !isDestroyed()) {
                    MainActivity.super.onBackPressed();
                }
            }
        });
    }

    @Override
    protected void onDestroy() {
        PickupMessageStore.setListener(null);
        webReady = false;
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private boolean hasSmsPermission() {
        return checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    private void maybeRunAutoSmsSync() {
        if (!hasSmsPermission()) return;
        if (!PickupMessageStore.isSmsAutoSyncEnabled(this)) return;
        long now = System.currentTimeMillis();
        if (now - lastAutoSmsRunMs < AUTO_SMS_COOLDOWN_MS) return;
        lastAutoSmsRunMs = now;
        scanSmsAsync(PickupMessageStore.getSmsScanDays(this), true);
    }

    private void scanSmsAsync(final int days, final boolean silent) {
        if (!hasSmsPermission()) return;
        if (smsScanRunning) return;
        smsScanRunning = true;
        final Context appContext = getApplicationContext();
        final int safeDays = PickupMessageStore.clampSmsScanDays(days);
        new Thread(new Runnable() {
            @Override
            public void run() {
                JSONArray records = new JSONArray();
                String errorMsg = "";
                Cursor cursor = null;
                try {
                    long daysCutoff = System.currentTimeMillis() - (safeDays * 86400000L);
                    long ignoreBefore = PickupMessageStore.getSmsIgnoreBeforeTs(appContext);
                    long cutoff = Math.max(daysCutoff, ignoreBefore);
                    String[] projection = new String[] {
                            Telephony.Sms.ADDRESS,
                            Telephony.Sms.BODY,
                            Telephony.Sms.DATE
                    };
                    cursor = appContext.getContentResolver().query(
                            Telephony.Sms.Inbox.CONTENT_URI,
                            projection,
                            Telephony.Sms.DATE + " >= ?",
                            new String[] { String.valueOf(cutoff) },
                            Telephony.Sms.DATE + " DESC");
                    if (cursor != null) {
                        int addressCol = cursor.getColumnIndex(Telephony.Sms.ADDRESS);
                        int bodyCol = cursor.getColumnIndex(Telephony.Sms.BODY);
                        int dateCol = cursor.getColumnIndex(Telephony.Sms.DATE);
                        int count = 0;
                        while (cursor.moveToNext() && count < MAX_SMS_ROWS) {
                            count++;
                            String body = bodyCol >= 0 ? cursor.getString(bodyCol) : null;
                            if (!PickupMessageStore.looksLikePickupMessage(body)) continue;
                            JSONObject item = new JSONObject();
                            item.put("source", "sms");
                            item.put("address", addressCol >= 0 ? cursor.getString(addressCol) : "");
                            item.put("body", body);
                            item.put("date", dateCol >= 0 ? cursor.getLong(dateCol) : System.currentTimeMillis());
                            records.put(item);
                        }
                    }
                    PickupMessageStore.setLastSmsSyncTs(appContext, System.currentTimeMillis());
                } catch (SecurityException se) {
                    errorMsg = "未获取短信读取权限，请在系统应用权限中开启读取短信";
                } catch (Throwable t) {
                    errorMsg = "短信扫描失败，请稍后重试";
                } finally {
                    if (cursor != null) {
                        try { cursor.close(); } catch (Throwable ignored) {}
                    }
                    smsScanRunning = false;
                }
                final String payload = records.toString();
                final String finalError = errorMsg;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        notifyStatusChanged();
                        evalJs("window.onAndroidSmsScanResult && window.onAndroidSmsScanResult("
                                + JSONObject.quote(payload) + ", "
                                + silent + ", "
                                + JSONObject.quote(finalError) + ")");
                    }
                });
            }
        }, "sms-pickup-scan").start();
    }

    private String buildStatusJson() {
        JSONObject status = new JSONObject();
        try {
            status.put("isAndroid", true);
            status.put("hasSmsPermission", hasSmsPermission());
            status.put("smsAutoSync", PickupMessageStore.isSmsAutoSyncEnabled(this));
            status.put("smsScanDays", PickupMessageStore.getSmsScanDays(this));
            status.put("hasNotificationAccess", PickupNotificationService.isAccessGranted(this));
            status.put("notifyEnabled", PickupMessageStore.isNotifyCaptureEnabled(this));
            status.put("notifyCapturedCount", PickupMessageStore.getNotifyCapturedCount(this));
            status.put("pendingCount", PickupMessageStore.getPendingCount(this));
            status.put("lastSmsSyncTs", PickupMessageStore.getLastSmsSyncTs(this));
            status.put("lastNotifyTs", PickupMessageStore.getLastNotifyTs(this));
            status.put("smsIgnoreBeforeTs", PickupMessageStore.getSmsIgnoreBeforeTs(this));
        } catch (Exception ignored) {
            // Return partial JSON on error.
        }
        return status.toString();
    }

    private void notifyStatusChanged() {
        if (!webReady || isFinishing() || isDestroyed()) return;
        evalJs("window.onAndroidAutoImportStatus && window.onAndroidAutoImportStatus(" + JSONObject.quote(buildStatusJson()) + ")");
    }

    private void dispatchPendingMessages() {
        if (!webReady || isFinishing() || isDestroyed()) return;
        String pendingJson = PickupMessageStore.drainPendingJson(this);
        if ("[]".equals(pendingJson)) return;
        evalJs("window.onAndroidIncomingMessages && window.onAndroidIncomingMessages(" + JSONObject.quote(pendingJson) + ")");
    }

    private void evalJs(final String script) {
        if (webView == null || !webReady || isFinishing() || isDestroyed()) return;
        webView.evaluateJavascript(script, null);
    }

    private void openAppDetailsSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Throwable ignored) {
            try {
                Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(fallback);
            } catch (Throwable ignoredFallback) {
                // Ignore if settings activity is unavailable.
            }
        }
    }

    private void runOnUi(final Runnable task) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (!isFinishing() && !isDestroyed()) task.run();
            }
        });
    }

    private void notifyStatusAsync() {
        runOnUi(new Runnable() {
            @Override
            public void run() {
                notifyStatusChanged();
            }
        });
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public void copyText(final String text) {
            runOnUi(new Runnable() {
                @Override
                public void run() {
                    ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    if (clipboard != null) {
                        clipboard.setPrimaryClip(ClipData.newPlainText("快递取件", text));
                    }
                }
            });
        }

        @JavascriptInterface
        public void setScanMode(final boolean active) {
            runOnUi(new Runnable() {
                @Override
                public void run() {
                    Window window = getWindow();
                    if (window == null) return;
                    WindowManager.LayoutParams lp = window.getAttributes();
                    lp.screenBrightness = active ? 1.0f : WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
                    window.setAttributes(lp);
                    if (active) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }

        @JavascriptInterface
        public String getAutoImportStatus() {
            return buildStatusJson();
        }

        @JavascriptInterface
        public String drainPendingMessages() {
            return PickupMessageStore.drainPendingJson(MainActivity.this);
        }

        @JavascriptInterface
        public void requestSmsScan(final int days, final boolean silent) {
            runOnUi(new Runnable() {
                @Override
                public void run() {
                    int safeDays = PickupMessageStore.clampSmsScanDays(days);
                    pendingSmsScanDays = safeDays;
                    PickupMessageStore.setSmsScanDays(MainActivity.this, safeDays);
                    if (hasSmsPermission()) {
                        scanSmsAsync(safeDays, silent);
                    } else if (!silent) {
                        requestPermissions(new String[] { Manifest.permission.READ_SMS }, SMS_PERMISSION_REQUEST);
                    }
                }
            });
        }

        @JavascriptInterface
        public void setSmsAutoSync(final boolean enabled) {
            PickupMessageStore.setSmsAutoSyncEnabled(MainActivity.this, enabled);
            notifyStatusAsync();
        }

        @JavascriptInterface
        public void setSmsScanDays(final int days) {
            PickupMessageStore.setSmsScanDays(MainActivity.this, days);
            notifyStatusAsync();
        }

        @JavascriptInterface
        public void setSmsIgnoreBeforeNow() {
            PickupMessageStore.setSmsIgnoreBeforeTs(MainActivity.this, System.currentTimeMillis());
            notifyStatusAsync();
        }

        @JavascriptInterface
        public void clearSmsIgnoreBefore() {
            PickupMessageStore.setSmsIgnoreBeforeTs(MainActivity.this, 0L);
            notifyStatusAsync();
        }

        @JavascriptInterface
        public void setNotifyCaptureEnabled(final boolean enabled) {
            PickupMessageStore.setNotifyCaptureEnabled(MainActivity.this, enabled);
            notifyStatusAsync();
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            runOnUi(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Throwable t) {
                        openAppDetailsSettings();
                    }
                }
            });
        }

        @JavascriptInterface
        public void openAppSettings() {
            runOnUi(new Runnable() {
                @Override
                public void run() {
                    openAppDetailsSettings();
                }
            });
        }

        @JavascriptInterface
        public void requestClipboardCheck(final boolean explicit) {
            runOnUi(new Runnable() {
                @Override
                public void run() {
                    String text = "";
                    try {
                        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                        if (clipboard != null && clipboard.hasPrimaryClip()) {
                            ClipData clip = clipboard.getPrimaryClip();
                            if (clip != null && clip.getItemCount() > 0) {
                                CharSequence cs = clip.getItemAt(0).coerceToText(MainActivity.this);
                                if (cs != null) {
                                    String raw = cs.toString().trim();
                                    if (raw.length() <= 4000) text = raw;
                                }
                            }
                        }
                    } catch (Throwable ignored) {
                        text = "";
                    }
                    evalJs("window.onAndroidClipboardText && window.onAndroidClipboardText("
                            + JSONObject.quote(text) + ", " + explicit + ")");
                }
            });
        }

        @JavascriptInterface
        public boolean openApp(final String uri) {
            return openExternalUri(uri, false);
        }

        @JavascriptInterface
        public boolean openWeb(final String url) {
            return openExternalUri(url, true);
        }
    }

    private boolean openExternalUri(String rawUri, boolean httpOnly) {
        if (rawUri == null) return false;
        String trimmed = rawUri.trim();
        if (trimmed.isEmpty()) return false;
        try {
            Uri parsed = Uri.parse(trimmed);
            String scheme = parsed.getScheme();
            if (scheme == null || scheme.isEmpty()) return false;
            String lower = scheme.toLowerCase(Locale.ROOT);
            if ("javascript".equals(lower) || "file".equals(lower)
                    || "content".equals(lower) || "data".equals(lower)
                    || "android-app".equals(lower)) {
                return false;
            }
            if (httpOnly && !"http".equals(lower) && !"https".equals(lower)) {
                return false;
            }
            Intent intent = new Intent(Intent.ACTION_VIEW, parsed);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (intent.resolveActivity(getPackageManager()) != null) {
                startActivity(intent);
                return true;
            }
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException | SecurityException ignored) {
            return false;
        } catch (Throwable ignored) {
            return false;
        }
    }
}
