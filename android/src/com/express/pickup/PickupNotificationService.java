package com.express.pickup;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import java.util.HashMap;
import java.util.Map;

/** Captures express pickup notifications (WeChat, SMS, Cainiao, HiveBox, etc.) locally on-device. */
public final class PickupNotificationService extends NotificationListenerService {
    private static final Map<String, String> KNOWN_PACKAGES = new HashMap<String, String>();

    static {
        KNOWN_PACKAGES.put("com.tencent.mm", "微信");
        KNOWN_PACKAGES.put("com.eg.android.AlipayGphone", "支付宝");
        KNOWN_PACKAGES.put("com.android.mms", "短信");
        KNOWN_PACKAGES.put("com.coloros.mms", "短信");
        KNOWN_PACKAGES.put("com.oplus.mms", "短信");
        KNOWN_PACKAGES.put("com.oppo.mms", "短信");
        KNOWN_PACKAGES.put("com.oneplus.mms", "短信");
        KNOWN_PACKAGES.put("com.google.android.apps.messaging", "短信");
        KNOWN_PACKAGES.put("com.miui.mms", "短信");
        KNOWN_PACKAGES.put("com.huawei.message", "短信");
        KNOWN_PACKAGES.put("com.hihonor.mms", "短信");
        KNOWN_PACKAGES.put("com.hihonor.message", "短信");
        KNOWN_PACKAGES.put("com.vivo.message", "短信");
        KNOWN_PACKAGES.put("com.meizu.mms", "短信");
        KNOWN_PACKAGES.put("com.samsung.android.messaging", "短信");
        KNOWN_PACKAGES.put("com.cainiao.wireless", "菜鸟");
        KNOWN_PACKAGES.put("com.taobao.taobao", "淘宝");
        KNOWN_PACKAGES.put("com.xunmeng.pinduoduo", "拼多多");
        KNOWN_PACKAGES.put("com.jingdong.app.mall", "京东");
        KNOWN_PACKAGES.put("com.sf.activity", "顺丰");
        KNOWN_PACKAGES.put("com.fcbox.hivebox", "丰巢");
        KNOWN_PACKAGES.put("com.zto.tuxi", "兔喜");
        KNOWN_PACKAGES.put("com.kingdee.kuaidi100", "快递100");
    }

    public static boolean isAccessGranted(Context context) {
        if (context == null) return false;
        try {
            String flat = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
            if (TextUtils.isEmpty(flat)) return false;
            ComponentName target = new ComponentName(context.getApplicationContext(), PickupNotificationService.class);
            String[] names = flat.split(":");
            for (String name : names) {
                if (TextUtils.isEmpty(name)) continue;
                ComponentName cn = ComponentName.unflattenFromString(name);
                if (cn != null && target.equals(cn)) return true;
            }
        } catch (Throwable ignored) {
            return false;
        }
        return false;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null) return;
            if (!PickupMessageStore.isNotifyCaptureEnabled(this)) return;
            String pkg = sbn.getPackageName();
            if (TextUtils.isEmpty(pkg) || getPackageName().equals(pkg)) return;
            if (sbn.isOngoing()) return;

            Notification notification = sbn.getNotification();
            if (notification == null) return;
            if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

            Bundle extras = notification.extras;
            if (extras == null) return;

            String title = charSeqToString(extras.getCharSequence(Notification.EXTRA_TITLE));
            String body = buildNotificationBody(extras);
            if (TextUtils.isEmpty(body) && TextUtils.isEmpty(title)) return;

            String combined = TextUtils.isEmpty(title) ? body : (title + "\n" + body);
            String knownApp = KNOWN_PACKAGES.get(pkg);
            boolean accepted = knownApp != null
                    ? PickupMessageStore.looksLikePickupMessage(combined)
                    : PickupMessageStore.hasStrongPickupKeyword(combined);
            if (!accepted) return;

            String appLabel = knownApp != null ? knownApp : "通知";
            long postTime = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
            PickupMessageStore.enqueue(this, "notification", appLabel, title, body, postTime);
        } catch (Throwable ignored) {
            // Never crash notification listener on malformed OEM payloads.
        }
    }

    private static String buildNotificationBody(Bundle extras) {
        StringBuilder sb = new StringBuilder();
        appendUniqueLine(sb, charSeqToString(extras.getCharSequence(Notification.EXTRA_BIG_TEXT)));
        appendUniqueLine(sb, charSeqToString(extras.getCharSequence(Notification.EXTRA_TEXT)));
        appendUniqueLine(sb, charSeqToString(extras.getCharSequence(Notification.EXTRA_SUB_TEXT)));
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null) {
            for (CharSequence line : lines) {
                appendUniqueLine(sb, charSeqToString(line));
            }
        }
        return sb.toString().trim();
    }

    private static void appendUniqueLine(StringBuilder sb, String line) {
        if (TextUtils.isEmpty(line)) return;
        String trimmed = line.trim();
        if (trimmed.isEmpty()) return;
        if (sb.indexOf(trimmed) >= 0) return;
        if (sb.length() > 0) sb.append('\n');
        sb.append(trimmed);
    }

    private static String charSeqToString(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }
}
