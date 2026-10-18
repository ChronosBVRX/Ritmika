package party.ritmika.tv

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * Rítmika TV — host Android TV híbrido.
 *
 * UI/juego: WebView (reutiliza tv.html + js/ del servidor).
 * Video: ExoPlayer nativo (Media3) por decodificación de hardware.
 * El shim JS (assets/ritmika_shim.js) emula HTMLMediaElement sobre ExoPlayer.
 */
@UnstableApi
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var playerView: PlayerView
    private lateinit var player: ExoPlayer

    private var lastWidth = 0
    private var lastHeight = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }

        player = ExoPlayer.Builder(this).build().apply {
            playWhenReady = false
            repeatMode = Player.REPEAT_MODE_OFF
            volume = 1f
            addListener(playerListener)
        }

        playerView = PlayerView(this).apply {
            useController = false
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            setShutterBackgroundColor(Color.TRANSPARENT)
            player = this@MainActivity.player
            visibility = View.INVISIBLE
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.TRANSPARENT)
            overScrollMode = View.OVER_SCROLL_NEVER
            isFocusable = true
            isFocusableInTouchMode = true

            // Un WebView transparente cae a render por software si no se le
            // fuerza una capa de hardware. Es la causa principal de que las
            // animaciones se vean lentas y cortadas en el televisor.
            setLayerType(View.LAYER_TYPE_HARDWARE, null)

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = false
                allowContentAccess = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                cacheMode = WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                javaScriptCanOpenWindowsAutomatically = true
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    safeBrowsingEnabled = false
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    offscreenPreRaster = true
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(cm: ConsoleMessage): Boolean {
                    Log.d(TAG, "JS ${cm.message()} @${cm.sourceId()}:${cm.lineNumber()}")
                    return true
                }
            }

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String?) {
                    injectAsset("ritmika_bootstrap.js", "bootstrap")
                    injectShim()
                }
            }

            addJavascriptInterface(Bridge(), "AndroidNative")
        }

        // PlayerView detrás, WebView encima (el "hueco" transparente deja ver el video nativo).
        root.addView(playerView)
        root.addView(webView)
        setContentView(root)

        applyDocumentStartScript()
        webView.loadUrl(BASE_URL)
        webView.requestFocus()

        UpdateManager.checkOnLaunch(this)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    override fun onDestroy() {
        try {
            player.release()
        } catch (_: Exception) {
        }
        super.onDestroy()
    }

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
    }

    private fun injectAsset(name: String, label: String) {
        try {
            val js = assets.open(name).bufferedReader().use { it.readText() }
            webView.evaluateJavascript("(function(){$js})();", null)
            Log.i(TAG, "$label injected")
        } catch (e: Exception) {
            Log.e(TAG, "$label inject failed", e)
        }
    }

    private fun injectShim() {
        injectAsset("ritmika_shim.js", "media shim")
    }

    /**
     * Registra el bootstrap como script de "document start": corre antes de los
     * scripts de tv.html y por tanto antes de que bootloader.js arranque su
     * canvas. Si la versión de WebView no lo soporta, se inyecta en
     * onPageFinished (modo ligero llega un poco más tarde, pero llega).
     */
    private fun applyDocumentStartScript() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Log.i(TAG, "DOCUMENT_START_SCRIPT no soportado; bootstrap via onPageFinished")
            return
        }
        val script = try {
            assets.open("ritmika_bootstrap.js").bufferedReader().use { it.readText() }
        } catch (e: Exception) {
            Log.e(TAG, "bootstrap asset missing", e)
            return
        }
        val candidates = listOf(setOf("*"), setOf(BASE_URL))
        for (rules in candidates) {
            try {
                WebViewCompat.addDocumentStartJavaScript(webView, script, rules)
                Log.i(TAG, "bootstrap registered as document start script ($rules)")
                return
            } catch (e: Exception) {
                Log.w(TAG, "addDocumentStartJavaScript rechazo $rules", e)
            }
        }
        Log.w(TAG, "document start no disponible; bootstrap via onPageFinished")
    }

    private fun emit(type: String, dataJson: String) {
        val js = "window.__ritmikaTVEvent&&window.__ritmikaTVEvent('$type',$dataJson);"
        runOnUiThread {
            if (::webView.isInitialized) webView.evaluateJavascript(js, null)
        }
    }

    private fun showVideo() {
        runOnUiThread { playerView.visibility = View.VISIBLE }
    }

    private fun hideVideo() {
        runOnUiThread { playerView.visibility = View.INVISIBLE }
    }

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
            when (state) {
                Player.STATE_READY -> {
                    val d = player.duration
                    val seconds = if (d > 0 && d != C.TIME_UNSET) d / 1000.0 else 0.0
                    emit(
                        "ready",
                        "{\"duration\":$seconds,\"width\":$lastWidth,\"height\":$lastHeight}"
                    )
                }
                Player.STATE_ENDED -> {
                    emit("ended", "{}")
                    hideVideo()
                }
                else -> {}
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (isPlaying) {
                showVideo()
                emit("playing", "{}")
            }
        }

        override fun onVideoSizeChanged(videoSize: VideoSize) {
            lastWidth = videoSize.width
            lastHeight = videoSize.height
        }

        override fun onPlayerError(error: PlaybackException) {
            Log.e(TAG, "ExoPlayer error: ${error.errorCodeName}", error)
            emit("error", "{}")
            hideVideo()
        }
    }

    // ── Puente Kotlin ↔ JS (métodos invocados desde el shim) ──────────
    inner class Bridge {
        @JavascriptInterface
        fun isAvailable(): Boolean = true

        @JavascriptInterface
        fun setSource(url: String?) {
            if (url.isNullOrBlank()) return
            runOnUiThread {
                try {
                    lastWidth = 0
                    lastHeight = 0
                    player.setMediaItem(MediaItem.fromUri(url))
                    player.prepare()
                } catch (e: Exception) {
                    Log.e(TAG, "setSource failed", e)
                }
            }
        }

        @JavascriptInterface
        fun play() {
            runOnUiThread {
                try {
                    if (player.mediaItemCount > 0) {
                        player.playWhenReady = true
                        showVideo()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "play failed", e)
                }
            }
        }

        @JavascriptInterface
        fun pause() {
            runOnUiThread {
                try {
                    player.playWhenReady = false
                } catch (_: Exception) {
                }
                hideVideo()
            }
        }

        @JavascriptInterface
        fun stop() {
            runOnUiThread {
                try {
                    player.stop()
                    player.clearMediaItems()
                } catch (_: Exception) {
                }
                hideVideo()
            }
        }

        @JavascriptInterface
        fun setMuted(muted: Boolean) {
            runOnUiThread {
                try {
                    player.volume = if (muted) 0f else 1f
                } catch (_: Exception) {
                }
            }
        }
    }

    // ── D-pad / gamepad / media keys → KeyboardEvent en la página ─────
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val jsKey = mapKey(event.keyCode)
        if (jsKey == null) return super.dispatchKeyEvent(event)

        if (event.action == KeyEvent.ACTION_DOWN) {
            forwardKey(jsKey)
        }
        return true
    }

    private fun mapKey(keyCode: Int): String? = when (keyCode) {
        KeyEvent.KEYCODE_DPAD_UP -> "ArrowUp"
        KeyEvent.KEYCODE_DPAD_DOWN -> "ArrowDown"
        KeyEvent.KEYCODE_DPAD_LEFT -> "ArrowLeft"
        KeyEvent.KEYCODE_DPAD_RIGHT -> "ArrowRight"
        KeyEvent.KEYCODE_DPAD_CENTER,
        KeyEvent.KEYCODE_ENTER,
        KeyEvent.KEYCODE_NUMPAD_ENTER,
        KeyEvent.KEYCODE_BUTTON_A,
        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
        KeyEvent.KEYCODE_MEDIA_PLAY,
        KeyEvent.KEYCODE_MEDIA_PAUSE,
        KeyEvent.KEYCODE_MEDIA_NEXT -> "Enter"
        KeyEvent.KEYCODE_SPACE -> " "
        KeyEvent.KEYCODE_BUTTON_B -> "Escape"
        else -> null
    }

    private fun forwardKey(key: String) {
        val quoted = "\"" + key.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
        val js = "(function(){var e=new KeyboardEvent('keydown',{key:$quoted,bubbles:true,cancelable:true});" +
            "document.dispatchEvent(e);})()"
        webView.evaluateJavascript(js, null)
    }

    companion object {
        private const val TAG = "RitmikaTV"
        const val BASE_URL = "https://ritmika.duckdns.org"
    }
}
