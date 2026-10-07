package expo.modules.downloadprogress

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

internal object DownloadProgressState {
  const val NOTIFICATION_ID = 4107
  const val CHANNEL_ID = "repuber-downloads"

  @Volatile var title: String = ""
  @Volatile var text: String = ""
  @Volatile var current: Int = 0
  @Volatile var max: Int = 0
  @Volatile var success: Boolean = true
  @Volatile var running: Boolean = false
}

internal object DownloadNotifications {
  private const val ACCENT = 0xFF9C4221.toInt()

  fun manager(context: Context): NotificationManager {
    return context.getSystemService(NotificationManager::class.java)
  }

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      DownloadProgressState.CHANNEL_ID,
      "Downloads",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Progress while a book is downloaded and packed into an EPUB"
      setShowBadge(false)
    }
    manager(context).createNotificationChannel(channel)
  }

  fun progress(context: Context): Notification {
    val max = DownloadProgressState.max
    val current = DownloadProgressState.current
    val indeterminate = max <= 0
    return base(context)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setAutoCancel(false)
      .setProgress(if (indeterminate) 0 else max, if (indeterminate) 0 else current.coerceIn(0, max), indeterminate)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .build()
  }

  fun finished(context: Context): Notification {
    val builder = base(context)
      .setOngoing(false)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .setProgress(0, 0, false)
    if (DownloadProgressState.success) {
      val max = DownloadProgressState.max.coerceAtLeast(1)
      builder
        .setSmallIcon(android.R.drawable.stat_sys_download_done)
        .setProgress(max, max, false)
    } else {
      builder.setSmallIcon(android.R.drawable.stat_notify_error)
    }
    return builder.build()
  }

  private fun base(context: Context): Notification.Builder {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, DownloadProgressState.CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }
    builder
      .setContentTitle(DownloadProgressState.title.ifBlank { "REPUBer" })
      .setContentText(DownloadProgressState.text)
      .setColor(ACCENT)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(launchIntent(context))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      @Suppress("DEPRECATION")
      builder.setPriority(Notification.PRIORITY_LOW)
    }
    return builder
  }

  private fun launchIntent(context: Context): PendingIntent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent()
    launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(
      context,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
