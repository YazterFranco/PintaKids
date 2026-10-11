package pa.alertasismica

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import pa.alertasismica.live.AlertStreamService
import pa.alertasismica.sync.SyncScheduler
import pa.alertasismica.ui.nav.AppNav
import pa.alertasismica.ui.theme.AlertaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val startOnboarding = !graph.prefs.onboardingDone
        SyncScheduler.runNow(this)
        AlertStreamService.start(this) // no hace nada si el dispositivo aún no está registrado
        setContent {
            AlertaTheme {
                AppNav(startOnboarding = startOnboarding)
            }
        }
    }
}
