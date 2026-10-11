package pa.alertasismica.notify

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.pm.PackageManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import pa.alertasismica.MainActivity
import pa.alertasismica.R
import pa.alertasismica.core.Action
import pa.alertasismica.core.AlertText
import pa.alertasismica.core.ChannelKind
import pa.alertasismica.core.ChannelMapping
import pa.alertasismica.core.PushAlert
import pa.alertasismica.ui.alert.AlertActivity

/**
 * Muestra la notificación de una alerta. Usar el eventId como `tag` y un id fijo
 * hace que una actualización reemplace la notificación anterior del mismo sismo.
 */
class AlertNotifier(private val context: Context) {

    @SuppressLint("MissingPermission")
    fun show(alert: PushAlert) {
        val kind = ChannelMapping.channelFor(alert.action)
        if (kind == ChannelKind.NONE) return
        if (!canPostNotifications()) return

        val channelId = when (kind) {
            ChannelKind.ALARM -> Channels.ALARM
            ChannelKind.HIGH -> Channels.HIGH
            ChannelKind.LOW -> Channels.LOW
            ChannelKind.NONE -> return
        }
        val title = AlertText.title(alert)
        val lines = AlertText.detailLines(alert)
        val summary = lines.firstOrNull().orEmpty()
        val bigText = (listOf(alert.body).filter { it.isNotBlank() } + lines).joinToString("\n")

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(summary)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bigText))
            .setPriority(if (kind == ChannelKind.LOW) NotificationCompat.PRIORITY_LOW else NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOnlyAlertOnce(alert.action == Action.UPDATE)
            .setContentIntent(mainIntent())
            .addAction(0, "Entendido", dismissIntent(alert.eventId))

        if (kind == ChannelKind.ALARM) {
            builder.setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(alertIntent(alert, title, lines), true)
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(null)
        }

        NotificationManagerCompat.from(context).notify(alert.eventId, NOTIFICATION_ID, builder.build())
    }

    /** Sin permiso POST_NOTIFICATIONS (Android 13+) no se muestra nada; la lista local sí se actualiza. */
    private fun canPostNotifications(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    private fun mainIntent(): PendingIntent = PendingIntent.getActivity(
        context, 0,
        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun alertIntent(alert: PushAlert, title: String, lines: List<String>): PendingIntent {
        val intent = Intent(context, AlertActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(AlertActivity.EXTRA_TAG, alert.eventId)
            .putExtra(AlertActivity.EXTRA_TITLE, title)
            .putExtra(AlertActivity.EXTRA_MAG, alert.mag ?: -1.0)
            .putStringArrayListExtra(AlertActivity.EXTRA_LINES, ArrayList(lines))
            .putExtra(AlertActivity.EXTRA_DRILL, alert.drill)
            .putExtra(AlertActivity.EXTRA_REVISADO, alert.status == "revisado")
        return PendingIntent.getActivity(
            context, alert.eventId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun dismissIntent(eventId: String): PendingIntent {
        val intent = Intent(context, DismissReceiver::class.java).putExtra(EXTRA_TAG, eventId)
        return PendingIntent.getBroadcast(
            context, ("dismiss-$eventId").hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    companion object {
        const val NOTIFICATION_ID = 1001
        const val EXTRA_TAG = "pa.alertasismica.EXTRA_TAG"
    }
}
