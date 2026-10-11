package pa.alertasismica.location

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.tasks.await
import pa.alertasismica.platform.Permissions

/** Obtiene una posición aproximada en segundo plano. Devuelve null si no hay permiso o no hay fix. */
object LocationProvider {

    @SuppressLint("MissingPermission")
    suspend fun current(context: Context): Pair<Double, Double>? {
        if (!Permissions.anyLocation(context)) return null
        val client = LocationServices.getFusedLocationProviderClient(context)
        val cts = CancellationTokenSource()
        return try {
            val loc = client.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, cts.token).await()
            loc?.let { it.latitude to it.longitude }
        } catch (e: Exception) {
            null
        } finally {
            cts.cancel()
        }
    }
}
