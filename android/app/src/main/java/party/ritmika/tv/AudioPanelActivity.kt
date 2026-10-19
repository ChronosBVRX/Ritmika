package party.ritmika.tv

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothProfile
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.StateListDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * Panel nativo "Altavoz / Audio".
 *
 * No fuerza A2DP: empareja, consulta el estado real y guía al usuario para
 * que Android haga la reconexión automática.
 */
class AudioPanelActivity : AppCompatActivity(), BluetoothAudioController.Listener {

    private lateinit var controller: BluetoothAudioController
    private lateinit var content: LinearLayout
    private lateinit var subtitle: TextView
    private lateinit var scroll: ScrollView
    private var lastSnapshot: BluetoothAudioController.Snapshot? = null
    private var wasScanning = false

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            if (result.values.all { it }) {
                controller.start()
            } else {
                lastSnapshot = lastSnapshot?.copy(hasPermission = false)
                render(lastSnapshot ?: BluetoothAudioController.Snapshot(available = true))
            }
        }

    private val enableBluetoothLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            controller.refresh()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUi()

        controller = BluetoothAudioController(this, this)
        buildRoot()
        controller.start()
    }

    override fun onResume() {
        super.onResume()
        if (::controller.isInitialized) controller.refresh()
    }

    override fun onDestroy() {
        if (::controller.isInitialized) controller.stop()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    override fun onSnapshot(snapshot: BluetoothAudioController.Snapshot) {
        lastSnapshot = snapshot
        render(snapshot)
    }

    // ─────────────────────────────────────────────────────────────
    //  Estructura
    // ─────────────────────────────────────────────────────────────

    private fun buildRoot() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(BLACK)
            setPadding(dp(42), dp(24), dp(42), dp(22))
        }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) }
        }

        val back = actionButton("◀ VOLVER", primary = false, tag = "action:back") { finish() }
        back.layoutParams = LinearLayout.LayoutParams(dp(154), dp(52)).apply { rightMargin = dp(20) }
        header.addView(back)

        val titles = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        titles.addView(label("ALTAVOZ / AUDIO", 34f, YELLOW, black = true))
        subtitle = label("Conecta una bocina Bluetooth a la TV", 15f, MUTED)
        titles.addView(subtitle)
        header.addView(titles)
        root.addView(header)

        val line = View(this).apply {
            setBackgroundColor(INK)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)).apply {
                bottomMargin = dp(18)
            }
        }
        root.addView(line)

        scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 0, 0, dp(26))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
        scroll.addView(content)
        root.addView(scroll)
        setContentView(root)
    }

    private fun render(snapshot: BluetoothAudioController.Snapshot) {
        val focusTag = currentFocus?.tag as? String
        val wasScanningBefore = wasScanning
        wasScanning = snapshot.scanning
        content.removeAllViews()

        subtitle.text = when {
            !snapshot.available -> "Este equipo no tiene Bluetooth"
            !snapshot.hasPermission -> "Permiso de dispositivos cercanos"
            !snapshot.enabled -> "Bluetooth apagado"
            snapshot.scanning -> "Buscando bocinas…"
            snapshot.busy -> "Esperando la conexión de Android…"
            else -> "Elige una bocina y revisa el estado"
        }

        if (!snapshot.available) {
            content.addView(card(
                "SIN BLUETOOTH",
                "Esta TV no reporta un adaptador Bluetooth. Puedes conectar el audio por HDMI, óptico o cable.",
                listOf(actionButton("VOLVER", primary = true, tag = "action:back") { finish() })
            ))
            restoreFocus(focusTag)
            return
        }

        if (!snapshot.hasPermission) {
            val body = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                "Rítmika necesita permiso para ver y conectar dispositivos cercanos. Android lo pide una sola vez. No se usa para ubicación."
            } else {
                "Rítmika necesita permiso de ubicación para buscar bocinas Bluetooth en este Android. No se usa para rastrear la TV."
            }
            content.addView(card(
                "PERMISO NECESARIO",
                body,
                listOf(
                    actionButton("PERMITIR", primary = true, tag = "action:permission") {
                        permissionLauncher.launch(controller.requiredPermissions())
                    },
                    actionButton("ABRIR AJUSTES DE LA APP", tag = "action:app_settings") {
                        openAppSettings()
                    }
                )
            ))
            restoreFocus(focusTag)
            return
        }

        if (!snapshot.enabled) {
            content.addView(card(
                "BLUETOOTH APAGADO",
                "Activa el Bluetooth de la TV para emparejar o reconectar tu bocina.",
                listOf(
                    actionButton("ACTIVAR BLUETOOTH", primary = true, tag = "action:enable_bt") {
                        requestEnableBluetooth()
                    },
                    actionButton("ABRIR AJUSTES DE BLUETOOTH", tag = "action:bt_settings") {
                        openBluetoothSettings()
                    }
                )
            ))
            restoreFocus(focusTag)
            return
        }

        renderPreferred(snapshot)
        renderPaired(snapshot)
        renderDiscovery(snapshot)
        renderInfo(snapshot)

        content.addView(
            actionButton("VOLVER AL MENÚ", primary = false, tag = "action:back") { finish() }
        )
        val forcedTag = when {
            snapshot.scanning && !wasScanningBefore -> "action:stop_scan"
            !snapshot.scanning && wasScanningBefore -> firstDiscoveredTag() ?: "action:scan"
            else -> null
        }
        restoreFocus(focusTag, forcedTag)
    }

    private fun renderPreferred(snapshot: BluetoothAudioController.Snapshot) {
        val preferred = snapshot.preferredMac?.let { mac ->
            snapshot.paired.firstOrNull { it.address == mac }
        }

        val card = panelCard()
        card.addView(label("BOCINA PREFERIDA", 13f, YELLOW, black = true))

        if (preferred != null) {
            val name = TextView(this).apply {
                text = preferred.name
                setTextColor(WHITE)
                textSize = 24f
                typeface = typefaceBlack
                setPadding(0, dp(6), 0, dp(2))
            }
            card.addView(name)

            val (status, color) = statusFor(preferred, snapshot)
            card.addView(statusLine(status, color, snapshot, preferred))

            if (snapshot.message != null) {
                card.addView(label(snapshot.message!!, 14f, CYAN).apply {
                    setPadding(0, dp(10), 0, dp(2))
                })
            }

            card.addView(
                actionButton("RECONECTAR", primary = true, tag = "action:reconnect") {
                    controller.requestReconnect(preferred.address)
                }
            )
            card.addView(
                actionButton("ABRIR AJUSTES DE BLUETOOTH", tag = "action:bt_settings") {
                    openBluetoothSettings()
                }
            )
        } else {
            card.addView(label(
                "Aún no has elegido una bocina preferida. Empareja una y selecciónala para guardarla.",
                15f,
                WHITE
            ).apply { setPadding(0, dp(8), 0, dp(2)) })
        }
        content.addView(card)
    }

    private fun renderPaired(snapshot: BluetoothAudioController.Snapshot) {
        content.addView(sectionTitle("BOCINAS EMPAREJADAS"))
        if (snapshot.paired.isEmpty()) {
            content.addView(card(
                null,
                "No hay bocinas emparejadas todavía. Usa “Buscar bocinas nuevas” para agregar una.",
                emptyList()
            ))
            return
        }
        snapshot.paired.forEach { device ->
            content.addView(deviceRow(device, snapshot, discovered = false))
        }
    }

    private fun renderDiscovery(snapshot: BluetoothAudioController.Snapshot) {
        content.addView(sectionTitle("BUSCAR BOCINAS NUEVAS"))

        val card = panelCard()
        if (snapshot.scanning) {
            card.addView(statusLine("Buscando dispositivos cercanos…", YELLOW, snapshot, null))
            card.addView(actionButton("DETENER BÚSQUEDA", tag = "action:stop_scan") {
                controller.stopDiscovery()
            })
        } else {
            card.addView(label(
                "Pon la bocina en modo emparejamiento y pulsa buscar. El diálogo de Android aparecerá encima de la app.",
                14f,
                MUTED
            ).apply { setPadding(0, dp(4), 0, dp(8)) })
            card.addView(actionButton("BUSCAR BOCINAS", primary = true, tag = "action:scan") {
                controller.startDiscovery()
            })
        }
        content.addView(card)

        if (snapshot.discovered.isNotEmpty()) {
            snapshot.discovered.forEach { device ->
                content.addView(deviceRow(device, snapshot, discovered = true))
            }
        } else if (snapshot.scanning) {
            content.addView(label("Buscando… mantén la bocina cerca de la TV.", 14f, MUTED).apply {
                setPadding(dp(4), dp(2), 0, dp(12))
            })
        }
    }

    private fun renderInfo(snapshot: BluetoothAudioController.Snapshot) {
        val card = panelCard()
        card.addView(label("CÓMO FUNCIONA", 13f, YELLOW, black = true))
        card.addView(label(
            "Android decide cuándo reconectar una bocina A2DP. Rítmika solo detecta el estado y te guía. “Reconectar” espera 15 segundos la conexión automática del sistema.",
            14f,
            WHITE
        ).apply { setPadding(0, dp(6), 0, dp(8)) })
        if (snapshot.audioRouted) {
            card.addView(statusLine("Audio del sistema detectado en A2DP", GREEN, snapshot, null))
        } else {
            card.addView(label(
                "Si la bocina está conectada a otro teléfono, desconéctala primero. Algunas TVs siguen enviando audio por HDMI aunque la bocina esté emparejada.",
                13f,
                MUTED
            ))
        }
        card.addView(actionButton("ABRIR AJUSTES DE BLUETOOTH", tag = "action:bt_settings") {
            openBluetoothSettings()
        })
        content.addView(card)
    }

    // ─────────────────────────────────────────────────────────────
    //  Filas y piezas de UI
    // ─────────────────────────────────────────────────────────────

    private fun deviceRow(
        device: BluetoothAudioController.BtDevice,
        snapshot: BluetoothAudioController.Snapshot,
        discovered: Boolean
    ): View {
        val (status, statusColor) = statusFor(device, snapshot)
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = dp(78)
            setPadding(dp(16), dp(12), dp(26), dp(20))
            background = rowBackground()
            isFocusable = true
            isFocusableInTouchMode = true
            isClickable = true
            tag = (if (discovered) "disc:" else "dev:") + device.address
            contentDescription = "${device.name}. $status"
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(10) }
        }

        val icon = TextView(this).apply {
            text = if (device.preferred) "★" else "🔊"
            textSize = if (device.preferred) 22f else 24f
            setTextColor(rowTextColors(if (device.preferred) YELLOW else CYAN))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(dp(46), dp(46)).apply { rightMargin = dp(12) }
        }
        row.addView(icon)

        val copy = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        val name = TextView(this).apply {
            text = device.name
            textSize = 18f
            typeface = typefaceBlack
            setTextColor(rowTextColors(WHITE))
            maxLines = 1
        }
        val statusView = TextView(this).apply {
            text = status
            textSize = 13f
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setTextColor(rowTextColors(statusColor))
            setPadding(0, dp(2), 0, 0)
        }
        copy.addView(name)
        copy.addView(statusView)
        row.addView(copy)

        val arrow = TextView(this).apply {
            text = "›"
            textSize = 26f
            setTextColor(rowTextColors(CYAN))
            gravity = Gravity.CENTER
        }
        row.addView(arrow)

        row.setOnClickListener {
            if (discovered && !device.bonded) {
                controller.pair(device.address)
            } else {
                controller.selectPreferred(device.address)
                if (device.a2dpState != BluetoothProfile.STATE_CONNECTED) {
                    controller.requestReconnect(device.address)
                }
            }
        }
        return row
    }

    private fun statusLine(
        text: String,
        color: Int,
        snapshot: BluetoothAudioController.Snapshot,
        device: BluetoothAudioController.BtDevice?
    ): View {
        val line = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(4), 0, dp(6))
        }
        val dot = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(color)
            }
            layoutParams = LinearLayout.LayoutParams(dp(12), dp(12)).apply { rightMargin = dp(8) }
        }
        line.addView(dot)
        val statusText = TextView(this).apply {
            this.text = text
            textSize = 14f
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setTextColor(color)
        }
        line.addView(statusText)
        if (device != null && snapshot.busy && device.preferred) {
            line.addView(label("  ⏳", 14f, YELLOW))
        }
        return line
    }

    private fun panelCard(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = panelBackground(PANEL, INK)
        setPadding(dp(20), dp(16), dp(30), dp(28))
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(18) }
    }

    private fun card(title: String?, body: String?, actions: List<Button>): LinearLayout {
        val c = panelCard()
        if (title != null) c.addView(label(title, 13f, YELLOW, black = true))
        if (body != null) {
            c.addView(label(body, 15f, WHITE).apply { setPadding(0, dp(6), 0, dp(6)) })
        }
        actions.forEach { c.addView(it) }
        return c
    }

    private fun sectionTitle(text: String): TextView = label(text, 14f, CYAN, black = true).apply {
        letterSpacing = 0.12f
        setPadding(dp(4), dp(8), 0, dp(10))
    }

    private fun label(text: String, size: Float, color: Int, black: Boolean = false): TextView =
        TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(color)
            typeface = if (black) typefaceBlack else Typeface.create("sans-serif", Typeface.NORMAL)
            includeFontPadding = false
            setLineSpacing(0f, 1.12f)
        }

    private fun actionButton(
        text: String,
        primary: Boolean = false,
        danger: Boolean = false,
        tag: String,
        onClick: () -> Unit
    ): Button = Button(this).apply {
        this.text = text
        isAllCaps = false
        textSize = 15f
        typeface = typefaceBlack
        letterSpacing = 0.05f
        gravity = Gravity.CENTER
        setTextColor(buttonTextColors(primary, danger))
        background = buttonBackground(primary, danger)
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

    private fun statusFor(
        device: BluetoothAudioController.BtDevice,
        snapshot: BluetoothAudioController.Snapshot
    ): Pair<String, Int> = when {
        device.bondState == BluetoothDevice.BOND_BONDING -> "Emparejando…" to YELLOW
        device.a2dpState == BluetoothProfile.STATE_CONNECTED ->
            if (snapshot.audioRouted) "Conectada · audio en uso" to GREEN
            else "Conectada · audio no confirmado" to YELLOW
        device.a2dpState == BluetoothProfile.STATE_CONNECTING -> "Conectando…" to YELLOW
        device.bonded -> "Emparejada · desconectada" to MUTED
        else -> "Disponible" to CYAN
    }

    private fun restoreFocus(previousTag: String?, forcedTag: String? = null) {
        content.post {
            // "Volver" nunca debe robar el foco cuando llega una actualización
            // de estado; preferimos la acción principal de la pantalla.
            val previous = previousTag?.takeIf { it != "action:back" }
            val target = forcedTag?.let { content.findViewWithTag<View>(it) }
                ?: previous?.let { content.findViewWithTag<View>(it) }
                ?: content.findViewWithTag<View>("action:reconnect")
                ?: content.findViewWithTag<View>("action:stop_scan")
                ?: findFirstDeviceRow()
                ?: content.findViewWithTag<View>("action:scan")
                ?: content.findViewWithTag<View>("action:permission")
                ?: content.findViewWithTag<View>("action:enable_bt")
                ?: content.findViewWithTag<View>("action:back")
            target?.requestFocus()
            // Si el foco está en un botón dentro de una tarjeta, alinea el
            // scroll un poco arriba de la tarjeta para no cortar su título.
            if (target is Button) {
                val parent = target.parent as? View
                if (parent != null && parent !== content) {
                    val rect = Rect()
                    parent.getDrawingRect(rect)
                    content.offsetDescendantRectToMyCoords(parent, rect)
                    scroll.smoothScrollTo(0, maxOf(0, rect.top - dp(44)))
                }
            }
        }
    }

    private fun findFirstDeviceRow(): View? {
        for (i in 0 until content.childCount) {
            val child = content.getChildAt(i)
            if ((child.tag as? String)?.startsWith("dev:") == true) return child
        }
        return null
    }

    private fun firstDiscoveredTag(): String? {
        for (i in 0 until content.childCount) {
            val child = content.getChildAt(i)
            val tag = child.tag as? String
            if (tag?.startsWith("disc:") == true) return tag
        }
        return null
    }

    // ─────────────────────────────────────────────────────────────
    //  Acciones del sistema
    // ─────────────────────────────────────────────────────────────

    private fun requestEnableBluetooth() {
        if (!controller.hasPermissions()) return
        try {
            enableBluetoothLauncher.launch(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
        } catch (_: Exception) {
            openBluetoothSettings()
        }
    }

    private fun openAppSettings() {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:$packageName")
        )
        try { startActivity(intent) } catch (_: Exception) {}
    }

    private fun openBluetoothSettings() {
        val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
        try {
            startActivity(intent)
        } catch (_: Exception) {
            try { startActivity(Intent(Settings.ACTION_SETTINGS)) } catch (_: Exception) {}
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

    // ─────────────────────────────────────────────────────────────
    //  Estilo neo-brutalista
    // ─────────────────────────────────────────────────────────────

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

    private fun rowBackground(): StateListDrawable = StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_focused), panelBackground(YELLOW, INK))
        addState(intArrayOf(), panelBackground(PANEL, Color.parseColor("#334155")))
    }

    private fun rowTextColors(defaultColor: Int): ColorStateList = ColorStateList(
        arrayOf(intArrayOf(android.R.attr.state_focused), intArrayOf()),
        intArrayOf(INK, defaultColor)
    )

    private fun buttonBackground(primary: Boolean, danger: Boolean): StateListDrawable {
        val fill = when {
            danger -> MAGENTA
            primary -> YELLOW
            else -> PANEL
        }
        val stroke = if (primary || danger) INK else Color.parseColor("#334155")
        val focusFill = if (primary || danger) CYAN else YELLOW
        return StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_focused), panelBackground(focusFill, INK))
            addState(intArrayOf(android.R.attr.state_pressed), panelBackground(WHITE, INK))
            addState(intArrayOf(), panelBackground(fill, stroke))
        }
    }

    private fun buttonTextColors(primary: Boolean, danger: Boolean): ColorStateList {
        val normal = if (primary || danger) INK else WHITE
        return ColorStateList(
            arrayOf(
                intArrayOf(android.R.attr.state_focused),
                intArrayOf(android.R.attr.state_pressed),
                intArrayOf()
            ),
            intArrayOf(INK, INK, normal)
        )
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    companion object {
        private val BLACK = Color.parseColor("#0A0A14")
        private val INK = Color.parseColor("#111827")
        private val PANEL = Color.parseColor("#0F172A")
        private val YELLOW = Color.parseColor("#FFE600")
        private val CYAN = Color.parseColor("#00E5FF")
        private val MAGENTA = Color.parseColor("#F0047F")
        private val WHITE = Color.parseColor("#F8FAFC")
        private val MUTED = Color.parseColor("#94A3B8")
        private val GREEN = Color.parseColor("#22C55E")
        private val typefaceBlack: Typeface = Typeface.create("sans-serif-black", Typeface.BOLD)
    }
}
