package party.ritmika.tv

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
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

        // El video vive dentro de una "ventana" (marco premium del karaoke), no a
        // pantalla completa: el WebView pinta el escenario alrededor y deja el
        // hueco transparente. Estas medidas deben coincidir con KS_WIN de
        // public/js/tv/game.js.
        root.addOnLayoutChangeListener { _, _, _, r, b, _, _, _, _ ->
            layoutVideoWindow(r, b)
        }

        // El escalado NO se hace aquí. El WebView ignora la densidad del
        // contexto y usa la del display (Chromecast HD: 320 dpi → dpr 2), así
        // que su viewport sería 960x540 CSS. El bootstrap fija el viewport con
        // <meta viewport width=1920> y Chrome escala la página a la pantalla.
        // Escalar la vista por fuera NO sirve: el WebView sigue calculando su
        // visualViewport con su altura real y "ve" solo media pantalla.
        val stage = FrameLayout(this).apply {
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

            // Mantiene el renderer de Chromium en prioridad alta mientras la
            // TV está visible. Ayuda en Chromecast HD / GPUs modestas.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true)
            }

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

        // Android TV usa la misma interfaz Web/PC. El WebView es la única UI
        // de menú/lobby; el video nativo sigue detrás.
        webView.visibility = View.VISIBLE
        webView.isFocusable = true

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

    /**
     * Coloca el PlayerView en la ventana del video (marco premium del karaoke).
     *
     * Se calcula con la misma escala/letterbox que aplica Chrome al diseno de
     * 1920x1080, para que el hueco transparente del WebView coincida exactamente
     * con la superficie del video.
     */
    private fun layoutVideoWindow(width: Int, height: Int) {
        if (width <= 0 || height <= 0 || !::playerView.isInitialized) return
        val scale = minOf(width / DESIGN_W, height / DESIGN_H)
        val offX = (width - DESIGN_W * scale) / 2f
        val offY = (height - DESIGN_H * scale) / 2f
        val left = (offX + VIDEO_X * scale).toInt()
        val top = (offY + VIDEO_Y * scale).toInt()
        val w = (VIDEO_W * scale).toInt()
        val h = (VIDEO_H * scale).toInt()
        val lp = playerView.layoutParams as FrameLayout.LayoutParams
        // Solo tocar layoutParams si cambia de verdad: asignarlo siempre
        // provoca un bucle de relayout que impide que el video pinte frames.
        if (lp.gravity == (Gravity.TOP or Gravity.LEFT) && lp.leftMargin == left &&
            lp.topMargin == top && lp.width == w && lp.height == h
        ) {
            return
        }
        lp.gravity = Gravity.TOP or Gravity.LEFT
        lp.leftMargin = left
        lp.topMargin = top
        lp.width = w
        lp.height = h
        playerView.layoutParams = lp
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
     * Contexto del WebView (solo aplica el tema).
     *
     * Ojo: forzar aquí densityDpi a mdpi NO funciona. El WebView ignora la
     * densidad del contexto y calcula su devicePixelRatio con la del display
     * (en un Chromecast HD: 320 dpi → dpr 2). El viewport de 1920x1080 se
     * consigue desde el bootstrap con <meta viewport width=1920>.
     */
    private fun tvWebViewContext(): Context =
        androidx.appcompat.view.ContextThemeWrapper(this, R.style.Theme_RitmikaTV)

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
        fun isAudioPanelAvailable(): Boolean =
            packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH)

        @JavascriptInterface
        fun openAudioPanel(): Boolean {
            if (!isAudioPanelAvailable()) return false
            return try {
                runOnUiThread { openAudioPanelFromUi() }
                true
            } catch (e: Exception) {
                Log.e(TAG, "openAudioPanel failed", e)
                false
            }
        }

        @JavascriptInterface
        fun openSettings(musicEnabled: Boolean, reducedMotion: Boolean, perfMode: String): Boolean {
            return try {
                runOnUiThread {
                    LobbySettingsDialog(
                        this@MainActivity,
                        musicEnabled,
                        reducedMotion,
                        perfMode
                    ).show()
                }
                true
            } catch (e: Exception) {
                Log.e(TAG, "openSettings failed", e)
                false
            }
        }

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
        // Atajo de control remoto: MENU abre el panel nativo de audio, pero
        // solo si la página está en menú/lobby (lo valida el JS).
        if (event.keyCode == KeyEvent.KEYCODE_MENU) {
            if (event.action == KeyEvent.ACTION_DOWN) {
                webView.evaluateJavascript(
                    "window.__ritmikaOpenAudioPanel&&window.__ritmikaOpenAudioPanel()",
                    null
                )
            }
            return true
        }

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

    fun openAudioPanelFromUi() {
        try {
            startActivity(Intent(this, AudioPanelActivity::class.java))
        } catch (e: Exception) {
            Log.e(TAG, "openAudioPanelFromUi failed", e)
        }
    }

    fun applyMenuMusic(enabled: Boolean) {
        try {
            webView.evaluateJavascript(
                "window.__ritmikaSetMenuMusic&&window.__ritmikaSetMenuMusic($enabled)",
                null
            )
        } catch (_: Exception) {
        }
    }

    fun applyReducedMotion(enabled: Boolean) {
        try {
            webView.evaluateJavascript(
                "window.__ritmikaSetReducedMotion&&window.__ritmikaSetReducedMotion($enabled)",
                null
            )
        } catch (_: Exception) {
        }
    }

    fun applyPerfMode(mode: String) {
        val safe = when (mode) {
            "performance", "quality", "auto" -> mode
            else -> "auto"
        }
        try {
            webView.evaluateJavascript(
                "window.__ritmikaSetPerfMode&&window.__ritmikaSetPerfMode('$safe')",
                null
            )
        } catch (_: Exception) {
        }
    }

    companion object {
        // Ventana del video (marco premium). Debe coincidir con KS_WIN en
        // public/js/tv/game.js.
        private const val DESIGN_W = 1920f
        private const val DESIGN_H = 1080f
        private const val VIDEO_X = 200f
        private const val VIDEO_Y = 112f
        private const val VIDEO_W = 1520f
        private const val VIDEO_H = 855f

        private const val TAG = "RitmikaTV"
        private const val ORIGIN = "https://ritmika.duckdns.org"
        const val BASE_URL = "$ORIGIN/tv?native=1"

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
