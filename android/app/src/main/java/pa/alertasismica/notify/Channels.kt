package pa.alertasismica.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build

/** Canales de notificación. El sufijo _v1 permite cambiar la configuración en el futuro (Android no la permite editar). */
object Channels {
    const val ALARM = "alerta_alarma_v1"
    const val HIGH = "alerta_alta_v1"
    const val LOW = "informativo_v1"
    const val SYSTEM = "sistema_v1"
    const val LIVE = "estado_v1"

    fun createAll(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(NotificationManager::class.java) ?: return

        val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        val alarmAttrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        nm.createNotificationChannel(
            NotificationChannel(ALARM, "Alarma sísmica", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Sismos críticos cerca de Panamá: pantalla completa y sonido de alarma."
                setSound(alarmSound, alarmAttrs)
                enableVibration(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                setBypassDnd(true)
            },
        )

        nm.createNotificationChannel(
            NotificationChannel(HIGH, "Sismos importantes", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Sismos importantes y correcciones de avisos previos."
                enableVibration(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            },
        )

        nm.createNotificationChannel(
            NotificationChannel(LOW, "Información sísmica", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Resúmenes y avisos informativos, sin sonido."
                setSound(null, null)
                enableVibration(false)
            },
        )

        nm.createNotificationChannel(
            NotificationChannel(LIVE, "Estado", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Notificación fija que indica que la app está escuchando avisos de sismos."
                setSound(null, null)
                enableVibration(false)
            },
        )

        nm.createNotificationChannel(
            NotificationChannel(SYSTEM, "Sincronización", NotificationManager.IMPORTANCE_MIN).apply {
                description = "Envío de confirmaciones al servidor."
                setSound(null, null)
            },
        )
    }
}
