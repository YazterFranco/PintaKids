package pa.alertasismica.messaging

import android.content.Context
import pa.alertasismica.core.PushParser
import pa.alertasismica.core.toQuakeEvent
import pa.alertasismica.graph
import pa.alertasismica.notify.AlertNotifier

/**
 * Procesa un aviso push recibido por el canal en vivo. Orden: deduplicar, guardar en la lista local,
 * mostrar y, después de mostrar, encolar la confirmación (ack) con la hora de recepción.
 */
object AlertHandler {

    fun handle(context: Context, data: Map<String, String>) {
        val alert = PushParser.parse(data) ?: return
        val now = System.currentTimeMillis()
        val graph = context.graph

        if (!graph.dedupe.markIfNew(alert.eventId, alert.action)) return

        if (!alert.drill) {
            alert.toQuakeEvent(now)?.let { graph.events.upsert(listOf(it)) }
        }

        AlertNotifier(context).show(alert)
        AckWorker.enqueue(context, alert.eventId, alert.action.wire, now)
    }
}
