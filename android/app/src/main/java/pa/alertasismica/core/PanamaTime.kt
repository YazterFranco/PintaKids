package pa.alertasismica.core

import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/** Panamá es UTC-5 todo el año (sin horario de verano). */
object PanamaTime {
    private val zone = ZoneOffset.ofHours(-5)
    private val formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")

    fun format(epochMs: Long): String =
        Instant.ofEpochMilli(epochMs).atZone(zone).format(formatter)
}
