package pa.alertasismica.live

import android.content.Context
import android.util.Log
import pa.alertasismica.core.PushPayload
import pa.alertasismica.core.SseEvent
import pa.alertasismica.core.SseParser
import pa.alertasismica.graph
import pa.alertasismica.messaging.AlertHandler
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Cliente del canal en vivo (Server-Sent Events) sobre HttpURLConnection.
 *
 * Corre en un hilo propio. Si no llega nada en READ_TIMEOUT_MS (el servidor envía latidos cada 25 s),
 * se considera caída la conexión y se reconecta con esperas de 5, 10, 20, 40 y 60 s (máximo 60 s).
 * La espera vuelve a 5 s tras una conexión correcta. Nunca escribe el secreto en logs.
 *
 * @param onState se llama en cada cambio de estado (desde el hilo del stream).
 * @param onRevoked se llama si el servidor rechaza el secreto (401) o el dispositivo ya no existe (404).
 */
class StreamClient(
    private val appContext: Context,
    private val onState: (LiveState) -> Unit,
    private val onRevoked: () -> Unit,
) {
    @Volatile private var running = false
    @Volatile private var connection: HttpURLConnection? = null
    private var thread: Thread? = null

    private enum class Outcome { ESTABLISHED, FAILED, REVOKED }

    @Synchronized
    fun start() {
        if (running) return
        running = true
        thread = Thread({ loop() }, "alerta-stream").apply {
            isDaemon = true
            start()
        }
    }

    /** Detiene el hilo y cierra la conexión abierta, si la hay. */
    fun stop() {
        running = false
        connection?.disconnect()
        thread?.interrupt()
    }

    private fun loop() {
        var attempt = 0
        while (running) {
            when (connectOnce()) {
                Outcome.REVOKED -> {
                    running = false
                    onRevoked()
                    return
                }
                Outcome.ESTABLISHED -> attempt = 0 // conexión correcta: la próxima espera empieza en 5 s
                Outcome.FAILED -> Unit
            }
            if (!running) return

            onState(LiveState.RECONECTANDO)
            val waitSeconds = BACKOFF_SECONDS[minOf(attempt, BACKOFF_SECONDS.lastIndex)]
            attempt++
            try {
                Thread.sleep(waitSeconds * 1_000L)
            } catch (e: InterruptedException) {
                return
            }
        }
    }

    /** Una conexión completa: abre el flujo, lee hasta que se cierre o falle. */
    private fun connectOnce(): Outcome {
        val prefs = appContext.graph.prefs
        val deviceId = prefs.deviceId
        val secret = prefs.secret
        if (deviceId == null || secret == null) return Outcome.REVOKED

        val base = prefs.serverUrl
        if (!base.startsWith("https://")) {
            Log.w(TAG, "La URL del servidor debe usar HTTPS.")
            return Outcome.FAILED
        }

        val conn = (URL("$base/v1/devices/$deviceId/stream").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            setRequestProperty("Accept", "text/event-stream")
            setRequestProperty("Cache-Control", "no-cache")
            setRequestProperty("Authorization", "Bearer $secret")
        }
        connection = conn
        var established = false
        try {
            val code = conn.responseCode
            if (code == 401 || code == 404) return Outcome.REVOKED
            if (code !in 200..299) {
                Log.w(TAG, "Canal en vivo: respuesta HTTP $code")
                return Outcome.FAILED
            }

            established = true
            onState(LiveState.CONECTADO)
            BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8)).use { reader ->
                val parser = SseParser()
                while (running) {
                    val line = reader.readLine() ?: break // el servidor cerró el flujo
                    parser.feed(line)?.let { dispatch(it) }
                }
            }
        } catch (e: Exception) {
            // Caída de red, timeout de lectura, stop() o un error inesperado: el bucle decide si reconectar.
            // Capturar todo evita que una excepción en este hilo tumbe el proceso.
            Log.w(TAG, "Canal en vivo interrumpido: ${e.javaClass.simpleName}")
        } finally {
            connection = null
            conn.disconnect()
        }
        return if (established) Outcome.ESTABLISHED else Outcome.FAILED
    }

    private fun dispatch(event: SseEvent) {
        if (event.event != "push") return
        val data = PushPayload.fromJson(event.data) ?: return
        try {
            AlertHandler.handle(appContext, data)
        } catch (e: Exception) {
            Log.e(TAG, "No se pudo procesar un aviso: ${e.javaClass.simpleName}")
        }
    }

    private companion object {
        const val TAG = "AlertaStream"
        const val CONNECT_TIMEOUT_MS = 15_000
        const val READ_TIMEOUT_MS = 60_000
        val BACKOFF_SECONDS = longArrayOf(5, 10, 20, 40, 60)
    }
}
