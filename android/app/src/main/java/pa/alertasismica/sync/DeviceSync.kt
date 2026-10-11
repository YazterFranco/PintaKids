package pa.alertasismica.sync

import android.content.Context
import pa.alertasismica.AlertaApp
import pa.alertasismica.core.Geo
import pa.alertasismica.core.SentLocation
import pa.alertasismica.live.AlertStreamService
import pa.alertasismica.location.LocationProvider
import pa.alertasismica.net.ApiException

/**
 * Sincroniza el dispositivo con el servidor: registro (sin cuenta de Google), ubicación y ajustes.
 * Tras registrarse arranca el canal en vivo. Lanza ApiException si algo falla; el worker decide si reintentar.
 */
object DeviceSync {

    suspend fun run(context: Context) {
        val graph = (context.applicationContext as AlertaApp).graph
        val prefs = graph.prefs
        val api = graph.api

        val location = LocationProvider.current(context)
        val rounded = location?.let { Geo.coarsen(it.first) to Geo.coarsen(it.second) }

        if (prefs.deviceId == null || prefs.secret == null) {
            val reg = api.register(prefs.settings, rounded)
            val now = System.currentTimeMillis()
            prefs.deviceId = reg.deviceId
            prefs.secret = reg.secret
            prefs.settings = reg.settings
            prefs.lastSentLocation = rounded?.let { SentLocation(it.first, it.second, now) }
            prefs.lastServerOkAt = now
            AlertStreamService.start(context)
            return
        }

        val deviceId = prefs.deviceId!!
        val secret = prefs.secret!!
        try {
            val now = System.currentTimeMillis()
            val sendLocation = rounded != null &&
                Geo.shouldSendLocation(prefs.lastSentLocation, now, rounded.first, rounded.second)
            val sendSettings = prefs.settingsPending

            if (sendLocation || sendSettings) {
                api.updateDevice(
                    deviceId, secret,
                    settings = if (sendSettings) prefs.settings else null,
                    location = if (sendLocation) rounded else null,
                )
                if (sendSettings) prefs.settingsPending = false
                if (sendLocation && rounded != null) {
                    prefs.lastSentLocation = SentLocation(rounded.first, rounded.second, now)
                }
            }
            api.health()
            prefs.lastServerOkAt = now
        } catch (e: ApiException) {
            // Secreto rechazado o dispositivo borrado: se registra de nuevo en la siguiente sincronización.
            if (e.httpCode == 401 || e.httpCode == 404) prefs.clearRegistration()
            throw e
        }
    }
}
