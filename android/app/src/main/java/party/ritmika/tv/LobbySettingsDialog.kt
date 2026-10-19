package party.ritmika.tv

import android.app.Dialog
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.StateListDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Modal nativo de Ajustes para el lobby.
 *
 * Vive por encima del WebView sin pausarlo. Desde aquí se puede abrir el panel
 * completo de Altavoz/Audio, cambiar la música del menú y el movimiento
 * reducido. Todo se maneja con D-pad.
 */
class LobbySettingsDialog(
    private val host: MainActivity,
    initialMusic: Boolean,
    initialMotion: Boolean
) : Dialog(host, R.style.Theme_RitmikaTV_Dialog) {

    private var music = initialMusic
    private var motion = initialMotion
    private lateinit var musicButton: Button
    private lateinit var motionButton: Button
    private lateinit var audioButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)

        val root = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10), dp(10), dp(10), dp(10))
        }

        val panel = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            background = panelBackground(PANEL, INK)
            setPadding(dp(24), dp(20), dp(34), dp(32))
        }
        root.addView(panel)

        panel.addView(label("SALA DE ESPERA", 12f, CYAN, black = true))
        panel.addView(label("AJUSTES", 34f, YELLOW, black = true).apply {
            setPadding(0, dp(2), 0, dp(8))
        })
        panel.addView(label(
            "Configura el audio y el ambiente de la sala sin salir del lobby.",
            14f,
            MUTED
        ).apply { setPadding(0, 0, 0, dp(14)) })

        audioButton = actionButton("🔊 ALTAVOZ / AUDIO", primary = true, tag = "lobby:audio") {
            dismiss()
            host.openAudioPanelFromUi()
        }
        panel.addView(audioButton)

        musicButton = actionButton(toggleText("🎵 MÚSICA DEL MENÚ", music), tag = "lobby:music") {
            music = !music
            musicButton.text = toggleText("🎵 MÚSICA DEL MENÚ", music)
            host.applyMenuMusic(music)
        }
        panel.addView(musicButton)

        motionButton = actionButton(toggleText("🚫 MOVIMIENTO REDUCIDO", motion), tag = "lobby:motion") {
            motion = !motion
            motionButton.text = toggleText("🚫 MOVIMIENTO REDUCIDO", motion)
            host.applyReducedMotion(motion)
        }
        panel.addView(motionButton)

        panel.addView(label(
            "La TV decide cuándo reconectar una bocina A2DP. Si no aparece, enciéndela y usa Altavoz/Audio.",
            12f,
            MUTED
        ).apply { setPadding(0, dp(4), 0, dp(12)) })

        panel.addView(actionButton("CERRAR", tag = "lobby:close") { dismiss() })

        setContentView(root)
        setCanceledOnTouchOutside(true)
        window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            setDimAmount(0.72f)
            setLayout(
                (host.resources.displayMetrics.widthPixels * 0.72).toInt(),
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setGravity(Gravity.CENTER)
        }
        setOnShowListener { audioButton.requestFocus() }
    }

    private fun toggleText(label: String, enabled: Boolean): String =
        "$label: ${if (enabled) "ACTIVADO" else "DESACTIVADO"}"

    private fun actionButton(
        text: String,
        primary: Boolean = false,
        tag: String,
        onClick: () -> Unit
    ): Button = Button(host).apply {
        this.text = text
        isAllCaps = false
        textSize = 15f
        typeface = typefaceBlack
        letterSpacing = 0.05f
        gravity = Gravity.CENTER
        setTextColor(buttonTextColors(primary))
        background = buttonBackground(primary)
        stateListAnimator = null
        minHeight = dp(58)
        minWidth = dp(180)
        setPadding(dp(18), dp(10), dp(18), dp(10))
        isFocusable = true
        isFocusableInTouchMode = true
        this.tag = tag
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(10) }
    }

    private fun label(text: String, size: Float, color: Int, black: Boolean = false): TextView =
        TextView(host).apply {
            this.text = text
            textSize = size
            setTextColor(color)
            typeface = if (black) typefaceBlack else Typeface.create("sans-serif", Typeface.NORMAL)
            includeFontPadding = false
            setLineSpacing(0f, 1.12f)
        }

    private fun panelBackground(fill: Int, stroke: Int): LayerDrawable {
        val shadow = GradientDrawable().apply { setColor(INK) }
        val face = GradientDrawable().apply {
            setColor(fill)
            setStroke(dp(3), stroke)
            cornerRadius = 0f
        }
        return LayerDrawable(arrayOf(shadow, face)).apply {
            setLayerInset(0, dp(8), dp(8), 0, 0)
            setLayerInset(1, 0, 0, dp(8), dp(8))
        }
    }

    private fun buttonBackground(primary: Boolean): StateListDrawable {
        val fill = if (primary) YELLOW else PANEL
        val stroke = if (primary) INK else Color.parseColor("#334155")
        val focusFill = if (primary) CYAN else YELLOW
        return StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_focused), panelBackground(focusFill, INK))
            addState(intArrayOf(android.R.attr.state_pressed), panelBackground(WHITE, INK))
            addState(intArrayOf(), panelBackground(fill, stroke))
        }
    }

    private fun buttonTextColors(primary: Boolean): android.content.res.ColorStateList {
        val normal = if (primary) INK else WHITE
        return android.content.res.ColorStateList(
            arrayOf(
                intArrayOf(android.R.attr.state_focused),
                intArrayOf(android.R.attr.state_pressed),
                intArrayOf()
            ),
            intArrayOf(INK, INK, normal)
        )
    }

    private fun dp(value: Int): Int =
        (value * host.resources.displayMetrics.density).toInt()

    companion object {
        private val INK = Color.parseColor("#111827")
        private val PANEL = Color.parseColor("#0F172A")
        private val YELLOW = Color.parseColor("#FFE600")
        private val CYAN = Color.parseColor("#00E5FF")
        private val WHITE = Color.parseColor("#F8FAFC")
        private val MUTED = Color.parseColor("#94A3B8")
        private val typefaceBlack: Typeface = Typeface.create("sans-serif-black", Typeface.BOLD)
    }
}
