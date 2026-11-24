package com.express.pickup;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/** Purely local SharedPreferences store for captured notifications, shares, and auto-import settings. */
public final class PickupMessageStore {
    private static final String PREFS_NAME = "pickup_auto_import";
    private static final String KEY_PENDING = "pending_messages";
    private static final String KEY_RECENT_HASHES = "recent_hashes";
    private static final String KEY_SMS_AUTO_SYNC = "sms_auto_sync";
    private static final String KEY_SMS_SCAN_DAYS = "sms_scan_days";
    private static final String KEY_NOTIFY_ENABLED = "notify_enabled";
    private static final String KEY_NOTIFY_COUNT = "notify_captured_count";
    private static final String KEY_LAST_SMS_TS = "last_sms_sync_ts";
    private static final String KEY_LAST_NOTIFY_TS = "last_notify_ts";
    private static final String KEY_SMS_IGNORE_BEFORE = "sms_ignore_before_ts";
    private static final int MAX_PENDING = 80;
    private static final int MAX_HASHES = 120;

    private static final String[] STRONG_KEYWORDS = new String[] {
            "取件码", "提货码", "取货码", "开箱码", "取件密码", "提货密码", "取货密码",
            "凭码", "货架号", "提件码", "自提码"
    };

    private static final String[] EXPRESS_KEYWORDS = new String[] {
            "取件码", "提货码", "取货码", "开箱码", "取件密码", "提货密码", "取货密码",
            "凭码", "货架号", "提件码", "自提码", "快递柜", "智能柜", "驿站", "菜鸟",
            "丰巢", "蜂巢", "兔喜", "易递通", "妈妈驿站", "熊猫快收", "驿收发", "溪鸟",
            "蓝店", "小兵驿站", "速递易", "格格货栈", "快递超市", "代收点", "快件",
            "包裹", "快递已到", "已到站", "已入库", "已入柜", "已存放", "已存放在",
            "已放入", "待取件", "待领取", "已签收", "签收成功", "已取件", "取件成功",
            "已取出", "已出站", "已出库", "已领取", "领取成功"
    };

    private static final String[] STRONG_STATION_KEYWORDS = new String[] {
            "取件码", "提货码", "取货码", "开箱码", "取件密码", "凭码", "货架号",
            "易递通", "菜鸟驿站", "丰巢", "蜂巢", "兔喜", "妈妈驿站", "熊猫快收", "驿收发", "快递柜"
    };

    private static final String[] OTP_KEYWORDS = new String[] {
            "验证码", "校验码", "动态码", "动态密码", "登录密码", "支付密码",
            "交易密码", "安全码", "授权码", "切勿泄露", "请勿向他人泄露", "非本人操作"
    };

    public interface OnPendingChangedListener {
        void onPendingChanged();
    }

    private static volatile OnPendingChangedListener listener;

    private PickupMessageStore() {}

    public static void setListener(OnPendingChangedListener newListener) {
        listener = newListener;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static boolean containsAny(String text, String[] keywords) {
        for (String kw : keywords) {
            if (text.contains(kw)) return true;
        }
        return false;
    }

    public static boolean hasStrongPickupKeyword(String text) {
        if (text == null || text.isEmpty() || !containsDigit(text)) return false;
        if (containsAny(text, STRONG_KEYWORDS)) return true;
        return containsAny(text, STRONG_STATION_KEYWORDS) && !containsAny(text, OTP_KEYWORDS);
    }

    public static boolean looksLikePickupMessage(String text) {
        if (text == null || text.isEmpty() || !containsDigit(text)) return false;
        if (containsAny(text, STRONG_KEYWORDS)) return true;
        return containsAny(text, EXPRESS_KEYWORDS) && !containsAny(text, OTP_KEYWORDS);
    }

    public static int clampSmsScanDays(int days) {
        return (days == 1 || days == 3 || days == 7 || days == 14) ? days : 7;
    }

    private static boolean containsDigit(String text) {
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if ((c >= '0' && c <= '9') || (c >= '\uFF10' && c <= '\uFF19')) return true;
        }
        return false;
    }

