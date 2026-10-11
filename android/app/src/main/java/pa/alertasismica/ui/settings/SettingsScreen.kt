package pa.alertasismica.ui.settings

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings as AndroidSettings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import kotlinx.coroutines.launch
import pa.alertasismica.core.Settings
import pa.alertasismica.core.SettingsRules
import pa.alertasismica.graph
import pa.alertasismica.net.ApiException
import pa.alertasismica.notify.Channels
import pa.alertasismica.platform.Permissions
import pa.alertasismica.sync.SyncScheduler
import pa.alertasismica.ui.components.ErrorText
import pa.alertasismica.ui.components.SectionCard

private val numericKeys = listOf(
    "criticalRegionalMag", "criticalNearMag", "criticalNearKm",
    "importantMag", "importantKm", "digestMinutes", "maxImportantPerHour",
)

@Composable
fun SettingsScreen(onHealthClick: () -> Unit) {
    val context = LocalContext.current
    val graph = context.graph
    val scope = rememberCoroutineScope()
    val initial = graph.prefs.settings

    val values = remember { mutableStateMapOf<String, String>().apply { putAll(initial.toFieldMap()) } }
    var informativeOn by remember { mutableStateOf(initial.informativeMag != null) }
    var serverUrl by remember { mutableStateOf(graph.prefs.serverUrl) }
    var errors by remember { mutableStateOf<List<String>>(emptyList()) }
    var status by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }

    var tick by remember { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { tick++ }
    val perms = remember(tick) { PermissionSnapshot.read(context) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Ajustes", style = MaterialTheme.typography.headlineSmall)

        SectionCard {
            Text("Estado de permisos", style = MaterialTheme.typography.titleMedium)
            PermissionRow("Notificaciones", perms.notifications) {
                open(context, Intent(AndroidSettings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(AndroidSettings.EXTRA_APP_PACKAGE, context.packageName))
            }
            PermissionRow("Ubicación aproximada", perms.location) { openAppDetails(context) }
            PermissionRow("Ubicación en segundo plano", perms.background) { openAppDetails(context) }
            PermissionRow("Pantalla completa de alarma", perms.fullScreen) {
                open(context, Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT")
                    .setData(Uri.parse("package:${context.packageName}")))
            }
            PermissionRow("Sin restricción de batería", perms.battery) {
                open(context, Intent(AndroidSettings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    .setData(Uri.parse("package:${context.packageName}")))
            }
            Text(
                "Para la alarma, permita \"Anular No molestar\" en el canal de alarma.",
                style = MaterialTheme.typography.bodySmall,
            )
            OutlinedButton(onClick = {
                open(context, Intent(AndroidSettings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                    .putExtra(AndroidSettings.EXTRA_APP_PACKAGE, context.packageName)
                    .putExtra(AndroidSettings.EXTRA_CHANNEL_ID, Channels.ALARM))
            }, modifier = Modifier.fillMaxWidth()) { Text("Configurar canal de alarma") }
            Text(
                "En algunos celulares (Xiaomi, Huawei, Samsung y otros) hay que permitir el inicio automático " +
                    "y quitar la optimización de batería para que las alertas lleguen con la app cerrada.",
                style = MaterialTheme.typography.bodySmall,
            )
        }

        SectionCard {
            Text("Umbrales de aviso", style = MaterialTheme.typography.titleMedium)
            numericKeys.forEach { key ->
                val range = SettingsRules.ranges.getValue(key)
                OutlinedTextField(
                    value = values[key].orEmpty(),
                    onValueChange = { values[key] = it },
                    label = { Text(range.label) },
                    supportingText = { Text("Entre ${range.min} y ${range.max}") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Avisos informativos", modifier = Modifier.weight(1f))
                Switch(checked = informativeOn, onCheckedChange = { informativeOn = it })
            }
            if (informativeOn) {
                OutlinedTextField(
                    value = values["informativeMag"].orEmpty(),
                    onValueChange = { values["informativeMag"] = it },
                    label = { Text(SettingsRules.ranges.getValue("informativeMag").label) },
                    supportingText = { Text("Entre 2.0 y 9.0") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        SectionCard {
            Text("Servidor", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it },
                label = { Text("URL del servidor (https)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                "Si cambia la URL, el teléfono se vuelve a registrar en ese servidor.",
                style = MaterialTheme.typography.bodySmall,
            )
            OutlinedButton(onClick = onHealthClick, modifier = Modifier.fillMaxWidth()) {
                Text("Ver estado del servidor")
            }
        }

        ErrorText(errors.joinToString("\n").ifBlank { null })
        status?.let { Text(it, color = MaterialTheme.colorScheme.primary) }

        Button(
            enabled = !saving,
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val (settings, parseErrors) = parseSettingsForm(values, informativeOn)
                val url = serverUrl.trim().trimEnd('/')
                val urlErrors = if (url.startsWith("https://")) emptyList()
                else listOf("La URL del servidor debe empezar por https://")
                val all = parseErrors + urlErrors
                if (settings == null || all.isNotEmpty()) {
                    errors = all
                    status = null
                    return@Button
                }
                errors = emptyList()
                saving = true
                scope.launch {
                    try {
                        graph.prefs.settings = settings
                        if (url != graph.prefs.serverUrl) {
                            graph.prefs.serverUrl = url
                            graph.prefs.clearRegistration()
                            SyncScheduler.runNow(context)
                            status = "Servidor cambiado. Registrando el dispositivo..."
                        } else {
                            val id = graph.prefs.deviceId
                            val secret = graph.prefs.secret
                            if (id != null && secret != null) {
                                val saved = graph.api.updateDevice(id, secret, settings = settings)
                                graph.prefs.settings = saved ?: settings
                                graph.prefs.settingsPending = false
                                status = "Ajustes guardados en el servidor."
                            } else {
                                graph.prefs.settingsPending = true
                                status = "Ajustes guardados en el teléfono. Se enviarán al registrarse."
                            }
                        }
                    } catch (e: ApiException) {
                        graph.prefs.settingsPending = true
                        errors = listOf(e.message ?: "No se pudo guardar en el servidor.")
                        status = "Ajustes guardados en el teléfono. Se enviarán cuando haya conexión."
                    } finally {
                        saving = false
                    }
                }
            },
        ) {
            Text(if (saving) "Guardando..." else "Guardar ajustes")
        }
    }
}

@Composable
private fun PermissionRow(label: String, ok: Boolean, onFix: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label)
            Text(if (ok) "Concedido" else "Falta", color = if (ok) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
        }
        if (!ok) {
            OutlinedButton(onClick = onFix) { Text("Abrir") }
        }
    }
}

private data class PermissionSnapshot(
    val notifications: Boolean,
    val location: Boolean,
    val background: Boolean,
    val fullScreen: Boolean,
    val battery: Boolean,
) {
    companion object {
        fun read(context: Context) = PermissionSnapshot(
            notifications = Permissions.notifications(context),
            location = Permissions.anyLocation(context),
            background = Permissions.backgroundLocation(context),
            fullScreen = Permissions.fullScreenIntent(context),
            battery = Permissions.ignoringBatteryOptimizations(context),
        )
    }
}

/** Convierte el formulario en Settings. Devuelve null y errores si algún campo no es un número. */
internal fun parseSettingsForm(values: Map<String, String>, informativeOn: Boolean): Pair<Settings?, List<String>> {
    val errors = mutableListOf<String>()
    fun num(key: String): Double {
        val v = values[key]?.trim()?.replace(',', '.')?.toDoubleOrNull()
        if (v == null) {
            errors += "${SettingsRules.ranges.getValue(key).label}: escriba un número."
            return 0.0
        }
        return v
    }
    val settings = Settings(
        criticalRegionalMag = num("criticalRegionalMag"),
        criticalNearMag = num("criticalNearMag"),
        criticalNearKm = num("criticalNearKm"),
        importantMag = num("importantMag"),
        importantKm = num("importantKm"),
        informativeMag = if (informativeOn) num("informativeMag") else null,
        digestMinutes = num("digestMinutes").toInt(),
        maxImportantPerHour = num("maxImportantPerHour").toInt(),
    )
    if (errors.isNotEmpty()) return null to errors
    return settings to SettingsRules.validate(settings)
}

private fun Settings.toFieldMap(): Map<String, String> = mapOf(
    "criticalRegionalMag" to criticalRegionalMag.toString(),
    "criticalNearMag" to criticalNearMag.toString(),
    "criticalNearKm" to criticalNearKm.toString(),
    "importantMag" to importantMag.toString(),
    "importantKm" to importantKm.toString(),
    "informativeMag" to (informativeMag ?: 4.0).toString(),
    "digestMinutes" to digestMinutes.toString(),
    "maxImportantPerHour" to maxImportantPerHour.toString(),
)

private fun openAppDetails(context: Context) {
    open(context, Intent(AndroidSettings.ACTION_APPLICATION_DETAILS_SETTINGS)
        .setData(Uri.parse("package:${context.packageName}")))
}

private fun open(context: Context, intent: Intent) {
    try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (e: ActivityNotFoundException) {
        // Algunos fabricantes no tienen esta pantalla: se mantiene el estado actual.
    }
}
