package pa.alertasismica.ui.guide

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import pa.alertasismica.core.Guide
import pa.alertasismica.graph
import pa.alertasismica.ui.components.SectionCard

@Composable
fun GuideScreen() {
    val context = LocalContext.current
    val graph = context.graph
    var guide by remember { mutableStateOf<Guide>(graph.guides.load()) }

    // Refresca la guía si hay red; si falla, se queda la copia local.
    LaunchedEffect(Unit) {
        try {
            graph.guides.saveIfNewer(graph.api.guideRaw())
            guide = graph.guides.load()
        } catch (e: Exception) {
            // Sin conexión: se muestra la copia que ya está en el teléfono.
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Guía de seguridad", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        SectionCard {
            Text(guide.disclaimer, style = MaterialTheme.typography.bodyMedium)
        }

        guide.sections.forEach { section ->
            SectionCard {
                Text(section.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                section.items.forEach { item ->
                    Text(
                        text = "• " + item.text + if (!item.confirmed) "  (por confirmar)" else "",
                        modifier = Modifier.padding(top = 6.dp),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
        }

        if (guide.sources.isNotEmpty()) {
            Text("Fuentes", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            guide.sources.forEach { Text("${it.name}: ${it.url}") }
        }
        Text("Versión de la guía: ${guide.updatedAt.ifBlank { "sin fecha" }}", style = MaterialTheme.typography.bodySmall)
    }
}
