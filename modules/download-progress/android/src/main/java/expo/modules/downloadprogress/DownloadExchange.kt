package expo.modules.downloadprogress

import expo.modules.kotlin.Promise
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Dispatcher
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Downloads a response off the React Native fetch stack.
 *
 * RN's XMLHttpRequest base64-encodes the body and the JS thread decodes it, so a
 * pool of image requests runs one at a time. OkHttp keeps the pool parallel and
 * the bytes are copied straight into a Uint8Array.
 *
 * [AsyncFunction] runs on a single handler thread, so this method only enqueues
 * the call and returns. The shared dispatcher is what actually runs the requests.
 */
object DownloadExchange {
  private val client: OkHttpClient by lazy {
    OkHttpClient.Builder()
      .dispatcher(
        Dispatcher().apply {
          maxRequests = 64
          maxRequestsPerHost = 16
        },
      )
      .connectTimeout(20, TimeUnit.SECONDS)
      .readTimeout(30, TimeUnit.SECONDS)
      .writeTimeout(30, TimeUnit.SECONDS)
      .followRedirects(true)
      .followSslRedirects(true)
      .retryOnConnectionFailure(true)
      .build()
  }

  private val manualClient: OkHttpClient by lazy {
    client.newBuilder()
      .followRedirects(false)
      .followSslRedirects(false)
      .build()
  }

  fun start(
    url: String,
    method: String,
    headersJson: String,
    body: String?,
    timeoutMs: Double,
    redirect: String,
    promise: Promise,
  ) {
    val call = try {
      val http = if (redirect.equals("manual", ignoreCase = true)) manualClient else client
      val request = request(url, method, headers(headersJson), body)
      http.newCall(request).also { next ->
        next.timeout().timeout(timeoutMs.coerceAtLeast(1.0).toLong(), TimeUnit.MILLISECONDS)
      }
    } catch (error: Exception) {
      promise.reject("ERR_NETWORK", error.message, error)
      return
    }

    call.enqueue(object : Callback {
      override fun onFailure(call: Call, error: IOException) {
        promise.reject("ERR_NETWORK", error.message, error)
      }

      override fun onResponse(call: Call, response: Response) {
        try {
          response.use { incoming ->
            val bytes = incoming.body?.bytes() ?: ByteArray(0)
            val headerMap = LinkedHashMap<String, String>(incoming.headers.size)
            for (name in incoming.headers.names()) {
              headerMap[name.lowercase()] = incoming.headers.values(name).joinToString(", ")
            }
            promise.resolve(
              mapOf(
                "status" to incoming.code,
                "bytes" to bytes,
                "headers" to headerMap,
              ),
            )
          }
        } catch (error: Exception) {
          promise.reject("ERR_NETWORK", error.message, error)
        }
      }
    })
  }

  private fun headers(headersJson: String): Map<String, String> {
    val parsed = JSONObject(headersJson.ifBlank { "{}" })
    val headers = LinkedHashMap<String, String>(parsed.length())
    val names = parsed.keys()
    while (names.hasNext()) {
      val name = names.next()
      headers[name] = parsed.optString(name)
    }
    return headers
  }

  private fun request(url: String, method: String, headers: Map<String, String>, body: String?): Request {
    val verb = method.ifBlank { "GET" }.uppercase()
    val builder = Request.Builder().url(url)
    val payload = if (body != null && verb != "GET" && verb != "HEAD") {
      val type = headers.entries.firstOrNull { it.key.equals("Content-Type", ignoreCase = true) }?.value
      body.toRequestBody(type?.toMediaTypeOrNull())
    } else {
      null
    }
    builder.method(verb, payload)
    for ((name, value) in headers) {
      if (name.isBlank()) continue
      try {
        builder.header(name, value)
      } catch (_: IllegalArgumentException) {
        // OkHttp refuses hop-by-hop headers such as Content-Length.
      }
    }
    return builder.build()
  }
}
