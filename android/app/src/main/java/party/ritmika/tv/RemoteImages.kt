package party.ritmika.tv

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import android.widget.ImageView
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Cargador mínimo de imágenes remotas para el shell nativo. */
object RemoteImages {
    private const val BASE = "https://ritmika.duckdns.org"
    private val executor = Executors.newFixedThreadPool(3)
    private val main = Handler(Looper.getMainLooper())
    private val cache = object : LruCache<String, Bitmap>(24 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount
    }

    fun load(imageView: ImageView, path: String) {
        if (path.isBlank()) return
        val url = if (path.startsWith("http")) path else BASE + path
        imageView.tag = url
        val cached = cache.get(url)
        if (cached != null) {
            imageView.setImageBitmap(cached)
            return
        }
        executor.execute {
            var connection: HttpURLConnection? = null
            try {
                connection = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 8000
                    readTimeout = 12000
                    instanceFollowRedirects = true
                }
                val bitmap = connection.inputStream.use { BitmapFactory.decodeStream(it) }
                if (bitmap != null) {
                    cache.put(url, bitmap)
                    main.post {
                        if (imageView.tag == url) imageView.setImageBitmap(bitmap)
                    }
                }
            } catch (_: Exception) {
            } finally {
                connection?.disconnect()
            }
        }
    }

    fun bitmapFromDataUrl(dataUrl: String?): Bitmap? {
        if (dataUrl.isNullOrBlank()) return null
        return try {
            val comma = dataUrl.indexOf(',')
            val payload = if (comma >= 0) dataUrl.substring(comma + 1) else dataUrl
            val bytes = android.util.Base64.decode(payload, android.util.Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        }
    }
}
