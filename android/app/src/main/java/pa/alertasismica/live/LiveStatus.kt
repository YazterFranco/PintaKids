package pa.alertasismica.live

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Estado del canal en vivo tal como lo ve el usuario. */
enum class LiveState(val label: String) {
    CONECTADO("conectado"),
    RECONECTANDO("reconectando"),
    SIN_CONEXION("sin conexión"),
}

/**
 * Estado observable del canal en vivo, para la pantalla de Inicio.
 * Escrito desde el hilo del stream y el servicio; StateFlow es seguro entre hilos.
 */
object LiveStatus {
    /** Tiempo sin conexión a partir del cual la app avisa de posibles retrasos. */
    const val PROLONGED_MS = 10L * 60 * 1000

    private val stateFlow = MutableStateFlow(LiveState.SIN_CONEXION)
    private val sinceFlow = MutableStateFlow<Long?>(System.currentTimeMillis())

    val state: StateFlow<LiveState> = stateFlow.asStateFlow()

    /** Desde cuándo no hay conexión; null mientras está conectado. */
    val desconectadoDesde: StateFlow<Long?> = sinceFlow.asStateFlow()

    @Synchronized
    fun set(newState: LiveState, now: Long = System.currentTimeMillis()) {
        stateFlow.value = newState
        when {
            newState == LiveState.CONECTADO -> sinceFlow.value = null
            sinceFlow.value == null -> sinceFlow.value = now
        }
    }

    /** True si no hay conexión desde hace más de PROLONGED_MS. */
    fun sinConexionProlongada(now: Long): Boolean {
        val since = sinceFlow.value ?: return false
        return stateFlow.value != LiveState.CONECTADO && now - since >= PROLONGED_MS
    }
}
