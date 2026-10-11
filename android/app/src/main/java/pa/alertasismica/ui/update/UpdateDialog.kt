package pa.alertasismica.ui.update

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import pa.alertasismica.graph
import pa.alertasismica.update.AppVersion
import pa.alertasismica.update.UpdateManager

private enum class Stage { Checking, None, Ready, Downloading, Install, NeedPermission, Failed }

/**
 * Revisa la autoactualización al abrir la app y muestra el diálogo correspondiente.
 * Sin red o sin versión nueva: no molesta (Stage.None). Descarga con progreso real
 * y, si Android pide "instalar apps desconocidas", lleva al usuario al ajuste exacto.
 */
@Composable
fun UpdateDialog() {
    val context = LocalContext.current
    val graph = context.graph
    val manager = remember { UpdateManager(context) }

    var stage by remember { mutableStateOf(Stage.Checking) }
    var version by remember { mutableStateOf<AppVersion?>(null) }
    var downloadId by remember { mutableStateOf(0L) }
    var progress by remember { mutableFloatStateOf(0f) }

    LaunchedEffect(Unit) {
        val newVersion = try {
            manager.check(graph.api)
        } catch (e: Exception) {
            null
        }
        if (newVersion == null) {
            stage = Stage.None
        } else {
            version = newVersion
            stage = Stage.Ready
        }
    }

    // Sigue el progreso de la descarga hasta terminar o fallar.
    LaunchedEffect(stage, downloadId) {
        if (stage != Stage.Downloading || downloadId == 0L) return@LaunchedEffect
        while (true) {
            val p = manager.progress(downloadId)
            if (p != null && p.second > 0) progress = p.first.toFloat() / p.second
            if (manager.isComplete(downloadId)) {
                stage = if (manager.canInstall()) Stage.Install else Stage.NeedPermission
                break
            }
            if (manager.failed(downloadId)) {
                stage = Stage.Failed
                break
            }
            delay(400)
        }
    }

    // Al volver del ajuste de permisos, si ya puede instalar pasa a Install.
    LaunchedEffect(stage) {
        if (stage == Stage.NeedPermission && manager.canInstall()) stage = Stage.Install
    }

    val v = version ?: return
    if (stage == Stage.None || stage == Stage.Checking) return

    val downloading = stage == Stage.Downloading
    AlertDialog(
        onDismissRequest = { if (!v.mandatory && !downloading) stage = Stage.None },
        title = { Text(if (stage == Stage.Install) "Instalar ${v.versionName}" else "Nueva versión ${v.versionName}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (v.notes.isNotBlank()) Text(v.notes)
                if (downloading) {
                    Text("Descargando… ${(progress * 100).toInt()}%", style = MaterialTheme.typography.bodyMedium)
                    LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth())
                }
                if (stage == Stage.NeedPermission) {
                    Text("Toca «Abrir ajuste» y permite «instalar apps desconocidas» para esta app; luego regresa.", style = MaterialTheme.typography.bodyMedium)
                }
                if (stage == Stage.Failed) {
                    Text("La descarga falló. Revisa tu conexión e inténtalo de nuevo.", style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {
            when (stage) {
                Stage.Ready, Stage.Failed -> Button(onClick = {
                    downloadId = manager.startDownload(v, manager.downloadUrl(graph.prefs.serverUrl, v))
                    progress = 0f
                    stage = Stage.Downloading
                }) { Text(if (stage == Stage.Failed) "Reintentar" else "Descargar") }
                Stage.Install -> Button(onClick = { manager.install(v) }) { Text("Instalar") }
                Stage.NeedPermission -> Button(onClick = { manager.openInstallPermissionSettings() }) { Text("Abrir ajuste") }
                else -> {}
            }
        },
        dismissButton = if (v.mandatory || downloading) null else {
            { TextButton(onClick = { stage = Stage.None }) { Text("Ahora no") } }
        },
    )
}
