package pa.alertasismica

import android.app.Application
import pa.alertasismica.core.DedupeRegistry
import pa.alertasismica.data.EventStore
import pa.alertasismica.data.GuideRepository
import pa.alertasismica.data.Prefs
import pa.alertasismica.net.ApiClient
import pa.alertasismica.notify.Channels
import pa.alertasismica.sync.SyncScheduler

class AlertaApp : Application() {

    val graph: AppGraph by lazy { AppGraph(this) }

    override fun onCreate() {
        super.onCreate()
        Channels.createAll(this)
        SyncScheduler.schedulePeriodic(this)
    }
}

/** Dependencias manuales de la app; sin inyección para mantener el proyecto simple. */
class AppGraph(app: AlertaApp) {
    val prefs = Prefs(app)
    val events = EventStore(app)
    val guides = GuideRepository(app)
    val dedupe = DedupeRegistry(prefs)
    val api = ApiClient { prefs.serverUrl }
}

val android.content.Context.graph: AppGraph
    get() = (applicationContext as AlertaApp).graph
