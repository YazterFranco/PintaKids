package com.pintakids.app

import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast

/**
 * Puente nativo para la PWA (window.PintakidsBridge).
 * Solo expone lo que la web no puede hacer sola: guardar en la galería del teléfono,
 * compartir por intent, y vibra­ción suave. Nada de identificadores ni telemetría: cero rastreo.
 */
class Bridge(private val activity: Activity, private val webView: android.webkit.WebView) {

    /** dataUrl "data:image/png;base64,..." → MediaStore (Pictures/Pintakids). */
    @JavascriptInterface
    fun saveImage(dataUrl: String, fileName: String) {
        val comma = dataUrl.indexOf(',')
        if (comma < 0) return
        val bytes = try {
            Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT)
        } catch (_: IllegalArgumentException) {
            return
        }
        activity.runOnUiThread {
            try {
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, safeName(fileName))
                    put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                    if (Build.VERSION.SDK_INT >= 29) {
                        put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Pintakids")
                    }
                }
                val uri = activity.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                if (uri != null) {
                    activity.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    Toast.makeText(activity, "🖍️ Pintakids → galería", Toast.LENGTH_SHORT).show()
                }
            } catch (_: Exception) {
                Toast.makeText(activity, "No se pudo guardar", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /** Compartir un PNG por el selector de Android (vía FileProvider, sin exponer el caché). */
    @JavascriptInterface
    fun shareImage(dataUrl: String, fileName: String) {
        val comma = dataUrl.indexOf(',')
        if (comma < 0) return
        val bytes = try {
            Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT)
        } catch (_: IllegalArgumentException) {
            return
        }
        activity.runOnUiThread {
            try {
                val file = java.io.File(activity.cacheDir, safeName(fileName))
                file.writeBytes(bytes)
                val uri = androidx.core.content.FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", file)
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                activity.startActivity(Intent.createChooser(send, "Pintakids"))
            } catch (_: Exception) {
                Toast.makeText(activity, "No se pudo compartir", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun vibrate(ms: Long) {
        val capped = ms.coerceIn(0, 80) // seguridad: nunca más de 80 ms
        activity.runOnUiThread {
            try {
                @Suppress("DEPRECATION")
                val vibrator = if (Build.VERSION.SDK_INT >= 31) {
                    (activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? android.os.VibratorManager)?.defaultVibrator
                } else {
                    activity.getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
                }
                if (vibrator?.hasVibrator() == true) vibrator.vibrate(capped)
            } catch (_: Exception) {
                /* vibración opcional */
            }
        }
    }

    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME

    private fun safeName(name: String): String =
        name.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(60).ifBlank { "pintakids.png" }
}
