package pa.alertasismica.net

import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import pa.alertasismica.core.AppJson
import pa.alertasismica.core.Guide
import pa.alertasismica.core.QuakeEvent
import pa.alertasismica.core.Settings
import pa.alertasismica.update.AppVersion
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class ApiException(val httpCode: Int?, message: String) : Exception(message)

/** Resultado de POST /v1/devices. */
data class Registration(val deviceId: String, val secret: String, val settings: Settings)

data class Health(val ok: Boolean, val serverNow: Long, val sources: Map<String, String>)

/**
 * Cliente HTTP sobre HttpURLConnection. Reintenta errores de red y 5xx con backoff;
 * los 4xx se devuelven de inmediato. Nunca escribe el secreto en logs.
 */
class ApiClient(private val baseUrl: () -> String) {

    suspend fun register(settings: Settings?, location: Pair<Double, Double>?): Registration {
        val body = buildJsonObject {
            settings?.let { put("settings", settingsJson(it)) }
            location?.let { putLocation(it) }
        }
        val json = request("POST", "/v1/devices", body, null)
        return Registration(
            deviceId = json.str("deviceId"),
            secret = json.str("secret"),
            settings = AppJson.decodeFromJsonElement(Settings.serializer(), json.getValue("settings")),
        )
    }

    suspend fun updateDevice(
        deviceId: String, secret: String,
        settings: Settings? = null, location: Pair<Double, Double>? = null,
    ): Settings? {
        val body = buildJsonObject {
            settings?.let { put("settings", settingsJson(it)) }
            location?.let { putLocation(it) }
        }
        val json = request("PUT", "/v1/devices/$deviceId", body, secret)
        return json["settings"]?.let { AppJson.decodeFromJsonElement(Settings.serializer(), it) }
    }

    /**
     * Pide un simulacro. Devuelve `online`: false significa que el teléfono no estaba conectado
     * y el simulacro quedó en cola. Lanza ApiException(429) si se pidió hace menos de 60 s.
     */
    suspend fun sendDrill(deviceId: String, secret: String): Boolean {
        val json = request("POST", "/v1/devices/$deviceId/drill", null, secret)
        return json["online"]?.jsonPrimitive?.asBool() ?: true
    }

    suspend fun ack(deviceId: String, secret: String, eventId: String, receivedAt: Long, action: String) {
        val body = buildJsonObject {
            put("eventId", eventId)
            put("receivedAt", receivedAt)
            put("action", action)
        }
        request("POST", "/v1/devices/$deviceId/ack", body, secret)
    }

    suspend fun events(limit: Int = 50): List<QuakeEvent> {
        val json = request("GET", "/v1/events?limit=$limit", null, null)
        return json.getValue("events").jsonArray.map {
            AppJson.decodeFromJsonElement(QuakeEvent.serializer(), it)
        }
    }

    /** Devuelve el JSON crudo de la guía para validarlo y guardarlo en GuideRepository. */
    suspend fun guideRaw(): String = rawRequest("GET", "/v1/guide")

    /**
     * Versión publicada de la app en el servidor (canal de autoactualización).
     * Devuelve null si el servidor no tiene versión publicada (404) o no responde.
     */
    suspend fun appVersion(): AppVersion? {
        val json = try {
            request("GET", "/v1/app-version", null, null)
        } catch (e: ApiException) {
            if (e.httpCode == 404) return null
            throw e
        }
        return AppVersion(
            versionCode = json["versionCode"]?.jsonPrimitive?.asLong()?.toInt() ?: return null,
            versionName = json["versionName"]?.jsonPrimitive?.content.orEmpty(),
            notes = json["notes"]?.jsonPrimitive?.content.orEmpty(),
            mandatory = json["mandatory"]?.jsonPrimitive?.asBool() ?: false,
            apkUrl = json["apkUrl"]?.jsonPrimitive?.content ?: "/descargas/app.apk",
        )
    }

    suspend fun health(): Health {
        val json = request("GET", "/v1/health", null, null)
        val sources = json["sources"]?.jsonObject?.mapValues { (_, v) -> describe(v) }.orEmpty()
        return Health(
            ok = json["ok"]?.jsonPrimitive?.asBool() ?: false,
            serverNow = json["now"]?.jsonPrimitive?.asLong() ?: 0L,
            sources = sources,
        )
    }

    private fun describe(element: JsonElement): String {
        val obj = element as? JsonObject ?: return element.toString()
        val ok = obj["ok"]?.jsonPrimitive?.asBool()
        return when (ok) {
            true -> "OK"
            false -> "Con error"
            null -> obj.toString()
        }
    }

    private suspend fun request(method: String, path: String, body: JsonObject?, secret: String?): JsonObject {
        val text = rawRequest(method, path, body, secret)
        return if (text.isBlank()) JsonObject(emptyMap()) else AppJson.parseToJsonElement(text).jsonObject
    }

    private suspend fun rawRequest(
        method: String, path: String, body: JsonObject? = null, secret: String? = null,
    ): String {
        var attempt = 0
        while (true) {
            try {
                return withContext(Dispatchers.IO) { execute(method, path, body, secret) }
            } catch (e: ApiException) {
                val retriable = e.httpCode == null || e.httpCode >= 500
                if (!retriable || attempt >= MAX_RETRIES) throw e
            }
            attempt++
            delay(BACKOFF_MS * attempt)
        }
    }

    private fun execute(method: String, path: String, body: JsonObject?, secret: String?): String {
        val base = baseUrl()
        if (!base.startsWith("https://")) throw ApiException(null, "La URL del servidor debe usar HTTPS.")
        val conn = (URL(base + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            if (secret != null) setRequestProperty("Authorization", "Bearer $secret")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) {
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                throw ApiException(code, errorMessage(code, text))
            }
            return text
        } catch (e: IOException) {
            throw ApiException(null, "Sin conexión con el servidor.")
        } finally {
            conn.disconnect()
        }
    }

    private fun errorMessage(code: Int, text: String): String {
        val message = try {
            AppJson.parseToJsonElement(text).jsonObject["error"]?.jsonObject?.get("message")?.jsonPrimitive?.content
        } catch (e: Exception) {
            null
        }
        return message ?: "Error $code del servidor."
    }

    private fun settingsJson(s: Settings): JsonObject = buildJsonObject {
        put("criticalRegionalMag", s.criticalRegionalMag)
        put("criticalNearMag", s.criticalNearMag)
        put("criticalNearKm", s.criticalNearKm)
        put("importantMag", s.importantMag)
        put("importantKm", s.importantKm)
        put("informativeMag", s.informativeMag?.let { kotlinx.serialization.json.JsonPrimitive(it) } ?: JsonNull)
        put("digestMinutes", s.digestMinutes)
        put("maxImportantPerHour", s.maxImportantPerHour)
    }

    private fun kotlinx.serialization.json.JsonObjectBuilder.putLocation(loc: Pair<Double, Double>) {
        putJsonObject("location") {
            put("lat", loc.first)
            put("lon", loc.second)
        }
    }

    private fun JsonObject.str(key: String): String = getValue(key).jsonPrimitive.content

    private fun kotlinx.serialization.json.JsonPrimitive.asBool(): Boolean? = content.toBooleanStrictOrNull()
    private fun kotlinx.serialization.json.JsonPrimitive.asLong(): Long? = content.toLongOrNull()

    private companion object {
        const val MAX_RETRIES = 2
        const val BACKOFF_MS = 1_000L
    }
}
