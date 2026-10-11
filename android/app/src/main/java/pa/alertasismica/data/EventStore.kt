package pa.alertasismica.data

import android.content.Context
import kotlinx.serialization.builtins.ListSerializer
import pa.alertasismica.core.AppJson
import pa.alertasismica.core.QuakeEvent
import java.io.File

/** Lista local de sismos para uso sin conexión. Archivo JSON con escritura atómica. */
class EventStore(context: Context) {
    private val file = File(context.filesDir, "events.json")
    private val tmp = File(context.filesDir, "events.json.tmp")
    private val serializer = ListSerializer(QuakeEvent.serializer())

    @Synchronized
    fun all(): List<QuakeEvent> = try {
        if (file.exists()) AppJson.decodeFromString(serializer, file.readText()) else emptyList()
    } catch (e: Exception) {
        emptyList()
    }

    /** Inserta o reemplaza por id, ordena por hora de origen y conserva los más recientes. */
    @Synchronized
    fun upsert(events: Collection<QuakeEvent>) {
        if (events.isEmpty()) return
        val merged = (all().associateBy { it.id } + events.associateBy { it.id })
            .values
            .sortedByDescending { it.originTime }
            .take(MAX_EVENTS)
        write(merged)
    }

    private fun write(list: List<QuakeEvent>) {
        try {
            tmp.writeText(AppJson.encodeToString(serializer, list))
            if (!tmp.renameTo(file)) {
                file.delete()
                tmp.renameTo(file)
            }
        } catch (e: Exception) {
            tmp.delete()
        }
    }

    private companion object {
        const val MAX_EVENTS = 200
    }
}
