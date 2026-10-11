package pa.alertasismica.live

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Tras reiniciar el teléfono, vuelve a arrancar el canal en vivo si el dispositivo ya está registrado. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        AlertStreamService.start(context)
    }
}
