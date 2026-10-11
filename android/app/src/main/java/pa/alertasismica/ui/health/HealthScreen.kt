package pa.alertasismica.ui.health

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import pa.alertasismica.core.PanamaTime
import pa.alertasismica.graph
import pa.alertasismica.net.Health
import pa.alertasismica.ui.components.ErrorText
import pa.alertasismica.ui.components.SectionCard

@Composable
fun HealthScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val graph = context.graph
    var health by remember { mutableStateOf<Health?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }

    suspend fun load() {
        loading = true
        try {
            health = graph.api.health()
            error = null
        } catch (e: Exception) {
            error = e.message ?: "No se pudo consultar el servidor."
        } finally {
            loading = false
        }
    }

    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { load() }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Button(onClick = onBack) { Text("Volver") }
        Text("Estado del servidor", style = MaterialTheme.typography.headlineSmall)
        ErrorText(error)
        if (loading) Text("Consultando...")

        health?.let { h ->
            SectionCard {
                Text(if (h.ok) "Servidor en línea" else "Servidor con problemas", style = MaterialTheme.typography.titleMedium)
                if (h.serverNow > 0) {
                    Text("Hora del servidor: " + PanamaTime.format(h.serverNow) + " (hora de Panamá)")
                }
            }
            SectionCard {
                Text("Fuentes de datos", style = MaterialTheme.typography.titleMedium)
                h.sources.forEach { (name, state) ->
                    Text("${name.uppercase()}: $state")
                }
                if (h.sources.isEmpty()) Text("El servidor no informó fuentes.")
            }
        }

        Button(onClick = { scope.launch { load() } }, enabled = !loading, modifier = Modifier.fillMaxWidth()) {
            Text("Actualizar")
        }
    }
}
