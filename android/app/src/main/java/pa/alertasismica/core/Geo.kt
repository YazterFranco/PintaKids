package pa.alertasismica.core

import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

object Geo {
    private const val EARTH_RADIUS_KM = 6371.0
    private const val MOVE_THRESHOLD_KM = 5.0
    private const val MAX_AGE_MS = 6L * 60 * 60 * 1000

    /** Distancia de gran círculo en km (haversine). */
    fun haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * EARTH_RADIUS_KM * atan2(sqrt(a), sqrt(1 - a))
    }

    /** Rumbo desde el punto origen hacia el destino, en 8 direcciones en español. */
    fun bearingName(fromLat: Double, fromLon: Double, toLat: Double, toLon: Double): String {
        val φ1 = Math.toRadians(fromLat)
        val φ2 = Math.toRadians(toLat)
        val dλ = Math.toRadians(toLon - fromLon)
        val y = sin(dλ) * cos(φ2)
        val x = cos(φ1) * sin(φ2) - sin(φ1) * cos(φ2) * cos(dλ)
        val deg = (Math.toDegrees(atan2(y, x)) + 360.0) % 360.0
        val names = listOf("norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste")
        return names[((deg + 22.5) / 45.0).toInt() % 8]
    }

    /** Redondea a 0.05° (~5 km), igual que el servidor: la app no envía más precisión de la necesaria. */
    fun coarsen(value: Double): Double = Math.round(value * 20.0) / 20.0

    /** Decide si enviar la ubicación: primera vez, movimiento > 5 km o 6 h desde el último envío. */
    fun shouldSendLocation(last: SentLocation?, nowMs: Long, lat: Double, lon: Double): Boolean {
        if (last == null) return true
        if (nowMs - last.sentAt >= MAX_AGE_MS) return true
        return haversineKm(last.lat, last.lon, lat, lon) > MOVE_THRESHOLD_KM
    }
}

/** Última ubicación enviada al servidor (ya redondeada). */
data class SentLocation(val lat: Double, val lon: Double, val sentAt: Long)
