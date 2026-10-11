package pa.alertasismica.core

import kotlinx.serialization.Serializable

enum class Action(val wire: String) {
    ALARM("alarm"), NOTIFY("notify"), UPDATE("update"), INFO("info"), SILENT("silent");

    companion object {
        fun fromWire(value: String?): Action? = entries.firstOrNull { it.wire == value }
    }
}

/** Canal lógico de notificación; la capa Android lo traduce a un NotificationChannel real. */
enum class ChannelKind { ALARM, HIGH, LOW, NONE }

/** Evento sísmico tal como lo entrega la API (`Event` en docs/API.md). */
@Serializable
data class QuakeEvent(
    val id: String,
    val originTime: Long,
    val lat: Double,
    val lon: Double,
    val depthKm: Double? = null,
    val magnitude: Double,
    val magMin: Double? = null,
    val magMax: Double? = null,
    val status: String = "preliminar",
    val region: String = "",
    val source: String = "",
    val updatedAt: Long = 0L,
) {
    val isRevisado: Boolean get() = status == "revisado"
}

/** Mensaje push ya validado y tipado. */
data class PushAlert(
    val type: String,
    val action: Action,
    val level: String,
    val eventId: String,
    val title: String,
    val body: String,
    val mag: Double?,
    val magMin: Double?,
    val magMax: Double?,
    val status: String?,
    val source: String?,
    val region: String?,
    val lat: Double?,
    val lon: Double?,
    val depthKm: Double?,
    val originTime: Long?,
    val distanceKm: Double?,
    val bearing: String?,
    val drill: Boolean,
    val sentAt: Long?,
)

@Serializable
data class Settings(
    val criticalRegionalMag: Double = 6.0,
    val criticalNearMag: Double = 5.0,
    val criticalNearKm: Double = 50.0,
    val importantMag: Double = 4.5,
    val importantKm: Double = 150.0,
    val informativeMag: Double? = 4.0,
    val digestMinutes: Int = 30,
    val maxImportantPerHour: Int = 3,
)

/** Rango permitido por campo, idéntico al de docs/API.md. */
data class Range(val min: Double, val max: Double, val label: String)

object SettingsRules {
    val ranges: Map<String, Range> = mapOf(
        "criticalRegionalMag" to Range(4.0, 9.0, "Magnitud crítica regional"),
        "criticalNearMag" to Range(3.0, 9.0, "Magnitud crítica cercana"),
        "criticalNearKm" to Range(5.0, 500.0, "Distancia crítica cercana (km)"),
        "importantMag" to Range(2.0, 9.0, "Magnitud importante"),
        "importantKm" to Range(10.0, 1000.0, "Distancia importante (km)"),
        "informativeMag" to Range(2.0, 9.0, "Magnitud informativa"),
        "digestMinutes" to Range(5.0, 240.0, "Minutos de resumen"),
        "maxImportantPerHour" to Range(1.0, 20.0, "Máximo de avisos importantes por hora"),
    )

    /** Devuelve mensajes de error en español; lista vacía si todo es válido. */
    fun validate(s: Settings): List<String> {
        val errors = mutableListOf<String>()
        fun check(key: String, value: Double?) {
            if (value == null) return
            val r = ranges.getValue(key)
            if (value.isNaN() || value < r.min || value > r.max) {
                errors += "${r.label}: debe estar entre ${r.min} y ${r.max}."
            }
        }
        check("criticalRegionalMag", s.criticalRegionalMag)
        check("criticalNearMag", s.criticalNearMag)
        check("criticalNearKm", s.criticalNearKm)
        check("importantMag", s.importantMag)
        check("importantKm", s.importantKm)
        check("informativeMag", s.informativeMag)
        check("digestMinutes", s.digestMinutes.toDouble())
        check("maxImportantPerHour", s.maxImportantPerHour.toDouble())
        return errors
    }
}
