package expo.modules.downloadprogress

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Keeps the process in the foreground so chapter downloads continue after the
 * app leaves the screen. The notification is the progress bar the user sees.
 */
class DownloadProgressService : Service() {
  private var inForeground = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    DownloadNotifications.ensureChannel(this)
    if (intent?.action == ACTION_FINISH || !DownloadProgressState.running) {
      if (!inForeground) {
        // startForeground is required even when the service is only stopping.
        startInForeground(DownloadNotifications.progress(this))
      }
      val notification = DownloadNotifications.finished(this)
      DownloadNotifications.manager(this).notify(DownloadProgressState.NOTIFICATION_ID, notification)
      detachNotification()
      stopSelf()
      return START_NOT_STICKY
    }

    startInForeground(DownloadNotifications.progress(this))
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    detachNotification()
    super.onDestroy()
  }

  private fun startInForeground(notification: android.app.Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        DownloadProgressState.NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
      )
    } else {
      startForeground(DownloadProgressState.NOTIFICATION_ID, notification)
    }
    inForeground = true
  }

  private fun detachNotification() {
    if (!inForeground) return
    inForeground = false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_DETACH)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(false)
    }
  }

  companion object {
    const val ACTION_FINISH = "expo.modules.downloadprogress.FINISH"
  }
}
