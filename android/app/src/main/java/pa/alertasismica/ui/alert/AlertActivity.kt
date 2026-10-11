package pa.alertasismica.ui.alert

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationManagerCompat
import pa.alertasismica.AlertaApp
import pa.alertasismica.core.GuideSteps
import pa.alertasismica.notify.AlertNotifier
import pa.alertasismica.ui.components.MagnitudeBadge
import pa.alertasismica.ui.theme.AlertaTheme

/** Pantalla completa de alerta crítica, visible sobre la pantalla de bloqueo. */
class AlertActivity : ComponentActivity() {

    private val tag: String? by lazy { intent.getStringExtra(EXTRA_TAG) }
    private val title: String by lazy { intent.getStringExtra(EXTRA_TITLE) ?: "Sismo reportado" }
    private val mag: Double by lazy { intent.getDoubleExtra(EXTRA_MAG, -1.0) }
    private val lines: List<String> by lazy { intent.getStringArrayListExtra(EXTRA_LINES).orEmpty() }
    private val drill: Boolean by lazy { intent.getBooleanExtra(EXTRA_DRILL, false) }
    private val revisado: Boolean by lazy { intent.getBooleanExtra(EXTRA_REVISADO, false) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        enableEdgeToEdge()

        val steps = GuideSteps.immediate((application as AlertaApp).graph.guides.load())

        setContent {
            AlertaTheme {
                AlertScreen(
                    title = title,
                    mag = mag.takeIf { it >= 0 },
                    lines = lines,
                    drill = drill,
                    revisado = revisado,
                    steps = steps,
                    onUnderstood = {
                        tag?.let { NotificationManagerCompat.from(this).cancel(it, AlertNotifier.NOTIFICATION_ID) }
                        finish()
                    },
                )
            }
        }
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            )
        }
    }

    companion object {
        const val EXTRA_TAG = "alerta.TAG"
        const val EXTRA_TITLE = "alerta.TITLE"
        const val EXTRA_MAG = "alerta.MAG"
        const val EXTRA_LINES = "alerta.LINES"
        const val EXTRA_DRILL = "alerta.DRILL"
        const val EXTRA_REVISADO = "alerta.REVISADO"
    }
}

@Composable
private fun AlertScreen(
    title: String,
    mag: Double?,
    lines: List<String>,
    drill: Boolean,
    revisado: Boolean,
    steps: List<String>,
    onUnderstood: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.errorContainer) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (drill) {
                Text("SIMULACRO", fontWeight = FontWeight.Bold, fontSize = 20.sp)
            }
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
            mag?.let { MagnitudeBadge(magnitude = it, large = true) }
            Text(
                text = if (revisado) "REVISADO" else "PRELIMINAR",
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
            lines.forEach {
                Text(it, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onErrorContainer)
            }

            if (steps.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text("Qué hacer ahora", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                steps.forEachIndexed { i, step ->
                    Text("${i + 1}. $step", style = MaterialTheme.typography.bodyLarge)
                }
            }

            Spacer(Modifier.height(16.dp))
            Button(onClick = onUnderstood, modifier = Modifier.fillMaxWidth()) {
                Text("Entendido")
            }
        }
    }
}
