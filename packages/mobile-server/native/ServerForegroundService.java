package com.campusbite.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

/**
 * CampusBITE Foreground Service — keeps Node server alive with screen off
 * Steps after `npx expo prebuild`:
 *   1. Copy this file to android/app/src/main/java/com/campusbite/app/ServerForegroundService.java
 *   2. Add to android/app/src/main/AndroidManifest.xml inside <application>:
 *      <service android:name=".ServerForegroundService" android:foregroundServiceType="dataSync" android:exported="false" />
 *   3. Add permissions outside <application>:
 *      <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
 *      <uses-permission android:name="android.permission.WAKE_LOCK" />
 *      <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
 */
public class ServerForegroundService extends Service {
    private static final String CHANNEL_ID = "CampusBITEChannel";
    private static final int NOTIFICATION_ID = 1;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CampusBITE::WakeLock");
        wakeLock.acquire();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("CampusBITE Server Active")
                .setContentText("Listening on 192.168.43.1:3000 — Hotspot ON")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setOngoing(true)
                .build();
        startForeground(NOTIFICATION_ID, notification);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "CampusBITE Server", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Keeps canteen server alive");
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(ch);
        }
    }
}
