package party.ritmika.tv

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Space
import android.widget.TextView

/**
 * Shell nativo de menú y lobby.
 *
 * El WebView sigue siendo el motor de sala/socket/juego y permanece oculto
 * detrás. Esta vista solo pinta menú y lobby en Kotlin, con foco D-pad nativo.
 */
class NativeShellView(
    context: Context,
    private val listener: Listener
) : FrameLayout(context) {

    interface Listener {
        fun onSelectMode(mode: String)
        fun onCreateRoom()
        fun onStartGame()
        fun onBackToMenu()
        fun onOpenSettings()
        fun onOpenAudio()
        fun onRetry()
        fun onUnlockAudio()
    }

    data class Player(val name: String, val avatarId: Int, val score: Int)
    data class State(
        val screen: String = "boot",
        val selectedMode: String = "clasico",
        val roomCode: String = "",
        val mode: String = "clasico",
        val joinUrl: String = "",
        val qr: String? = null,
        val players: List<Player> = emptyList(),
        val canStart: Boolean = false,
        val music: Boolean = true,
        val motion: Boolean = false,
        val perf: String = "auto"
    )

    data class Mode(
        val id: String,
        val display: String,
        val short: String,
        val kicker: String,
        val tagline: String,
        val description: String,
        val accent: Int,
        val icon: String,
        val hero: String,
        val axolo: String,
        val songs: String,
        val tag: String,
        val meta: String,
        val locked: Boolean = false
    )

    private val modes = listOf(
        Mode(
            "clasico", "CLÁSICO", "CLÁSICO", "SHOW 01 · EL SHOW DE TODOS",
            "Todos los éxitos. Cero piedad.",
            "El karaoke definitivo: 4,515 canciones, retos, tomatazos y sabotajes.",
            Color.parseColor("#FFE600"), "/assets/icon_classic.webp",
            "/assets/menu/hero_clasico.webp", "/assets/tio_axolo_body.webp",
            "4,515 ROLAS", "MODO ESTRELLA", "2–8 JUGADORES · 3 RONDAS · 20–30 MIN"
        ),
        Mode(
            "emo", "FIESTA EMO", "FIESTA EMO", "SHOW 02 · DRAMA GARANTIZADO",
            "No es una fase. Es una fiesta.",
            "Pop punk, delineador negro y corazones rotos. La noche en que todos cantan como si nadie los escuchara.",
            Color.parseColor("#F0047F"), "/assets/icon_emo.webp",
            "/assets/menu/hero_emo.webp", "/assets/axolo_emo.webp",
            "58 ROLAS", "DRAMA PREMIUM", "2–8 JUGADORES · 3 RONDAS · 25 MIN"
        ),
        Mode(
            "ranchera", "DOLIDAS & RANCHERAS", "RANCHERAS", "SHOW 03 · DESPECHO DE ALTURA",
            "Pa’ cantar con el alma y el pañuelo.",
            "Mariachi, palenque y despecho premium. Aquí se llora bonito, se canta fuerte y se perdona… o no.",
            Color.parseColor("#F59E0B"), "/assets/icon_ranchera.webp",
            "/assets/menu/hero_ranchera.webp", "/assets/axolo_ranchera.webp",
            "1,057 ROLAS", "PALENQUE LEGENDARIO", "2–8 JUGADORES · 3 RONDAS · 25 MIN"
        ),
        Mode(
            "nostalgia", "NOSTALGIA POP", "NOSTALGIA POP", "SHOW 04 · VIAJE A LOS 2000",
            "Saca el flip phone y el brillo labial.",
            "Y2K, discos compactos y pop de plástico. Un viaje a la época del Messenger y el playback.",
            Color.parseColor("#22D3EE"), "/assets/icon_nostalgia.webp",
            "/assets/menu/hero_nostalgia.webp", "/assets/axolo_nostalgia.webp",
            "299 ROLAS", "AÑOS 2000", "2–8 JUGADORES · 3 RONDAS · 25 MIN"
        ),
        Mode(
            "anime", "FIESTA ANIME", "ANIME", "SHOW 05 · EN EL HORNO",
            "Openings, endings y poder de protagonista.",
            "El próximo gran show de Rítmika. Los changos del código todavía lo están armando.",
            Color.parseColor("#38BDF8"), "/assets/icon_anime.webp",
            "/assets/menu/hero_anime.webp", "/assets/axolo_anime.webp",
            "MUY PRONTO", "PRÓXIMAMENTE", "MODO FUTURO · EN EL HORNO", locked = true
        )
    )

    private val modeById = modes.associateBy { it.id }
    private var current = State()
    private var currentMode = "clasico"
    private var lastUserSelectAt = 0L
    private var lastScreen = ""

    private val modeRows = LinkedHashMap<String, LinearLayout>()
    private val modeTexts = LinkedHashMap<String, Pair<TextView, TextView>>()

    private lateinit var loadingView: LinearLayout
    private lateinit var menuView: LinearLayout
    private lateinit var lobbyView: LinearLayout

    private lateinit var heroImage: ImageView
    private lateinit var heroIcon: ImageView
    private lateinit var heroAxolo: ImageView
    private lateinit var heroTag: TextView
    private lateinit var heroSongs: TextView
    private lateinit var heroKicker: TextView
    private lateinit var heroName: TextView
    private lateinit var heroTagline: TextView
    private lateinit var heroDescription: TextView
    private lateinit var heroMeta: TextView
    private lateinit var createButton: Button
    private lateinit var settingsButton: Button
    private lateinit var audioButton: Button

    private lateinit var lobbyCode: TextView
    private lateinit var lobbyMode: TextView
    private lateinit var lobbyJoin: TextView
    private lateinit var lobbyQr: ImageView
    private lateinit var lobbyQrPlaceholder: TextView
    private lateinit var lobbyPlayers: LinearLayout
    private lateinit var lobbyCount: TextView
    private lateinit var lobbyStart: Button
    private lateinit var lobbyBack: Button
    private lateinit var lobbySettings: Button

    private var lastQr: String? = null
    private var lastPlayersSignature = ""

    init {
        setBackgroundColor(NeoBrutalUi.BLACK)
        isFocusable = true
        isFocusableInTouchMode = true
        buildBackground()
        buildLoading()
        buildMenu()
        buildLobby()
        showOnly("boot")
    }

    fun update(state: State) {
        current = state
        if (state.screen == "game") {
            visibility = View.GONE
            lastScreen = "game"
            return
        }
        visibility = View.VISIBLE
        when (state.screen) {
            "lobby" -> {
                showOnly("lobby")
                updateLobby(state)
                if (lastScreen != "lobby") {
                    val target = if (state.canStart) lobbyStart else lobbyBack
                    target.requestFocus()
                }
            }
            "menu" -> {
                showOnly("menu")
                val mode = if (modeById.containsKey(state.selectedMode)) state.selectedMode else "clasico"
                if (System.currentTimeMillis() - lastUserSelectAt > 1200 || mode == currentMode) {
                    selectMode(mode, notify = false)
                }
                if (lastScreen != "menu") {
                    val target = if (createButton.isEnabled) createButton else (modeRows[currentMode] ?: createButton)
                    target.requestFocus()
                }
            }
            else -> {
                showOnly("boot")
                if (lastScreen != "boot") {
                    loadingView.findViewWithTag<View>("shell:retry")?.requestFocus()
                }
            }
        }
        lastScreen = state.screen
    }

    fun handleBack(): Boolean {
        if (lobbyView.visibility == View.VISIBLE) {
            listener.onBackToMenu()
            return true
        }
        return false
    }

    fun openSettings() {
        listener.onOpenSettings()
    }

    fun settings(): State = current

    // ─────────────────────────────────────────────────────────────
    //  Fondo / loading
    // ─────────────────────────────────────────────────────────────

    private fun buildBackground() {
        val bg = ImageView(context).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            scaleType = ImageView.ScaleType.CENTER_CROP
            alpha = 0.55f
        }
        RemoteImages.load(bg, "/assets/menu/menu_bg_palenque.webp")
        addView(bg)

        val scrim = View(context).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(0xF20A0A14.toInt(), 0x660A0A14, 0xF20A0A14.toInt())
            )
        }
        addView(scrim)
    }

    private fun buildLoading() {
        loadingView = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        }

        val logo = ImageView(context).apply {
            layoutParams = LinearLayout.LayoutParams(dp(180), dp(180)).apply { bottomMargin = dp(10) }
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        RemoteImages.load(logo, "/assets/logo_ritmika.webp")
        loadingView.addView(logo)

        loadingView.addView(text("RÍTMIKA", 38f, NeoBrutalUi.YELLOW, paytone = true))
        loadingView.addView(text("Conectando con la sala…", 16f, NeoBrutalUi.MUTED).apply {
            setPadding(0, dp(6), 0, dp(16))
        })

        val progress = ProgressBar(context).apply {
            indeterminateTintList = android.content.res.ColorStateList.valueOf(NeoBrutalUi.CYAN)
            layoutParams = LinearLayout.LayoutParams(dp(54), dp(54))
        }
        loadingView.addView(progress)

        val retry = actionButton("REINTENTAR", primary = false) { listener.onRetry() }
        retry.tag = "shell:retry"
        retry.layoutParams = LinearLayout.LayoutParams(dp(260), dp(54)).apply { topMargin = dp(18) }
        loadingView.addView(retry)

        addView(loadingView)
    }

    // ─────────────────────────────────────────────────────────────
    //  Menú
    // ─────────────────────────────────────────────────────────────

    private fun buildMenu() {
        menuView = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            setPadding(dp(28), dp(18), dp(28), dp(16))
        }

        val top = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val logo = ImageView(context).apply {
            layoutParams = LinearLayout.LayoutParams(dp(64), dp(64))
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        RemoteImages.load(logo, "/assets/logo_ritmika.webp")
        top.addView(logo)

        val brand = text("PALENQUE ARCADE", 12f, NeoBrutalUi.INK, paytone = true).apply {
            background = NeoBrutalUi.panel(context, NeoBrutalUi.YELLOW, NeoBrutalUi.INK)
            setPadding(dp(14), dp(7), dp(22), dp(15))
            letterSpacing = 0.12f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { leftMargin = dp(12) }
        }
        top.addView(brand)
        top.addView(Space(context).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) })

        val status = text("● TV LISTA", 12f, NeoBrutalUi.GREEN, paytone = true).apply {
            background = NeoBrutalUi.panel(context, NeoBrutalUi.PANEL, NeoBrutalUi.STROKE)
            setPadding(dp(12), dp(7), dp(20), dp(15))
        }
        top.addView(status)
        menuView.addView(top)

        val body = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            ).apply { topMargin = dp(14) }
        }

        val rail = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 0.34f)
        }
        rail.addView(text("◆  ELIGE TU SHOW", 14f, NeoBrutalUi.YELLOW, paytone = true).apply {
            letterSpacing = 0.16f
            setPadding(0, 0, 0, dp(10))
        })

        val list = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }
        modes.forEach { mode ->
            val row = buildModeRow(mode)
            modeRows[mode.id] = row
            list.addView(row)
        }
        rail.addView(list)

        val utility = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(8) }
        }
        settingsButton = actionButton("⚙ AJUSTES", primary = false) {
            listener.onUnlockAudio()
            listener.onOpenSettings()
        }
        settingsButton.layoutParams = LinearLayout.LayoutParams(0, dp(50), 1f).apply { rightMargin = dp(8) }
        audioButton = actionButton("🔊 ALTAVOZ", primary = false) {
            listener.onUnlockAudio()
            listener.onOpenAudio()
        }
        audioButton.layoutParams = LinearLayout.LayoutParams(0, dp(50), 1f)
        utility.addView(settingsButton)
        utility.addView(audioButton)
        rail.addView(utility)
        body.addView(rail)

        val hero = buildHero()
        body.addView(hero)
        menuView.addView(body)

        val footer = text(
            "◀ ▶ CAMBIAR SHOW      ENTER CREAR SALA      🎮 MANDO",
            11f,
            NeoBrutalUi.MUTED
        ).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, 0)
        }
        menuView.addView(footer)

        addView(menuView)

        // Orden de foco: riel -> hero -> utilidades.
        modeRows.values.forEach { row -> row.nextFocusRightId = createButton.id }
        createButton.nextFocusLeftId = modeRows[currentMode]?.id ?: (modeRows.values.firstOrNull()?.id ?: createButton.id)
        createButton.nextFocusDownId = settingsButton.id
        settingsButton.nextFocusUpId = createButton.id
        audioButton.nextFocusUpId = createButton.id
        modeRows.values.lastOrNull()?.nextFocusDownId = settingsButton.id
    }

    private fun buildModeRow(mode: Mode): LinearLayout {
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            id = View.generateViewId()
            isFocusable = true
            isFocusableInTouchMode = true
            isClickable = true
            setPadding(dp(12), dp(6), dp(16), dp(14))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            ).apply { bottomMargin = dp(7) }
        }
        val icon = ImageView(context).apply {
            layoutParams = LinearLayout.LayoutParams(dp(44), dp(44)).apply { rightMargin = dp(10) }
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        RemoteImages.load(icon, mode.icon)
        row.addView(icon)

        val copy = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val name = text(mode.short, 17f, NeoBrutalUi.WHITE, paytone = true).apply {
            maxLines = 1
            setTextColor(NeoBrutalUi.modeTextColors())
        }
        val sub = text(mode.tagline, 9f, NeoBrutalUi.MUTED).apply {
            maxLines = 1
            setTextColor(NeoBrutalUi.modeSubTextColors())
        }
        copy.addView(name)
        copy.addView(sub)
        row.addView(copy)

        val arrow = text("▶", 14f, NeoBrutalUi.CYAN, paytone = true).apply {
            setTextColor(NeoBrutalUi.modeTextColors())
        }
        row.addView(arrow)

        modeTexts[mode.id] = name to sub
        row.isSelected = mode.id == currentMode
        row.background = NeoBrutalUi.modeRowBackground(context, mode.accent, row.isSelected)

        row.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus && currentMode != mode.id) selectMode(mode.id, notify = true)
        }
        row.setOnClickListener {
            listener.onUnlockAudio()
            selectMode(mode.id, notify = true)
        }
        return row
    }

    private fun buildHero(): View {
        val wrapper = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 0.66f)
                .apply { leftMargin = dp(18) }
            background = NeoBrutalUi.panel(context, NeoBrutalUi.PANEL, NeoBrutalUi.INK)
            setPadding(dp(9), dp(9), dp(17), dp(17))
        }

        heroImage = ImageView(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            scaleType = ImageView.ScaleType.CENTER_CROP
            alpha = 0.92f
        }
        wrapper.addView(heroImage)

        wrapper.addView(View(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            background = GradientDrawable(
                GradientDrawable.Orientation.BOTTOM_TOP,
                intArrayOf(0xF20A0A14.toInt(), 0x330A0A14, 0x000A0A14)
            )
        })

        heroTag = text("MODO ESTRELLA", 10f, NeoBrutalUi.INK, paytone = true).apply {
            background = NeoBrutalUi.panel(context, NeoBrutalUi.YELLOW, NeoBrutalUi.INK)
            setPadding(dp(10), dp(5), dp(16), dp(13))
            letterSpacing = 0.12f
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.TOP or Gravity.LEFT
                leftMargin = dp(14)
                topMargin = dp(14)
            }
        }
        wrapper.addView(heroTag)

        heroSongs = text("4,515 ROLAS", 10f, NeoBrutalUi.CYAN, paytone = true).apply {
            background = NeoBrutalUi.panel(context, NeoBrutalUi.PANEL, NeoBrutalUi.STROKE)
            setPadding(dp(10), dp(5), dp(16), dp(13))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.TOP or Gravity.RIGHT
                rightMargin = dp(16)
                topMargin = dp(14)
            }
        }
        wrapper.addView(heroSongs)

        heroIcon = ImageView(context).apply {
            layoutParams = FrameLayout.LayoutParams(dp(112), dp(112)).apply {
                gravity = Gravity.TOP or Gravity.LEFT
                leftMargin = dp(18)
                topMargin = dp(62)
            }
            scaleType = ImageView.ScaleType.FIT_CENTER
            background = NeoBrutalUi.panel(context, NeoBrutalUi.YELLOW, NeoBrutalUi.INK)
            setPadding(dp(10), dp(10), dp(18), dp(18))
        }
        wrapper.addView(heroIcon)

        heroAxolo = ImageView(context).apply {
            val w = (resources.displayMetrics.widthPixels * 0.25).toInt()
            val h = (resources.displayMetrics.heightPixels * 0.62).toInt()
            layoutParams = FrameLayout.LayoutParams(w, h).apply {
                gravity = Gravity.BOTTOM or Gravity.RIGHT
                rightMargin = dp(6)
                bottomMargin = dp(6)
            }
            scaleType = ImageView.ScaleType.FIT_END
        }
        wrapper.addView(heroAxolo)

        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            val w = (resources.displayMetrics.widthPixels * 0.35).toInt()
            layoutParams = FrameLayout.LayoutParams(w, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.BOTTOM or Gravity.LEFT
                leftMargin = dp(18)
                bottomMargin = dp(16)
            }
            background = GradientDrawable().apply { setColor(0xCC0A0A14.toInt()) }
            setPadding(dp(12), dp(8), dp(12), dp(8))
        }
        heroKicker = text("SHOW 01 · EL SHOW DE TODOS", 9f, NeoBrutalUi.YELLOW, paytone = true)
        heroName = text("CLÁSICO", 38f, NeoBrutalUi.WHITE, paytone = true).apply {
            maxLines = 2
            setLineSpacing(0f, 0.9f)
        }
        heroTagline = text("Todos los éxitos. Cero piedad.", 16f, NeoBrutalUi.YELLOW, paytone = true).apply {
            setPadding(0, dp(2), 0, dp(4))
        }
        heroDescription = text(
            "El karaoke definitivo: 4,515 canciones, retos, tomatazos y sabotajes.",
            11f,
            NeoBrutalUi.WHITE
        ).apply {
            maxLines = 4
            setLineSpacing(0f, 1.15f)
        }
        heroMeta = text("2–8 JUGADORES · 3 RONDAS · 20–30 MIN", 9f, NeoBrutalUi.MUTED).apply {
            setPadding(0, dp(4), 0, dp(8))
        }
        createButton = actionButton("CREAR SALA · CLÁSICO", primary = true) {
            listener.onUnlockAudio()
            listener.onCreateRoom()
        }
        createButton.id = View.generateViewId()
        createButton.layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(58)
        )

        content.addView(heroKicker)
        content.addView(heroName)
        content.addView(heroTagline)
        content.addView(heroDescription)
        content.addView(heroMeta)
        content.addView(createButton)
        wrapper.addView(content)

        return wrapper
    }

    // ─────────────────────────────────────────────────────────────
    //  Lobby
    // ─────────────────────────────────────────────────────────────

    private fun buildLobby() {
        lobbyView = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            setPadding(dp(32), dp(20), dp(32), dp(18))
            visibility = View.GONE
        }

        val top = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        lobbyBack = actionButton("◀ ATRÁS", primary = false) {
            listener.onBackToMenu()
        }
        lobbyBack.layoutParams = LinearLayout.LayoutParams(dp(150), dp(52)).apply { rightMargin = dp(12) }
        top.addView(lobbyBack)

        lobbySettings = actionButton("⚙ AJUSTES", primary = false) {
            listener.onOpenSettings()
        }
        lobbySettings.layoutParams = LinearLayout.LayoutParams(dp(160), dp(52)).apply { rightMargin = dp(16) }
        top.addView(lobbySettings)

        top.addView(text("SALA DE ESPERA", 26f, NeoBrutalUi.YELLOW, paytone = true))
        top.addView(Space(context).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) })
        lobbyCount = text("👥 0 / 8", 13f, NeoBrutalUi.CYAN, paytone = true)
        top.addView(lobbyCount)
        lobbyView.addView(top)

        val body = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            ).apply { topMargin = dp(16) }
        }

        val qrPanel = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 0.6f)
                .apply { rightMargin = dp(16) }
            background = NeoBrutalUi.panel(context, NeoBrutalUi.PANEL, NeoBrutalUi.CYAN)
            setPadding(dp(20), dp(16), dp(30), dp(28))
        }
        qrPanel.addView(text("📡 CÓDIGO DE SALA", 12f, NeoBrutalUi.CYAN, paytone = true).apply {
            letterSpacing = 0.14f
        })
        lobbyCode = text("----", 42f, NeoBrutalUi.YELLOW, paytone = true).apply {
            letterSpacing = 0.18f
            setPadding(0, dp(2), 0, dp(8))
        }
        qrPanel.addView(lobbyCode)
        lobbyMode = text("MODO: CLÁSICO", 10f, NeoBrutalUi.MUTED).apply {
            letterSpacing = 0.1f
            setPadding(0, 0, 0, dp(6))
        }
        qrPanel.addView(lobbyMode)

        val qrFrame = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(dp(220), 0, 1f).apply { bottomMargin = dp(8) }
            background = NeoBrutalUi.panel(context, Color.WHITE, NeoBrutalUi.INK)
            setPadding(dp(10), dp(10), dp(18), dp(18))
        }
        lobbyQr = ImageView(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.WHITE)
        }
        qrFrame.addView(lobbyQr)
        lobbyQrPlaceholder = text("Generando QR…", 13f, NeoBrutalUi.MUTED).apply {
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        qrFrame.addView(lobbyQrPlaceholder)
        qrPanel.addView(qrFrame)

        lobbyJoin = text("Escanea el QR o usa el código desde tu celular", 11f, NeoBrutalUi.WHITE).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, 0)
            maxLines = 2
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
            )
        }
        qrPanel.addView(lobbyJoin)
        body.addView(qrPanel)

        val playersPanel = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 0.4f)
            background = NeoBrutalUi.panel(context, NeoBrutalUi.PANEL, NeoBrutalUi.STROKE)
            setPadding(dp(18), dp(16), dp(26), dp(26))
        }
        playersPanel.addView(text("👥 JUGADORES", 13f, NeoBrutalUi.YELLOW, paytone = true).apply {
            letterSpacing = 0.12f
            setPadding(0, 0, 0, dp(10))
        })
        lobbyPlayers = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }
        playersPanel.addView(lobbyPlayers)
        playersPanel.addView(text("Mínimo 1 jugador para empezar.", 11f, NeoBrutalUi.MUTED).apply {
            setPadding(0, dp(10), 0, 0)
        })
        body.addView(playersPanel)
        lobbyView.addView(body)

        lobbyStart = actionButton("🎤 ¡QUE EMPIECE LA FIESTA!", primary = true) {
            listener.onUnlockAudio()
            listener.onStartGame()
        }
        lobbyStart.layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(66)
        ).apply { topMargin = dp(14) }
        lobbyStart.isEnabled = false
        lobbyView.addView(lobbyStart)

        lobbyStart.nextFocusUpId = lobbySettings.id
        lobbySettings.nextFocusDownId = lobbyStart.id
        lobbyBack.nextFocusDownId = lobbyStart.id

        addView(lobbyView)
        showOnly("boot")
    }

    private fun updateLobby(state: State) {
        lobbyCode.text = state.roomCode.ifBlank { "----" }
        lobbyMode.text = "MODO: " + (modes.firstOrNull { it.id == state.mode }?.short ?: "CLÁSICO")
        lobbyJoin.text = if (state.joinUrl.isNotBlank()) state.joinUrl else "Escanea el QR desde tu celular"
        lobbyCount.text = "👥 ${state.players.size} / 8"
        lobbyStart.isEnabled = state.canStart
        lobbyStart.alpha = if (state.canStart) 1f else 0.45f
        if (state.qr != null && state.qr != lastQr) {
            val bmp = RemoteImages.bitmapFromDataUrl(state.qr)
            if (bmp != null) {
                lobbyQr.setImageBitmap(bmp)
                lobbyQrPlaceholder.visibility = View.GONE
                lastQr = state.qr
            }
        }
        if (state.qr == null) {
            lobbyQrPlaceholder.visibility = View.VISIBLE
        }

        val signature = state.players.joinToString("|") { "${it.name}:${it.avatarId}:${it.score}" }
        if (signature != lastPlayersSignature) {
            lastPlayersSignature = signature
            lobbyPlayers.removeAllViews()
            if (state.players.isEmpty()) {
                lobbyPlayers.addView(text("Nadie aquí todavía…\n¡Comparte el código!", 14f, NeoBrutalUi.MUTED).apply {
                    gravity = Gravity.CENTER
                    setPadding(0, dp(20), 0, 0)
                })
            } else {
                state.players.forEach { player ->
                    val row = LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.CENTER_VERTICAL
                        setPadding(dp(8), dp(7), dp(12), dp(15))
                        background = NeoBrutalUi.panel(context, NeoBrutalUi.PANEL, NeoBrutalUi.STROKE)
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply { bottomMargin = dp(7) }
                    }
                    val avatar = ImageView(context).apply {
                        layoutParams = LinearLayout.LayoutParams(dp(42), dp(42)).apply { rightMargin = dp(10) }
                        scaleType = ImageView.ScaleType.FIT_CENTER
                    }
                    RemoteImages.load(avatar, avatarPath(player.avatarId))
                    row.addView(avatar)
                    val copy = LinearLayout(context).apply {
                        orientation = LinearLayout.VERTICAL
                        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                    }
                    copy.addView(text(player.name, 15f, NeoBrutalUi.WHITE, paytone = true))
                    copy.addView(text("En la sala", 10f, NeoBrutalUi.GREEN))
                    row.addView(copy)
                    if (player.score > 0) {
                        row.addView(text("${player.score} pts", 12f, NeoBrutalUi.CYAN, paytone = true))
                    }
                    lobbyPlayers.addView(row)
                }
            }
        }
    }

    private fun avatarPath(id: Int): String {
        val names = arrayOf(
            "avatar_0_taco_rockero.webp", "avatar_1_chile_enmascarado.webp",
            "avatar_2_tequila_fiestero.webp", "avatar_3_estrella_rock.webp",
            "avatar_4_loro_cumbiambero.webp", "avatar_5_guitarra_magica.webp",
            "avatar_6_rey_palenque.webp", "avatar_7_pulpo_salsero.webp"
        )
        return "/assets/avatars/" + names[id.coerceIn(0, names.size - 1)]
    }

    // ─────────────────────────────────────────────────────────────
    //  Selección de modo / hero
    // ─────────────────────────────────────────────────────────────

    private fun selectMode(id: String, notify: Boolean) {
        val mode = modeById[id] ?: return
        if (notify) lastUserSelectAt = System.currentTimeMillis()
        val changed = currentMode != id
        currentMode = id

        modeRows.forEach { (rowId, row) ->
            val m = modeById[rowId] ?: return@forEach
            val selected = rowId == id
            row.isSelected = selected
            row.background = NeoBrutalUi.modeRowBackground(context, m.accent, selected)
            modeTexts[rowId]?.let { (name, sub) ->
                name.setTextColor(NeoBrutalUi.modeTextColors())
                sub.setTextColor(NeoBrutalUi.modeSubTextColors())
            }
        }

        createButton.nextFocusLeftId = modeRows[id]?.id ?: createButton.id
        createButton.text = if (mode.locked) "PRÓXIMAMENTE" else "CREAR SALA · ${mode.display}"
        createButton.isEnabled = !mode.locked
        createButton.alpha = if (mode.locked) 0.55f else 1f
        createButton.background = if (mode.locked) {
            NeoBrutalUi.buttonBackground(context, primary = false)
        } else {
            NeoBrutalUi.buttonBackground(context, primary = true, accent = mode.accent)
        }
        createButton.setTextColor(NeoBrutalUi.buttonTextColors(primary = !mode.locked, accent = mode.accent))

        heroTag.text = mode.tag
        heroTag.background = NeoBrutalUi.panel(context, mode.accent, NeoBrutalUi.INK)
        heroSongs.text = mode.songs
        heroKicker.text = mode.kicker
        heroName.text = mode.display
        heroTagline.text = mode.tagline
        heroDescription.text = mode.description
        heroMeta.text = mode.meta
        RemoteImages.load(heroImage, mode.hero)
        RemoteImages.load(heroIcon, mode.icon)
        RemoteImages.load(heroAxolo, mode.axolo)

        if (notify && changed) listener.onSelectMode(id)
    }

    // ─────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────

    private fun showOnly(which: String) {
        loadingView.visibility = if (which == "boot") View.VISIBLE else View.GONE
        menuView.visibility = if (which == "menu") View.VISIBLE else View.GONE
        lobbyView.visibility = if (which == "lobby") View.VISIBLE else View.GONE
    }

    private fun text(
        value: String,
        sizeSp: Float,
        color: Int,
        paytone: Boolean = false
    ): TextView = TextView(context).apply {
        text = value
        textSize = sizeSp
        setTextColor(color)
        typeface = if (paytone) NeoBrutalUi.paytone(context) else NeoBrutalUi.fredoka(context)
        includeFontPadding = false
        setLineSpacing(0f, 1.1f)
    }

    private fun actionButton(text: String, primary: Boolean, onClick: () -> Unit): Button =
        Button(context).apply {
            this.text = text
            isAllCaps = false
            textSize = 13f
            typeface = NeoBrutalUi.paytone(context)
            letterSpacing = 0.05f
            gravity = Gravity.CENTER
            setTextColor(NeoBrutalUi.buttonTextColors(primary))
            background = NeoBrutalUi.buttonBackground(context, primary)
            stateListAnimator = null
            minHeight = dp(50)
            setPadding(dp(14), dp(8), dp(14), dp(8))
            isFocusable = true
            isFocusableInTouchMode = true
            setOnClickListener { onClick() }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(50)
            )
        }

    private fun dp(value: Int): Int = NeoBrutalUi.dp(context, value)
}
