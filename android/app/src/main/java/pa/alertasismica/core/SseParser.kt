package pa.alertasismica.core

/** Un evento Server-Sent Events completo. `id` es null si el evento no traía línea `id:`. */
data class SseEvent(val id: String?, val event: String, val data: String)

/**
 * Parser SSE línea a línea, sin dependencias de Android.
 *
 * Reglas aplicadas (https://html.spec.whatwg.org/multipage/server-sent-events.html):
 * - Las líneas que empiezan por ":" son comentarios (latidos) y se ignoran.
 * - `data:` acumula líneas; varias se unen con "\n".
 * - La línea vacía despacha el evento. Sin líneas `data:` no se emite nada.
 * - `event:` por defecto es "message". `retry:` se ignora: la espera la decide el cliente.
 * - El `id` vale solo para su evento (no se arrastra al siguiente), así que un evento sin `id:` tiene id null.
 * - Un solo espacio tras los dos puntos se quita; el resto del valor se conserva tal cual.
 */
class SseParser {
    private val dataLines = mutableListOf<String>()
    private var eventName: String? = null
    private var eventId: String? = null

    /** Procesa una línea (sin el salto de línea final). Devuelve el evento cuando la línea está vacía y hay datos. */
    fun feed(line: String): SseEvent? {
        if (line.isEmpty()) return dispatch()
        if (line.startsWith(":")) return null

        val colon = line.indexOf(':')
        val field = if (colon == -1) line else line.substring(0, colon)
        var value = if (colon == -1) "" else line.substring(colon + 1)
        if (value.startsWith(" ")) value = value.substring(1)

        when (field) {
            "event" -> eventName = value
            "data" -> dataLines += value
            "id" -> eventId = value
            else -> Unit // "retry" y campos desconocidos: se ignoran
        }
        return null
    }

    private fun dispatch(): SseEvent? {
        if (dataLines.isEmpty()) {
            reset()
            return null
        }
        val event = SseEvent(
            id = eventId,
            event = eventName ?: "message",
            data = dataLines.joinToString("\n"),
        )
        reset()
        return event
    }

    private fun reset() {
        dataLines.clear()
        eventName = null
        eventId = null
    }
}
