package pa.alertasismica.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat

/** Cierra la notificación al pulsar "Entendido". */
class DismissReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val tag = intent.getStringExtra(AlertNotifier.EXTRA_TAG)
        NotificationManagerCompat.from(context).cancel(tag, AlertNotifier.NOTIFICATION_ID)
    }
}
