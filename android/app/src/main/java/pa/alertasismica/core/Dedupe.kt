package pa.alertasismica.core

/** Almacenamiento mínimo de claves, implementado con SharedPreferences en Android. */
interface KeyStore {
    fun load(): List<String>
    fun save(keys: List<String>)
}

/** Evita mostrar dos veces la misma (eventId + action), incluso tras reinicios del proceso. */
class DedupeRegistry(private val store: KeyStore, private val capacity: Int = 500) {

    @Synchronized
    fun markIfNew(eventId: String, action: Action): Boolean {
        val key = "$eventId|${action.wire}"
        val keys = store.load().toMutableList()
        if (key in keys) return false
        keys.add(key)
        store.save(keys.takeLast(capacity))
        return true
    }
}