    public static synchronized boolean enqueue(
            Context context,
            String source,
            String app,
            String title,
            String text,
            long timestamp) {
        if (context == null || text == null || text.trim().isEmpty()) return false;
        String safeTitle = title == null ? "" : title.trim();
        String safeText = text.trim();
        String safeApp = app == null ? "" : app.trim();
        String safeSource = source == null ? "notification" : source;
        long ts = timestamp > 0 ? timestamp : System.currentTimeMillis();

        SharedPreferences sp = prefs(context);
        String signature = safeSource + "|" + safeTitle + "|" + safeText;
        if (!"share".equals(safeSource) && isRecentDuplicate(sp, signature)) {
            return false;
        }

        try {
            JSONArray pending = new JSONArray(sp.getString(KEY_PENDING, "[]"));
            JSONObject item = new JSONObject();
            item.put("source", safeSource);
            item.put("app", safeApp);
            item.put("title", safeTitle);
            item.put("text", safeText);
            item.put("timestamp", ts);
            pending.put(item);

            if (pending.length() > MAX_PENDING) {
                JSONArray trimmed = new JSONArray();
                for (int i = pending.length() - MAX_PENDING; i < pending.length(); i++) {
                    trimmed.put(pending.get(i));
                }
                pending = trimmed;
            }

            SharedPreferences.Editor editor = sp.edit().putString(KEY_PENDING, pending.toString());
            if (!"share".equals(safeSource)) {
                recordRecentHash(sp, editor, signature);
            }
            if ("notification".equals(safeSource)) {
                editor.putInt(KEY_NOTIFY_COUNT, sp.getInt(KEY_NOTIFY_COUNT, 0) + 1);
                editor.putLong(KEY_LAST_NOTIFY_TS, ts);
            }
            editor.apply();
        } catch (Exception e) {
            return false;
        }

        OnPendingChangedListener currentListener = listener;
        if (currentListener != null) {
            currentListener.onPendingChanged();
        }
        return true;
    }

    private static boolean isRecentDuplicate(SharedPreferences sp, String signature) {
        try {
            String hash = Integer.toHexString(signature.hashCode()) + "_" + signature.length();
            JSONArray hashes = new JSONArray(sp.getString(KEY_RECENT_HASHES, "[]"));
            for (int i = 0; i < hashes.length(); i++) {
                if (hash.equals(hashes.optString(i))) return true;
            }
        } catch (Exception ignored) {
            return false;
        }
        return false;
    }

    private static void recordRecentHash(SharedPreferences sp, SharedPreferences.Editor editor, String signature) {
        try {
            String hash = Integer.toHexString(signature.hashCode()) + "_" + signature.length();
            JSONArray hashes = new JSONArray(sp.getString(KEY_RECENT_HASHES, "[]"));
            hashes.put(hash);
            if (hashes.length() > MAX_HASHES) {
                JSONArray trimmed = new JSONArray();
                for (int i = hashes.length() - MAX_HASHES; i < hashes.length(); i++) {
                    trimmed.put(hashes.get(i));
                }
                hashes = trimmed;
            }
            editor.putString(KEY_RECENT_HASHES, hashes.toString());
        } catch (Exception ignored) {
            // Ignore hash cache error.
        }
    }

    public static synchronized String drainPendingJson(Context context) {
        SharedPreferences sp = prefs(context);
        String raw = sp.getString(KEY_PENDING, "[]");
        if (!"[]".equals(raw)) {
            sp.edit().putString(KEY_PENDING, "[]").apply();
        }
        return raw;
    }

    public static synchronized int getPendingCount(Context context) {
        try {
            return new JSONArray(prefs(context).getString(KEY_PENDING, "[]")).length();
        } catch (Exception e) {
            return 0;
        }
    }

    public static boolean isSmsAutoSyncEnabled(Context context) {
        return prefs(context).getBoolean(KEY_SMS_AUTO_SYNC, true);
    }

    public static void setSmsAutoSyncEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_SMS_AUTO_SYNC, enabled).apply();
    }

    public static int getSmsScanDays(Context context) {
        return clampSmsScanDays(prefs(context).getInt(KEY_SMS_SCAN_DAYS, 7));
    }

    public static void setSmsScanDays(Context context, int days) {
        prefs(context).edit().putInt(KEY_SMS_SCAN_DAYS, clampSmsScanDays(days)).apply();
    }

    public static boolean isNotifyCaptureEnabled(Context context) {
        return prefs(context).getBoolean(KEY_NOTIFY_ENABLED, true);
    }

    public static void setNotifyCaptureEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_NOTIFY_ENABLED, enabled).apply();
    }

    public static int getNotifyCapturedCount(Context context) {
        return prefs(context).getInt(KEY_NOTIFY_COUNT, 0);
    }

    public static long getLastSmsSyncTs(Context context) {
        return prefs(context).getLong(KEY_LAST_SMS_TS, 0L);
    }

    public static void setLastSmsSyncTs(Context context, long ts) {
        prefs(context).edit().putLong(KEY_LAST_SMS_TS, ts).apply();
    }

    public static long getLastNotifyTs(Context context) {
        return prefs(context).getLong(KEY_LAST_NOTIFY_TS, 0L);
    }

    public static long getSmsIgnoreBeforeTs(Context context) {
        return prefs(context).getLong(KEY_SMS_IGNORE_BEFORE, 0L);
    }

    public static void setSmsIgnoreBeforeTs(Context context, long ts) {
        prefs(context).edit().putLong(KEY_SMS_IGNORE_BEFORE, Math.max(0L, ts)).apply();
    }
}
