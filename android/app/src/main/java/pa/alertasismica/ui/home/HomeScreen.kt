package pa.alertasismica.ui.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import pa.alertasismica.core.Geo
import pa.alertasismica.core.PanamaTime
import pa.alertasismica.core.QuakeEvent
import pa.alertasismica.graph
import pa.alertasismica.live.LiveState
import pa.alertasismica.live.LiveStatus
import pa.alertasismica.platform.Permissions
import pa.alertasismica.ui.components.ErrorText
import pa.alertasismica.ui.components.MagnitudeBadge
import pa.alertasismica.ui.components.SectionCard

@Composable
fun HomeScreen(onEventClick: (String) -> Unit, onHealthClick: () -> Unit) {
    val context = LocalContext.current
    val graph = context.graph
    var events by remember { mutableStateOf(graph.events.all()) }
    var error by remember { mutableStateOf<String?>(null) }
    val lastSent = graph.prefs.lastSentLocation
    val registered = graph.prefs.deviceId != null
    val live by LiveStatus.state.collectAsState()
    val since by LiveStatus.desconectadoDesde.collectAsState()
    // Reevalúa cada 30 s si la falta de conexión ya supera los 10 minutos.
    val now by produceState(System.currentTimeMillis(), since) {
        while (true) {
            value = System.currentTimeMillis()
            delay(30_000)
        }
    }
    val prolonged = LiveStatus.sinConexionProlongada(now)

    LaunchedEffect(Unit) {
        try {
            val fresh = graph.api.events(50)
            graph.events.upsert(fresh)
            graph.prefs.lastServerOkAt = System.currentTimeMillis()
            events = graph.events.all()
            error = null
        } catch (e: Exception) {
            error = "No se pudo actualizar la lista. Se muestran los datos guardados."
        }
    }

    val connected = registered && live == LiveState.CONECTADO
    val status = when {
        !registered -> "Sin registro en el servidor"
        connected -> "Alertas activas"
        else -> "Alertas activas · ${live.label}"
    }
    val statusColor = if (connected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(status, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = statusColor)
            if (!Permissions.notifications(context)) {
                Text("Las notificaciones están desactivadas: no recibirá alertas.", color = MaterialTheme.colorScheme.error)
            }
            if (prolonged) {
                Text(
                    "Sin conexión con el servidor: sus alertas pueden llegar tarde",
                    color = MaterialTheme.colorScheme.error,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Text(
                "Ver estado del servidor",
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable { onHealthClick() }.padding(vertical = 4.dp),
            )
            ErrorText(error)
        }

        item {
            SectionCard {
                Text("Último sismo", style = MaterialTheme.typography.titleMedium)
                val last = events.firstOrNull()
                if (last == null) {
                    Text("Aún no hay sismos registrados.")
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        MagnitudeBadge(magnitude = last.magnitude)
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(last.region.ifBlank { "Sin región" }, fontWeight = FontWeight.SemiBold)
                            Text(statusLabel(last))
                            Text(PanamaTime.format(last.originTime) + " (hora de Panamá)")
                            distanceLabel(last, lastSent)?.let { Text(it) }
                        }
                    }
                }
            }
        }

        item {
            Text("Sismos recientes", style = MaterialTheme.typography.titleMedium)
        }

        items(events, key = { it.id }) { event ->
            SectionCard(modifier = Modifier.clickable { onEventClick(event.id) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MagnitudeBadge(magnitude = event.magnitude)
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(event.region.ifBlank { "Sin región" }, fontWeight = FontWeight.SemiBold)
                        Text(statusLabel(event))
                        Text(PanamaTime.format(event.originTime) + " (hora de Panamá)")
                        distanceLabel(event, lastSent)?.let { Text(it) }
                    }
                }
            }
        }
    }
}

internal fun statusLabel(e: QuakeEvent): String = if (e.isRevisado) "REVISADO" else "PRELIMINAR"

internal fun distanceLabel(e: QuakeEvent, at: pa.alertasismica.core.SentLocation?): String? {
    if (at == null) return null
    val km = Geo.haversineKm(at.lat, at.lon, e.lat, e.lon).toInt()
    val dir = Geo.bearingName(at.lat, at.lon, e.lat, e.lon)
    return "A $km km, rumbo $dir desde su ubicación aproximada"
}
