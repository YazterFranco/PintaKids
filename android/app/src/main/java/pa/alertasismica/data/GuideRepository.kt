package pa.alertasismica.data

import android.content.Context
import pa.alertasismica.core.AppJson
import pa.alertasismica.core.Guide
import java.io.File

/** Guía offline: copia de assets, reemplazada por la descargada si tiene versión igual o mayor. */
class GuideRepository(private val context: Context) {
    private val cached = File(context.filesDir, "guide.json")

    @Synchronized
    fun load(): Guide {
        val bundled = readBundled()
        val remote = try {
            if (cached.exists()) AppJson.decodeFromString<Guide>(cached.readText()) else null
        } catch (e: Exception) {
            null
        }
        return if (remote != null && bundled != null && remote.version >= bundled.version) remote
        else bundled ?: remote ?: Guide()
    }

    /** Guarda la guía descargada si es más nueva que la copia actual. */
    @Synchronized
    fun saveIfNewer(json: String) {
        try {
            val incoming = AppJson.decodeFromString<Guide>(json)
            val current = load()
            if (incoming.version >= current.version && incoming.sections.isNotEmpty()) {
                cached.writeText(json)
            }
        } catch (e: Exception) {
            // Respuesta inválida: se conserva la copia anterior.
        }
    }

    private fun readBundled(): Guide? = try {
        context.assets.open("guide.json").bufferedReader().use { AppJson.decodeFromString<Guide>(it.readText()) }
    } catch (e: Exception) {
        null
    }
}
