package pa.alertasismica.core

/** Mapeo puro action -> canal. Los canales reales se crean en la capa Android. */
object ChannelMapping {
    fun channelFor(action: Action): ChannelKind = when (action) {
        Action.ALARM -> ChannelKind.ALARM
        Action.NOTIFY, Action.UPDATE -> ChannelKind.HIGH
        Action.INFO -> ChannelKind.LOW
        Action.SILENT -> ChannelKind.NONE
    }
}

/** Texto final de la notificación: prefijo de simulacro y sufijo de actualización. */
object AlertText {
    fun title(alert: PushAlert): String {
        val base = if (alert.drill) "SIMULACRO: ${alert.title}" else alert.title
        return if (alert.action == Action.UPDATE) "$base · ACTUALIZADO" else base
    }

    /** Líneas de detalle para la notificación y la pantalla de alerta. */
    fun detailLines(alert: PushAlert): List<String> {
        val lines = mutableListOf<String>()
        alert.mag?.let { lines += "Magnitud ${formatMag(it)}" }
        alert.status?.let { lines += "Estado: ${if (it == "revisado") "REVISADO" else "PRELIMINAR"}" }
        alert.region?.let { lines += it }
        if (alert.distanceKm != null && alert.bearing != null) {
            lines += "A ${alert.distanceKm.toInt()} km, rumbo ${alert.bearing}"
        }
        alert.originTime?.let { lines += "Hora de Panamá: ${PanamaTime.format(it)}" }
        return lines
    }

    fun formatMag(value: Double): String = String.format(java.util.Locale.ROOT, "%.1f", value)
}

/** Pasos inmediatos de la guía offline: primera sección de fase "during", o las primeras de la guía. */
object GuideSteps {
    fun immediate(guide: Guide, max: Int = 3): List<String> {
        val section = guide.sections.firstOrNull { it.phase == "during" } ?: guide.sections.firstOrNull()
        return section?.items?.take(max)?.map { it.text }.orEmpty()
    }
}

@kotlinx.serialization.Serializable
data class Guide(
    val version: Int = 1,
    val updatedAt: String = "",
    val disclaimer: String = "",
    val sources: List<GuideSource> = emptyList(),
    val sections: List<GuideSection> = emptyList(),
)

@kotlinx.serialization.Serializable
data class GuideSource(val name: String, val url: String)

@kotlinx.serialization.Serializable
data class GuideSection(val id: String, val title: String, val phase: String, val items: List<GuideItem> = emptyList())

@kotlinx.serialization.Serializable
data class GuideItem(val text: String, val confirmed: Boolean = false)

/** Evento local a partir de un push; null si el mensaje no trae datos sísmicos completos. */
fun PushAlert.toQuakeEvent(nowMs: Long): QuakeEvent? {
    val lat = lat ?: return null
    val lon = lon ?: return null
    val time = originTime ?: return null
    val magnitude = mag ?: return null
    return QuakeEvent(
        id = eventId,
        originTime = time,
        lat = lat,
        lon = lon,
        depthKm = depthKm,
        magnitude = magnitude,
        magMin = magMin,
        magMax = magMax,
        status = status ?: "preliminar",
        region = region.orEmpty(),
        source = source.orEmpty(),
        updatedAt = sentAt ?: nowMs,
    )
}
