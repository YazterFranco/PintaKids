package pa.alertasismica.core

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DedupeTest {

    private class MemoryStore : KeyStore {
        var keys: List<String> = emptyList()
        override fun load(): List<String> = keys
        override fun save(keys: List<String>) { this.keys = keys }
    }

    @Test
    fun sameEventAndActionIsShownOnce() {
        val registry = DedupeRegistry(MemoryStore())
        assertTrue(registry.markIfNew("q-1", Action.ALARM))
        assertFalse(registry.markIfNew("q-1", Action.ALARM))
    }

    @Test
    fun updateOfSameEventIsStillNew() {
        val registry = DedupeRegistry(MemoryStore())
        registry.markIfNew("q-1", Action.ALARM)
        assertTrue(registry.markIfNew("q-1", Action.UPDATE))
    }

    @Test
    fun capacityIsBounded() {
        val store = MemoryStore()
        val registry = DedupeRegistry(store, capacity = 2)
        registry.markIfNew("a", Action.INFO)
        registry.markIfNew("b", Action.INFO)
        registry.markIfNew("c", Action.INFO)
        assertTrue(store.keys.size == 2)
    }
}
