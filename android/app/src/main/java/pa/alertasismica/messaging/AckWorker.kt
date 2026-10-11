package pa.alertasismica.messaging

import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import pa.alertasismica.AlertaApp
import pa.alertasismica.R
import pa.alertasismica.net.ApiException
import pa.alertasismica.notify.Channels

/** Envía el ack de recepción con la hora real de llegada. Corre expedito para no retrasar la alerta. */
class AckWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val eventId = inputData.getString(KEY_EVENT_ID) ?: return Result.failure()
        val action = inputData.getString(KEY_ACTION) ?: return Result.failure()
        val receivedAt = inputData.getLong(KEY_RECEIVED_AT, System.currentTimeMillis())

        val graph = (applicationContext as AlertaApp).graph
        val deviceId = graph.prefs.deviceId
        val secret = graph.prefs.secret
        if (deviceId == null || secret == null) return Result.success() // aún no registrado

        return try {
            graph.api.ack(deviceId, secret, eventId, receivedAt, action)
            Result.success()
        } catch (e: ApiException) {
            if (e.httpCode != null && e.httpCode in 400..499 && e.httpCode != 429) Result.failure() else Result.retry()
        }
    }

    /** Requerido por WorkManager para trabajo expedito en Android 11 y anteriores. */
    override suspend fun getForegroundInfo(): ForegroundInfo {
        val notification = NotificationCompat.Builder(applicationContext, Channels.SYSTEM)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle("Enviando confirmación de alerta")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .build()
        return ForegroundInfo(NOTIFICATION_ID, notification)
    }

    companion object {
        private const val KEY_EVENT_ID = "eventId"
        private const val KEY_ACTION = "action"
        private const val KEY_RECEIVED_AT = "receivedAt"
        private const val NOTIFICATION_ID = 2001

        fun enqueue(context: Context, eventId: String, action: String, receivedAt: Long) {
            val request = OneTimeWorkRequestBuilder<AckWorker>()
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setInputData(workDataOf(KEY_EVENT_ID to eventId, KEY_ACTION to action, KEY_RECEIVED_AT to receivedAt))
                .build()
            WorkManager.getInstance(context).enqueue(request)
        }
    }
}
