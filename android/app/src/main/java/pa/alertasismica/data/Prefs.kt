package pa.alertasismica.data

import android.content.Context
import kotlinx.serialization.encodeToString
import org.json.JSONArray
import pa.alertasismica.BuildConfig
import pa.alertasismica.core.AppJson
import pa.alertasismica.core.KeyStore
import pa.alertasismica.core.SentLocation
import pa.alertasismica.core.Settings

/** Preferencias privadas de la app. Los secretos nunca se registran en logs. */
class Prefs(context: Context) : KeyStore {
    private val sp = context.getSharedPreferences("alerta_prefs", Context.MODE_PRIVATE)

    var deviceId: String?
        get() = sp.getString(K_DEVICE_ID, null)
        set(v) = sp.edit().putString(K_DEVICE_ID, v).apply()

    /** Secreto de dispositivo: solo en SharedPreferences privadas. */
    var secret: String?
        get() = sp.getString(K_SECRET, null)
        set(v) = sp.edit().putString(K_SECRET, v).apply()

    var serverUrl: String
        get() = sp.getString(K_SERVER_URL, null) ?: BuildConfig.API_BASE_URL
        set(v) = sp.edit().putString(K_SERVER_URL, v.trimEnd('/')).apply()

    var settings: Settings
        get() = try {
            sp.getString(K_SETTINGS, null)?.let { AppJson.decodeFromString<Settings>(it) } ?: Settings()
        } catch (e: Exception) {
            Settings()
        }
        set(v) = sp.edit().putString(K_SETTINGS, AppJson.encodeToString(v)).apply()

    var lastSentLocation: SentLocation?
        get() {
            if (!sp.contains(K_LOC_LAT)) return null
            return SentLocation(
                lat = Double.fromBits(sp.getLong(K_LOC_LAT, 0L)),
                lon = Double.fromBits(sp.getLong(K_LOC_LON, 0L)),
                sentAt = sp.getLong(K_LOC_AT, 0L),
            )
        }
        set(v) {
            val e = sp.edit()
            if (v == null) {
                e.remove(K_LOC_LAT).remove(K_LOC_LON).remove(K_LOC_AT)
            } else {
                e.putLong(K_LOC_LAT, v.lat.toBits()).putLong(K_LOC_LON, v.lon.toBits()).putLong(K_LOC_AT, v.sentAt)
            }
            e.apply()
        }

    /** Ajustes guardados en el teléfono que aún no llegaron al servidor. */
    var settingsPending: Boolean
        get() = sp.getBoolean(K_SETTINGS_PENDING, false)
        set(v) = sp.edit().putBoolean(K_SETTINGS_PENDING, v).apply()

    var lastServerOkAt: Long
        get() = sp.getLong(K_LAST_OK, 0L)
        set(v) = sp.edit().putLong(K_LAST_OK, v).apply()

    var onboardingDone: Boolean
        get() = sp.getBoolean(K_ONBOARDING, false)
        set(v) = sp.edit().putBoolean(K_ONBOARDING, v).apply()

    /** Claves de deduplicación persistidas (KeyStore). */
    override fun load(): List<String> {
        val raw = sp.getString(K_DEDUPE, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            List(arr.length()) { arr.getString(it) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    override fun save(keys: List<String>) {
        sp.edit().putString(K_DEDUPE, JSONArray(keys).toString()).apply()
    }

    /** Borra el registro local (secreto rechazado, cambio de servidor). La siguiente sincronización vuelve a registrar. */
    fun clearRegistration() {
        sp.edit().remove(K_DEVICE_ID).remove(K_SECRET).remove(K_LAST_OK).apply()
    }

    private companion object {
        const val K_DEVICE_ID = "device_id"
        const val K_SECRET = "device_secret"
        const val K_SERVER_URL = "server_url"
        const val K_SETTINGS = "settings_json"
        const val K_LOC_LAT = "loc_lat"
        const val K_LOC_LON = "loc_lon"
        const val K_LOC_AT = "loc_at"
        const val K_LAST_OK = "last_server_ok"
        const val K_ONBOARDING = "onboarding_done"
        const val K_DEDUPE = "dedupe_keys"
        const val K_SETTINGS_PENDING = "settings_pending"
    }
}
