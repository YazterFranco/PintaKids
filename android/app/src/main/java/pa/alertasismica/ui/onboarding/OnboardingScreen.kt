package pa.alertasismica.ui.onboarding

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import pa.alertasismica.graph
import pa.alertasismica.platform.Permissions
import pa.alertasismica.sync.SyncScheduler

/** Permisos en cascada: notificaciones, ubicación aproximada y luego ubicación en segundo plano. */
@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    val context = LocalContext.current
    var step by remember { mutableStateOf(0) }
    var message by remember { mutableStateOf<String?>(null) }

    val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        step = 1
    }
    val locationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        step = 2
    }
    val backgroundLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        step = 3
    }

    fun finish() {
        context.graph.prefs.onboardingDone = true
        SyncScheduler.runNow(context)
        onDone()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Bienvenido a Alerta Sísmica PA", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Esta app avisa de sismos cercanos o fuertes en Panamá. Para funcionar bien necesita algunos permisos.",
            style = MaterialTheme.typography.bodyLarge,
        )

        when (step) {
            0 -> {
                Text("1. Notificaciones", style = MaterialTheme.typography.titleMedium)
                Text("Necesarias para recibir las alertas sísmicas.")
                Button(onClick = {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        step = 1
                    }
                }, modifier = Modifier.fillMaxWidth()) { Text("Permitir notificaciones") }
            }
            1 -> {
                Text("2. Ubicación aproximada", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Sirve para indicar a qué distancia y en qué dirección está un sismo. " +
                        "Solo se envía una ubicación redondeada a unos 5 km, cada vez que cambia de forma importante o cada 6 horas. " +
                        "Si no la permite, la app sigue funcionando sin distancias.",
                )
                Button(onClick = {
                    locationLauncher.launch(
                        arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION),
                    )
                }, modifier = Modifier.fillMaxWidth()) { Text("Permitir ubicación") }
                OutlinedButton(onClick = { step = 2 }, modifier = Modifier.fillMaxWidth()) { Text("Ahora no") }
            }
            2 -> {
                Text("3. Ubicación en segundo plano", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Permite actualizar tu posición aproximada aunque la app esté cerrada. " +
                        "En Android 11 o superior, el sistema la concede desde Ajustes: elija \"Permitir todo el tiempo\".",
                )
                Button(onClick = {
                    if (Permissions.anyLocation(context) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        backgroundLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    } else {
                        step = 3
                    }
                }, modifier = Modifier.fillMaxWidth()) { Text("Continuar") }
                OutlinedButton(onClick = { step = 3 }, modifier = Modifier.fillMaxWidth()) { Text("Ahora no") }
            }
            else -> {
                Text("Último paso", style = MaterialTheme.typography.titleMedium)
                Text(
                    "En Ajustes podrá revisar el estado de los permisos, permitir la alarma en \"No molestar\" " +
                        "y quitar la optimización de batería, que en algunos celulares corta las alertas.",
                )
                Button(onClick = { finish() }, modifier = Modifier.fillMaxWidth()) { Text("Entendido, empezar") }
            }
        }
        message?.let { Text(it) }
    }
}
