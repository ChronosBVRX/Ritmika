package party.ritmika.tv

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * OTA: consulta un manifiesto JSON en el servidor, descarga el APK nuevo y
 * lanza el instalador del sistema (Package Installer).
 *
 * URL estable: https://ritmika.duckdns.org/download/latest.json
 * APK estable:  https://ritmika.duckdns.org/download/ritmika-tv.apk
 */
object UpdateManager {

    private const val TAG = "RitmikaTV/OTA"
    private const val MANIFEST_URL = "https://ritmika.duckdns.org/download/latest.json"

    fun checkOnLaunch(activity: Activity) {
        Thread {
            try {
                check(activity)
            } catch (e: Exception) {
                Log.w(TAG, "OTA check failed: ${e.message}")
            }
        }.start()
    }

    private fun check(activity: Activity) {
        val manifest = fetch(MANIFEST_URL)
        val json = JSONObject(manifest)

        val remoteCode = json.optInt("versionCode", 0)
        val currentCode = currentVersionCode(activity)

        if (remoteCode <= currentCode) {
            Log.i(TAG, "app up to date (local=$currentCode remote=$remoteCode)")
            return
        }

        val apkUrl = json.optString("url").ifBlank { "https://ritmika.duckdns.org/download/ritmika-tv.apk" }
        val expectedSha = json.optString("sha256", "")
        Log.i(TAG, "OTA update available: $currentCode -> $remoteCode ($apkUrl)")

        val dir = File(activity.cacheDir, "updates").apply { mkdirs() }
        val apkFile = File(dir, "ritmika-tv.apk")
        if (apkFile.exists()) apkFile.delete()

        download(apkUrl, apkFile)

        if (expectedSha.isNotEmpty() && !sha256(apkFile).equals(expectedSha, ignoreCase = true)) {
            Log.e(TAG, "sha256 mismatch, discarding download")
            apkFile.delete()
            return
        }

        activity.runOnUiThread { install(activity, apkFile) }
    }

    private fun fetch(urlStr: String): String {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            connectTimeout = 8000
            readTimeout = 8000
            setRequestProperty("Cache-Control", "no-cache")
        }
        try {
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    private fun download(urlStr: String, dest: File) {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10000
            readTimeout = 60000
            instanceFollowRedirects = true
        }
        try {
            conn.inputStream.use { input ->
                FileOutputStream(dest).use { out -> input.copyTo(out, 64 * 1024) }
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun install(activity: Activity, apkFile: File) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !activity.packageManager.canRequestPackageInstalls()
        ) {
            Log.w(TAG, "permission to install unknown apps not granted; opening settings")
            val i = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${activity.packageName}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                activity.startActivity(i)
            } catch (e: Exception) {
                Log.e(TAG, "settings intent failed", e)
            }
            return
        }

        val uri: Uri = FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.fileprovider",
            apkFile
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            activity.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "install intent failed", e)
        }
    }

    private fun currentVersionCode(activity: Activity): Long {
        val pi = activity.packageManager.getPackageInfo(activity.packageName, 0)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            pi.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            pi.versionCode.toLong()
        }
    }

    private fun sha256(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { ins ->
            val buf = ByteArray(8192)
            while (true) {
                val r = ins.read(buf)
                if (r < 0) break
                md.update(buf, 0, r)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
