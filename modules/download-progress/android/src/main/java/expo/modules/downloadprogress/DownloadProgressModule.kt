package expo.modules.downloadprogress

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DownloadProgressModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DownloadProgress")

    Function("start") { title: String, text: String, current: Int, max: Int ->
      publish(title, text, current, max, success = true, running = true)
      try {
        DownloadNotifications.ensureChannel(context)
        val intent = Intent(context, DownloadProgressService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        true
      } catch (_: Exception) {
        DownloadProgressState.running = false
        false
      }
    }

    Function("update") { title: String, text: String, current: Int, max: Int ->
      if (DownloadProgressState.running) {
        publish(title, text, current, max, success = true, running = true)
        DownloadNotifications.ensureChannel(context)
        DownloadNotifications.manager(context).notify(
          DownloadProgressState.NOTIFICATION_ID,
          DownloadNotifications.progress(context),
        )
      }
    }

    AsyncFunction("exchange") {
        url: String,
        method: String,
        headersJson: String,
        body: String?,
        timeoutMs: Double,
        redirect: String,
        promise: Promise ->
      DownloadExchange.start(url, method, headersJson, body, timeoutMs, redirect, promise)
    }

    Function("finish") { title: String, text: String, success: Boolean ->
      publish(title, text, DownloadProgressState.current, DownloadProgressState.max, success, running = false)
      try {
        val intent = Intent(context, DownloadProgressService::class.java).setAction(DownloadProgressService.ACTION_FINISH)
        context.startService(intent)
      } catch (_: Exception) {
        DownloadNotifications.manager(context).notify(
          DownloadProgressState.NOTIFICATION_ID,
          DownloadNotifications.finished(context),
        )
      }
    }
  }

  private val context
    get() = requireNotNull(appContext.reactContext)

  private fun publish(title: String, text: String, current: Int, max: Int, success: Boolean, running: Boolean) {
    DownloadProgressState.title = title
    DownloadProgressState.text = text
    DownloadProgressState.current = current
    DownloadProgressState.max = max
    DownloadProgressState.success = success
    DownloadProgressState.running = running
  }
}
