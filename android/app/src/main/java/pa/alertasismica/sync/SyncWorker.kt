package pa.alertasismica.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import pa.alertasismica.net.ApiException
import java.util.concurrent.TimeUnit

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            DeviceSync.run(applicationContext)
            Result.success()
        } catch (e: ApiException) {
            // 4xx (salvo 429) no se arregla reintentando; el resto sí.
            val permanent = e.httpCode != null && e.httpCode in 400..499 && e.httpCode != 429
            if (permanent) Result.failure() else Result.retry()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}

object SyncScheduler {
    private val networkOnly = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    /** Sincronización inmediata (primer inicio, cambio de token, cambios de ajustes). */
    fun runNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(networkOnly)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_NOW, ExistingWorkPolicy.REPLACE, request)
    }

    /** Cada ~15 min: ubicación si cambió, y comprobación de conexión con el servidor. */
    fun schedulePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(networkOnly)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(UNIQUE_PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    private const val UNIQUE_NOW = "device-sync-now"
    private const val UNIQUE_PERIODIC = "device-sync-periodic"
}
