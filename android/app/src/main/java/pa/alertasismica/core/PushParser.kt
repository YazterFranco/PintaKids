package pa.alertasismica.core

/** Convierte el mapa `data` de un aviso push (canal en vivo) en un PushAlert validado; null si falta algo esencial. */
object PushParser {

    fun parse(data: Map<String, String>): PushAlert? {
        val action = Action.fromWire(data["action"]) ?: return null
        val eventId = data["eventId"]?.takeIf { it.isNotBlank() } ?: return null
        val level = data["level"].orEmpty()
        val type = data["type"].orEmpty()
        val lat = data["lat"]?.toDoubleOrNull()
        val lon = data["lon"]?.toDoubleOrNull()
        val distance = data["distanceKm"]?.toDoubleOrNull()
        val bearing = data["bearing"]?.takeIf { it.isNotBlank() }
        val computedText = buildFallbackBody(data, distance, bearing)

        return PushAlert(
            type = type,
            action = action,
            level = level,
            eventId = eventId,
            title = data["title"]?.takeIf { it.isNotBlank() } ?: "Sismo reportado",
            body = data["body"]?.takeIf { it.isNotBlank() } ?: computedText,
            mag = data["mag"]?.toDoubleOrNull(),
            magMin = data["magMin"]?.toDoubleOrNull(),
            magMax = data["magMax"]?.toDoubleOrNull(),
            status = data["status"]?.takeIf { it.isNotBlank() },
            source = data["source"]?.takeIf { it.isNotBlank() },
            region = data["region"]?.takeIf { it.isNotBlank() },
            lat = lat,
            lon = lon,
            depthKm = data["depthKm"]?.toDoubleOrNull(),
            originTime = data["originTime"]?.toLongOrNull(),
            distanceKm = distance,
            bearing = bearing,
            drill = data["drill"] == "1",
            sentAt = data["sentAt"]?.toLongOrNull(),
        )
    }

    private fun buildFallbackBody(data: Map<String, String>, distance: Double?, bearing: String?): String {
        val mag = data["mag"] ?: return ""
        val region = data["region"].orEmpty()
        val place = if (distance != null && bearing != null) {
            "a ${distance.toInt()} km al $bearing"
        } else {
            ""
        }
        return listOf("Magnitud $mag", region, place).filter { it.isNotBlank() }.joinToString(" · ")
    }
}
