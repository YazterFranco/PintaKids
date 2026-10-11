package pa.alertasismica.live

import android.annotation.SuppressLint
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import pa.alertasismica.MainActivity
import pa.alertasismica.R
import pa.alertasismica.graph
import pa.alertasismica.notify.Channels
import pa.alertasismica.sync.SyncScheduler

/**
 * Servicio en primer plano que mantiene abierto el canal en vivo mientras el dispositivo está registrado.
 * Muestra una notificación fija (canal "Estado", baja importancia) con el estado de la conexión.
 */
class AlertStreamService : Service() {

    private var client: StreamClient? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Debe llamarse a startForeground enseguida, aunque luego se detenga el servicio.
        startInForeground(LiveStatus.state.value)

        if (!isRegistered()) {
            stopSelf(startId)
            return START_NOT_STICKY
        }
        if (client == null) {
            client = StreamClient(
                appContext = applicationContext,
                onState = { state ->
                    LiveStatus.set(state)
                    updateNotification(state)
                },
                onRevoked = { onRevoked() },
            ).also { it.start() }
        }
        return START_STICKY
    }

    /** Android 15+: un servicio dataSync tiene un tope de tiempo por día. Se detiene limpiamente; la app lo vuelve a arrancar al abrirse. */
    override fun onTimeout(startId: Int, fgsType: Int) {
        Log.w(TAG, "Android detuvo el canal en vivo por límite de tiempo del servicio")
        LiveStatus.set(LiveState.SIN_CONEXION)
        client?.stop()
        client = null
        stopSelf(startId)
    }

    override fun onDestroy() {
        client?.stop()
        client = null
        LiveStatus.set(LiveState.SIN_CONEXION)
        super.onDestroy()
    }

    /** El servidor rechazó el secreto o el dispositivo ya no existe: se borra el registro y se vuelve a registrar. */
    private fun onRevoked() {
        Log.w(TAG, "El servidor rechazó el dispositivo; se vuelve a registrar")
        client = null
        graph.prefs.clearRegistration()
        SyncScheduler.runNow(this)
        stopSelf()
    }

    private fun isRegistered(): Boolean {
        val prefs = graph.prefs
        return prefs.deviceId != null && prefs.secret != null
    }

    private fun startInForeground(state: LiveState) {
        val notification = buildNotification(state)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    @SuppressLint("MissingPermission")
    private fun updateNotification(state: LiveState) {
        // Sin permiso POST_NOTIFICATIONS el sistema simplemente no la muestra; el servicio sigue activo.
        NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, buildNotification(state))
    }

    private fun buildNotification(state: LiveState): Notification {
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, Channels.LIVE)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle("Alerta sísmica activa · ${state.label}")
            .setContentText("Recibe avisos de sismos en tiempo real.")
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    companion object {
        private const val TAG = "AlertaStream"
        private const val NOTIFICATION_ID = 3001

        /**
         * Arranca el servicio si el dispositivo ya está registrado. Android puede impedir el arranque
         * (app en segundo plano, arranque del sistema en Android 15+); entonces se reintenta al abrir la app.
         */
        fun start(context: Context) {
            if (context.graph.prefs.deviceId == null) return
            try {
                ContextCompat.startForegroundService(context, Intent(context, AlertStreamService::class.java))
            } catch (e: IllegalStateException) {
                Log.w(TAG, "Android no permite iniciar el canal en vivo ahora")
            } catch (e: SecurityException) {
                Log.w(TAG, "Falta un permiso para iniciar el canal en vivo")
            }
        }
    }
}
