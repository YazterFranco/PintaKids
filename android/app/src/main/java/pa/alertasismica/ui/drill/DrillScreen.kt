package pa.alertasismica.ui.drill

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import pa.alertasismica.graph
import pa.alertasismica.net.ApiException
import pa.alertasismica.ui.components.ErrorText
import pa.alertasismica.ui.components.SectionCard

/** Pide al servidor un simulacro que llega como push de prueba al propio teléfono. */
@Composable
fun DrillScreen() {
    val context = LocalContext.current
    val graph = context.graph
    val scope = rememberCoroutineScope()
    var sending by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Simulacro", style = MaterialTheme.typography.headlineSmall)
        SectionCard {
            Text(
                "Envía un aviso de prueba a este teléfono para comprobar que la alarma, el sonido y la pantalla de bloqueo funcionan. " +
                    "Aparecerá con la palabra SIMULACRO y no es un sismo real.",
            )
        }

        Button(
            enabled = !sending,
            onClick = {
                val deviceId = graph.prefs.deviceId
                val secret = graph.prefs.secret
                if (deviceId == null || secret == null) {
                    error = "El dispositivo aún no está registrado. Abra la app con conexión e inténtelo de nuevo."
                    return@Button
                }
                sending = true
                error = null
                message = null
                scope.launch {
                    try {
                        val online = graph.api.sendDrill(deviceId, secret)
                        message = if (online) {
                            "Simulacro enviado. Debe llegar en unos segundos."
                        } else {
                            "Simulacro en cola: llegará cuando la app se reconecte"
                        }
                    } catch (e: ApiException) {
                        error = if (e.httpCode == 429) {
                            "Espere 60 s antes de enviar otro simulacro."
                        } else {
                            e.message ?: "No se pudo enviar el simulacro."
                        }
                    } finally {
                        sending = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (sending) {
                CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp))
            }
            Text(if (sending) "Enviando..." else "Enviar simulacro")
        }

        message?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
        ErrorText(error)
    }
}
