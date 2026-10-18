package party.ritmika.tv

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.DisplayMetrics
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
    private var resumeVideoOnStart = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            clipChildren = false
        }

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

        // El juego se maqueta SIEMPRE a 1920x1080 px CSS y el StageLayout lo
        // escala a la pantalla real. Así una TV de 720p, una de 1080p y una de
        // 4K ven exactamente el mismo diseño (el de la version web) en lugar de
        // uno recortado o gigante, y el raster queda acotado a 1080p aunque el
        // panel sea 4K.
        val stage = StageLayout(this).apply {
            clipChildren = false
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(tvWebViewContext()).apply {
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
                loadWithOverviewMode = false
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

        // PlayerView detrás (a pantalla completa), WebView encima dentro del
        // escenario escalado (el "hueco" transparente deja ver el video nativo).
        stage.addView(webView)
        root.addView(playerView)
        root.addView(stage)
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

    /*
     * Al salir de la app (HOME, cambio de app) el WebView seguía reproduciendo
     * audio en segundo plano (sobre todo la música de menú en bucle). Hay que
     * silenciar el media del WebView y pausar también el ExoPlayer; al volver se
     * reanuda lo que estaba sonando.
     */
    override fun onStart() {
        super.onStart()
        if (::webView.isInitialized) {
            webView.onResume()
            webView.resumeTimers()
        }
        if (resumeVideoOnStart) {
            resumeVideoOnStart = false
            runOnUiThread {
                try {
                    if (::player.isInitialized && player.mediaItemCount > 0) {
                        player.playWhenReady = true
                    }
                } catch (_: Exception) {
                }
            }
        }
    }

    override fun onStop() {
        super.onStop()
        if (::webView.isInitialized) {
            pauseWebMedia()
            webView.onPause()
            webView.pauseTimers()
        }
        try {
            if (::player.isInitialized) {
                resumeVideoOnStart = player.isPlaying
                player.playWhenReady = false
            }
        } catch (_: Exception) {
        }
    }

    override fun onDestroy() {
        try {
            player.release()
        } catch (_: Exception) {
        }
        try {
            if (::webView.isInitialized) {
                (webView.parent as? ViewGroup)?.removeView(webView)
                webView.destroy()
            }
        } catch (_: Exception) {
        }
        super.onDestroy()
    }

    private fun pauseWebMedia() {
        if (!::webView.isInitialized) return
        try {
            webView.evaluateJavascript(PAUSE_MEDIA_JS, null)
        } catch (_: Exception) {
        }
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

    /**
     * Contexto del WebView con densidad mdpi (1 CSS px = 1 px de layout).
     *
     * WebView calcula su viewport como tamaño_en_px / densidad. Con la
     * densidad nativa de una TV (320 dpi) el viewport caía a ~960 px CSS y el
     * diseño de 1920 no entraba. Fijando mdpi y maquetando sobre un escenario de
     * 1920x1080 px, el viewport es exactamente 1920x1080 y StageLayout se
     * encarga de escalarlo a la pantalla.
     */
    private fun tvWebViewContext(): Context {
        val config = Configuration(resources.configuration)
        config.densityDpi = DisplayMetrics.DENSITY_MEDIUM
        return androidx.appcompat.view.ContextThemeWrapper(
            createConfigurationContext(config),
            R.style.Theme_RitmikaTV
        )
    }

    /**
     * Mide y escala a sus hijos como si la pantalla midiera 1920x1080.
     *
     * El diseño de Ritmika está pensado para 1920x1080 CSS px. En vez de
     * reescribir todo el CSS para que sea fluido, el WebView se maqueta a
     * 1920x1080 y este contenedor aplica la escala (uniforme y centrada) que
     * hace entrar el diseño en cualquier TV.
     */
    private class StageLayout(context: Context) : FrameLayout(context) {

        private var designWidth = DESIGN_WIDTH
        private var designHeight = DESIGN_HEIGHT

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            setMeasuredDimension(
                MeasureSpec.getSize(widthMeasureSpec),
                MeasureSpec.getSize(heightMeasureSpec)
            )
            // El viewport del WebView es tamaño_en_px / densidad, así que el
            // escenario debe medir DESIGN * densidad para que el CSS vea
            // exactamente 1920x1080 px. Se lee la densidad del propio WebView
            // (no de este contenedor) para que el layout siga siendo correcto
            // aunque el override a mdpi no se aplique.
            val density = if (childCount > 0) getChildAt(0).resources.displayMetrics.density else 1f
            val safeDensity = if (density > 0f) density else 1f
            designWidth = Math.round(DESIGN_WIDTH * safeDensity)
            designHeight = Math.round(DESIGN_HEIGHT * safeDensity)
            val w = MeasureSpec.makeMeasureSpec(designWidth, MeasureSpec.EXACTLY)
            val h = MeasureSpec.makeMeasureSpec(designHeight, MeasureSpec.EXACTLY)
            for (i in 0 until childCount) getChildAt(i).measure(w, h)
        }

        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
            val availW = (r - l).toFloat()
            val availH = (b - t).toFloat()
            if (availW <= 0f || availH <= 0f) return
            val scale = minOf(availW / designWidth, availH / designHeight)
            val offsetX = (availW - designWidth * scale) / 2f
            val offsetY = (availH - designHeight * scale) / 2f
            for (i in 0 until childCount) {
                val child = getChildAt(i)
                child.pivotX = 0f
                child.pivotY = 0f
                child.scaleX = scale
                child.scaleY = scale
                child.translationX = offsetX
                child.translationY = offsetY
                child.layout(0, 0, designWidth, designHeight)
            }
        }

        companion object {
            const val DESIGN_WIDTH = 1920
            const val DESIGN_HEIGHT = 1080
        }
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
        val candidates = listOf(setOf("*"), setOf(ORIGIN))
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
        private const val ORIGIN = "https://ritmika.duckdns.org"
        const val BASE_URL = "$ORIGIN/?native=1"

        private const val PAUSE_MEDIA_JS = """
            (function(){
              try{
                var media=document.querySelectorAll('audio,video');
                for(var i=0;i<media.length;i++){try{media[i].pause();}catch(e){}}
                var bootMusic=document.getElementById('boot-music');
                if(bootMusic){try{bootMusic.pause();}catch(e){}}
                if(window.__ritmikaPauseTrackedMedia){try{window.__ritmikaPauseTrackedMedia();}catch(e){}}
                if(window.speechSynthesis){try{window.speechSynthesis.cancel();}catch(e){}}
              }catch(e){}
            })();
        """
    }
}
