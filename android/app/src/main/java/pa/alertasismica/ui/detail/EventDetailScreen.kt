package pa.alertasismica.ui.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import pa.alertasismica.core.PanamaTime
import pa.alertasismica.graph
import pa.alertasismica.ui.components.MagnitudeBadge
import pa.alertasismica.ui.home.distanceLabel
import pa.alertasismica.ui.home.statusLabel

@Composable
fun EventDetailScreen(eventId: String, onBack: () -> Unit) {
    val context = LocalContext.current
    val graph = context.graph
    val event = graph.events.all().firstOrNull { it.id == eventId }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Button(onClick = onBack) { Text("Volver") }
        if (event == null) {
            Text("Este sismo ya no está en la lista local.")
            return@Column
        }
        MagnitudeBadge(magnitude = event.magnitude, large = true)
        Text(event.region.ifBlank { "Sin región" }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(statusLabel(event), fontWeight = FontWeight.SemiBold)
        val min = event.magMin
        val max = event.magMax
        if (min != null && max != null && min != max) {
            Text("Rango de magnitud reportado: $min a $max")
        }
        Text("Hora de origen: " + PanamaTime.format(event.originTime) + " (hora de Panamá, UTC-5)")
        event.depthKm?.let { Text("Profundidad: $it km") }
        Text(
            String.format(java.util.Locale.ROOT, "Coordenadas: %.3f, %.3f", event.lat, event.lon),
        )
        if (event.source.isNotBlank()) Text("Fuente principal: ${event.source.uppercase()}")
        distanceLabel(event, graph.prefs.lastSentLocation)?.let { Text(it) }
        FeelSection(eventId, graph.prefs.lastSentLocation?.let { Pair(it.lat, it.lon) })
        Text(
            "La información puede cambiar cuando las fuentes revisen el sismo.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

/** Reporte ciudadano "lo sentí". Requiere haber compartido la ubicación (onboarding o Ajustes). */
@Composable
private fun FeelSection(eventId: String, loc: Pair<Double, Double>?) {
    val context = LocalContext.current
    val api = context.graph.api
    var total by remember { mutableIntStateOf(0) }
    var enviado by remember { mutableStateOf(false) }
    var cargando by remember { mutableStateOf(false) }

    LaunchedEffect(eventId) {
        val (t) = api.feels(eventId)
        total = t
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("¿Usted lo sintió?", fontWeight = FontWeight.Bold)
        if (loc == null) {
            Text("Active la ubicación en Ajustes para poder reportar.", style = MaterialTheme.typography.bodySmall)
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(1 to "Leve", 2 to "Fuerte", 3 to "Fuertísimo").forEach { (n, label) ->
                    OutlinedButton(enabled = !enviado && !cargando, onClick = {
                        cargando = true
                        kotlinx.coroutines.MainScope().launch {
                            val t = try {
                                api.feel(eventId, loc, n)
                            } catch (e: Exception) {
                                total
                            }
                            total = t
                            cargando = false
                            enviado = true
                        }
                    }) { Text(label) }
                }
            }
        }
        when {
            enviado -> Text("Gracias. Ya son $total persona${if (total == 1) "" else "s"} que lo sintieron.")
            total > 0 -> Text("$total persona${if (total == 1) "" else "s"} lo sintieron")
        }
    }
}
