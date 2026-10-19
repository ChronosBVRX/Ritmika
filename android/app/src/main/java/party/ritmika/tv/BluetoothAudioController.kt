package party.ritmika.tv

import android.Manifest
import android.bluetooth.BluetoothA2dp
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat

/**
 * Controlador de audio Bluetooth para el panel nativo.
 *
 * Importante: un APK normal no puede forzar `BluetoothA2dp.connect()`.
 * Aquí solo se consulta el estado, se empareja y se espera la reconexión
 * automática que decide Android.
 */
class BluetoothAudioController(
    context: Context,
    private val listener: Listener
) {

    data class BtDevice(
        val device: BluetoothDevice,
        val address: String,
        val name: String,
        val bonded: Boolean,
        val bondState: Int,
        val a2dpState: Int,
        val preferred: Boolean,
        val rssi: Int? = null
    )

    data class Snapshot(
        val available: Boolean = false,
        val enabled: Boolean = false,
        val hasPermission: Boolean = false,
        val scanning: Boolean = false,
        val paired: List<BtDevice> = emptyList(),
        val discovered: List<BtDevice> = emptyList(),
        val preferredMac: String? = null,
        val audioRouted: Boolean = false,
        val busy: Boolean = false,
        val message: String? = null
    )

    interface Listener {
        fun onSnapshot(snapshot: Snapshot)
    }

    private val appContext = context.applicationContext
    private val manager = appContext.getSystemService(BluetoothManager::class.java)
    private val adapter: BluetoothAdapter? = manager?.adapter
    private val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val handler = Handler(Looper.getMainLooper())
    private val paired = LinkedHashMap<String, BtDevice>()
    private val discovered = LinkedHashMap<String, BtDevice>()
    private val audioManager = appContext.getSystemService(AudioManager::class.java)

    private var a2dp: BluetoothA2dp? = null
    private var scanning = false
    private var busy = false
    private var message: String? = null
    private var pendingPairAddress: String? = null
    private var reconnectUntil = 0L
    private var receiverRegistered = false
    private var audioCallbackRegistered = false

    private val stopDiscoveryRunnable = Runnable { stopDiscovery() }

    private val reconnectRunnable = object : Runnable {
        override fun run() {
            refresh()
            val preferred = preferredMac()?.let { paired[it] }
            if (preferred?.a2dpState == BluetoothProfile.STATE_CONNECTED) {
                busy = false
                message = null
                emit()
                return
            }
            if (System.currentTimeMillis() >= reconnectUntil) {
                busy = false
                message = "No se conectó automáticamente. Enciende la bocina o desconéctala de otro teléfono."
                emit()
                return
            }
            handler.postDelayed(this, 1000)
        }
    }

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                BluetoothAdapter.ACTION_STATE_CHANGED -> {
                    val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
                    if (state == BluetoothAdapter.STATE_OFF) {
                        paired.clear()
                        discovered.clear()
                        scanning = false
                        busy = false
                        message = null
                    }
                    refresh()
                }
                BluetoothAdapter.ACTION_DISCOVERY_STARTED -> {
                    scanning = true
                    emit()
                }
                BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                    scanning = false
                    handler.removeCallbacks(stopDiscoveryRunnable)
                    emit()
                }
                BluetoothDevice.ACTION_FOUND -> {
                    val device = intent.deviceExtra() ?: return
                    if (!isAudioDevice(device)) return
                    val address = safeAddress(device)
                    discovered[address] = buildDevice(device, bonded = false, rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE).toInt())
                    emit()
                }
                BluetoothDevice.ACTION_BOND_STATE_CHANGED -> {
                    val device = intent.deviceExtra() ?: return
                    val bondState = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.BOND_NONE)
                    if (bondState == BluetoothDevice.BOND_BONDED) {
                        if (pendingPairAddress == safeAddress(device)) {
                            pendingPairAddress = null
                            busy = false
                            message = "Bocina emparejada. Esperando la conexión de audio…"
                            savePreferred(device)
                            requestReconnect(safeAddress(device))
                        }
                    } else if (bondState == BluetoothDevice.BOND_NONE &&
                        pendingPairAddress == safeAddress(device)
                    ) {
                        pendingPairAddress = null
                        busy = false
                        message = "No se pudo emparejar la bocina."
                    }
                    refresh()
                }
                BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED -> {
                    val device = intent.deviceExtra() ?: return
                    val state = intent.getIntExtra(BluetoothProfile.EXTRA_STATE, BluetoothProfile.STATE_DISCONNECTED)
                    if (preferredMac() == safeAddress(device) && state == BluetoothProfile.STATE_CONNECTED) {
                        busy = false
                        message = null
                    }
                    refresh()
                }
            }
        }
    }

    private val serviceListener = object : BluetoothProfile.ServiceListener {
        override fun onServiceConnected(profile: Int, proxy: BluetoothProfile?) {
            if (profile == BluetoothProfile.A2DP && proxy is BluetoothA2dp) {
                a2dp = proxy
                refresh()
            }
        }

        override fun onServiceDisconnected(profile: Int) {
            if (profile == BluetoothProfile.A2DP) a2dp = null
        }
    }

    private val audioDeviceCallback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) {
            refresh()
        }

        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) {
            refresh()
        }
    }

    fun hasBluetoothFeature(): Boolean =
        appContext.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH)

    fun requiredPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            )
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }

    fun hasPermissions(): Boolean = requiredPermissions().all {
        ContextCompat.checkSelfPermission(appContext, it) == PackageManager.PERMISSION_GRANTED
    }

    fun start() {
        registerReceivers()
        registerAudioCallback()
        connectA2dpProxy()
        refresh()
    }

    fun stop() {
        handler.removeCallbacksAndMessages(null)
        if (scanning) {
            try { adapter?.cancelDiscovery() } catch (_: Exception) {}
        }
        unregisterReceivers()
        unregisterAudioCallback()
        try {
            a2dp?.let { adapter?.closeProfileProxy(BluetoothProfile.A2DP, it) }
        } catch (_: Exception) {}
        a2dp = null
    }

    fun refresh() {
        val feature = hasBluetoothFeature()
        val ad = adapter
        if (!feature || ad == null) {
            emit(Snapshot(available = false, message = "Este equipo no tiene Bluetooth."))
            return
        }
        if (!hasPermissions()) {
            emit(Snapshot(available = true, enabled = false, hasPermission = false))
            return
        }
        val enabled = try { ad.isEnabled } catch (_: SecurityException) { false }
        if (!enabled) {
            paired.clear()
            discovered.clear()
            scanning = false
            busy = false
            emit(Snapshot(available = true, enabled = false, hasPermission = true))
            return
        }

        val preferred = preferredMac()
        val bonded = try { ad.bondedDevices } catch (_: SecurityException) { emptySet() }
        paired.clear()
        bonded.filter { isAudioDevice(it) }.forEach { device ->
            val address = safeAddress(device)
            paired[address] = buildDevice(device, bonded = true)
        }
        val ordered = paired.values.sortedWith(
            compareByDescending<BtDevice> { it.preferred }
                .thenByDescending { it.a2dpState == BluetoothProfile.STATE_CONNECTED }
                .thenBy { it.name.lowercase() }
        )
        val discoveredVisible = discovered.values
            .filter { !paired.containsKey(it.address) }
            .sortedByDescending { it.rssi ?: Int.MIN_VALUE }

        emit(
            Snapshot(
                available = true,
                enabled = true,
                hasPermission = true,
                scanning = scanning,
                paired = ordered,
                discovered = discoveredVisible,
                preferredMac = preferred,
                audioRouted = isA2dpRouted(preferred),
                busy = busy,
                message = message
            )
        )
    }

    fun startDiscovery() {
        if (!hasPermissions()) {
            message = "Falta el permiso de dispositivos cercanos."
            emit()
            return
        }
        val ad = adapter ?: return
        if (scanning) return
        try { ad.cancelDiscovery() } catch (_: Exception) {}
        discovered.clear()
        scanning = true
        message = null
        emit()
        val ok = try { ad.startDiscovery() } catch (_: SecurityException) { false }
        if (!ok) {
            scanning = false
            message = "No se pudo iniciar la búsqueda. Revisa que el Bluetooth esté activo."
            emit()
            return
        }
        handler.removeCallbacks(stopDiscoveryRunnable)
        handler.postDelayed(stopDiscoveryRunnable, DISCOVERY_MS)
    }

    fun stopDiscovery() {
        handler.removeCallbacks(stopDiscoveryRunnable)
        try { adapter?.cancelDiscovery() } catch (_: Exception) {}
        scanning = false
        emit()
    }

    fun pair(address: String) {
        val device = paired[address]?.device ?: discovered[address]?.device ?: return
        stopDiscovery()
        if (device.bondState == BluetoothDevice.BOND_BONDED) {
            savePreferred(device)
            requestReconnect(address)
            return
        }
        pendingPairAddress = address
        busy = true
        message = "Emparejando… Confirma el código en el diálogo del sistema."
        emit()
        try {
            val started = device.createBond()
            if (!started) {
                pendingPairAddress = null
                busy = false
                message = "No se pudo iniciar el emparejamiento."
                emit()
            }
        } catch (e: Exception) {
            pendingPairAddress = null
            busy = false
            message = "Error al emparejar: ${e.message ?: "permiso denegado"}"
            emit()
        }
    }

    fun selectPreferred(address: String) {
        val device = paired[address]?.device ?: discovered[address]?.device ?: return
        savePreferred(device)
        refresh()
    }

    fun requestReconnect(address: String) {
        val entry = paired[address] ?: return
        if (entry.bondState != BluetoothDevice.BOND_BONDED) {
            message = "Primero hay que emparejar la bocina."
            emit()
            return
        }
        savePreferred(entry.device)
        busy = true
        message = "Esperando la reconexión automática de Android…"
        reconnectUntil = System.currentTimeMillis() + RECONNECT_WAIT_MS
        handler.removeCallbacks(reconnectRunnable)
        handler.post(reconnectRunnable)
        emit()
    }

    fun clearMessage() {
        message = null
        emit()
    }

    private fun connectA2dpProxy() {
        if (a2dp != null || adapter == null || !hasPermissions()) return
        try {
            adapter.getProfileProxy(appContext, serviceListener, BluetoothProfile.A2DP)
        } catch (_: Exception) {
        }
    }

    private fun registerReceivers() {
        if (receiverRegistered) return
        val filter = IntentFilter().apply {
            addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
            addAction(BluetoothAdapter.ACTION_DISCOVERY_STARTED)
            addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
            addAction(BluetoothDevice.ACTION_FOUND)
            addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
            addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED)
        }
        try {
            ContextCompat.registerReceiver(
                appContext,
                receiver,
                filter,
                ContextCompat.RECEIVER_EXPORTED
            )
            receiverRegistered = true
        } catch (_: Exception) {
        }
    }

    private fun unregisterReceivers() {
        if (!receiverRegistered) return
        try { appContext.unregisterReceiver(receiver) } catch (_: Exception) {}
        receiverRegistered = false
    }

    private fun registerAudioCallback() {
        if (audioCallbackRegistered || audioManager == null) return
        try {
            audioManager.registerAudioDeviceCallback(audioDeviceCallback, handler)
            audioCallbackRegistered = true
        } catch (_: Exception) {
        }
    }

    private fun unregisterAudioCallback() {
        if (!audioCallbackRegistered || audioManager == null) return
        try { audioManager.unregisterAudioDeviceCallback(audioDeviceCallback) } catch (_: Exception) {}
        audioCallbackRegistered = false
    }

    private fun buildDevice(
        device: BluetoothDevice,
        bonded: Boolean,
        rssi: Int? = null
    ): BtDevice {
        val address = safeAddress(device)
        return BtDevice(
            device = device,
            address = address,
            name = safeName(device),
            bonded = bonded,
            bondState = try { device.bondState } catch (_: Exception) { BluetoothDevice.BOND_NONE },
            a2dpState = getA2dpState(device),
            preferred = address == preferredMac(),
            rssi = rssi
        )
    }

    private fun getA2dpState(device: BluetoothDevice): Int =
        try {
            a2dp?.getConnectionState(device) ?: BluetoothProfile.STATE_DISCONNECTED
        } catch (_: Exception) {
            BluetoothProfile.STATE_DISCONNECTED
        }

    private fun savePreferred(device: BluetoothDevice) {
        val address = safeAddress(device)
        prefs.edit()
            .putString(PREF_MAC, address)
            .putString(PREF_NAME, safeName(device))
            .apply()
        message = null
        refresh()
    }

    private fun preferredMac(): String? = prefs.getString(PREF_MAC, null)
    private fun preferredName(): String? = prefs.getString(PREF_NAME, null)

    private fun safeAddress(device: BluetoothDevice): String =
        try { device.address ?: "" } catch (_: Exception) { "" }

    private fun safeName(device: BluetoothDevice): String =
        try {
            device.name?.takeIf { it.isNotBlank() } ?: safeAddress(device)
        } catch (_: SecurityException) {
            safeAddress(device)
        }

    private fun isAudioDevice(device: BluetoothDevice): Boolean {
        val clazz = try { device.bluetoothClass } catch (_: Exception) { null } ?: return false
        return clazz.majorDeviceClass == BluetoothClass.Device.Major.AUDIO_VIDEO ||
            clazz.hasService(BluetoothClass.Service.AUDIO) ||
            clazz.hasService(BluetoothClass.Service.RENDER)
    }

    private fun isA2dpRouted(preferredMac: String?): Boolean {
        val devices = try {
            audioManager?.getDevices(AudioManager.GET_DEVICES_OUTPUTS) ?: emptyArray()
        } catch (_: Exception) {
            return false
        }
        val a2dpOutputs = devices.filter { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP }
        if (a2dpOutputs.isEmpty()) return false
        if (preferredMac.isNullOrBlank()) return true
        val preferred = preferredName()
        return a2dpOutputs.any { info ->
            val address = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                try { info.address } catch (_: Exception) { null }
            } else null
            if (!address.isNullOrBlank()) {
                address.equals(preferredMac, ignoreCase = true)
            } else {
                val product = info.productName?.toString().orEmpty()
                product.isNotBlank() && preferred != null &&
                    product.contains(preferred, ignoreCase = true)
            }
        }
    }

    private fun emit(snapshot: Snapshot? = null) {
        val value = snapshot ?: Snapshot(
            available = hasBluetoothFeature() && adapter != null,
            enabled = try { adapter?.isEnabled == true } catch (_: Exception) { false },
            hasPermission = hasPermissions(),
            scanning = scanning,
            paired = paired.values.sortedWith(
                compareByDescending<BtDevice> { it.preferred }
                    .thenByDescending { it.a2dpState == BluetoothProfile.STATE_CONNECTED }
                    .thenBy { it.name.lowercase() }
            ),
            discovered = discovered.values
                .filter { !paired.containsKey(it.address) }
                .sortedByDescending { it.rssi ?: Int.MIN_VALUE },
            preferredMac = preferredMac(),
            audioRouted = isA2dpRouted(preferredMac()),
            busy = busy,
            message = message
        )
        if (Looper.myLooper() == Looper.getMainLooper()) {
            listener.onSnapshot(value)
        } else {
            handler.post { listener.onSnapshot(value) }
        }
    }

    private fun Intent.deviceExtra(): BluetoothDevice? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
        } else {
            @Suppress("DEPRECATION")
            getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
        }
    }

    companion object {
        private const val PREFS = "ritmika_audio_panel"
        private const val PREF_MAC = "preferred_mac"
        private const val PREF_NAME = "preferred_name"
        private const val DISCOVERY_MS = 20_000L
        private const val RECONNECT_WAIT_MS = 15_000L
    }
}
