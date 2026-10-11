package pa.alertasismica.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SseParserTest {

    /** Alimenta todas las líneas y devuelve los eventos emitidos, en orden. */
    private fun feedAll(vararg lines: String): List<SseEvent> {
        val parser = SseParser()
        return lines.mapNotNull { parser.feed(it) }
    }

    @Test
    fun commentLinesAreHeartbeatsAndEmitNothing() {
        val events = feedAll(": latido", "", ": latido", "")
        assertTrue(events.isEmpty())
    }

    @Test
    fun emitsPushEventWithIdEventAndData() {
        val events = feedAll("id: 42", "event: push", "data: {\"type\":\"quake\"}", "")
        assertEquals(1, events.size)
        assertEquals("42", events[0].id)
        assertEquals("push", events[0].event)
        assertEquals("{\"type\":\"quake\"}", events[0].data)
    }

    @Test
    fun joinsSeveralDataLinesWithNewline() {
        val events = feedAll("event: push", "data: primera", "data: segunda", "")
        assertEquals("primera\nsegunda", events[0].data)
    }

    @Test
    fun eventWithoutIdHasNullIdAndDoesNotInheritPrevious() {
        val events = feedAll("id: 7", "event: push", "data: a", "", "event: push", "data: b", "")
        assertEquals("7", events[0].id)
        assertNull(events[1].id)
    }

    @Test
    fun blankLineSeparatesEvents() {
        val events = feedAll(
            "id: 1", "event: push", "data: a", "",
            "id: 2", "event: push", "data: b", "",
        )
        assertEquals(listOf("a", "b"), events.map { it.data })
        assertEquals(listOf("1", "2"), events.map { it.id })
    }

    @Test
    fun missingEventFieldDefaultsToMessage() {
        val events = feedAll("data: x", "")
        assertEquals("message", events[0].event)
    }

    @Test
    fun retryFieldEmitsNothing() {
        val events = feedAll("retry: 3000", "")
        assertTrue(events.isEmpty())
    }

    @Test
    fun blankLineWithoutDataEmitsNothing() {
        val events = feedAll("event: push", "")
        assertTrue(events.isEmpty())
    }

    @Test
    fun valueWithoutSpaceAfterColonIsKept() {
        val events = feedAll("data:sinEspacio", "")
        assertEquals("sinEspacio", events[0].data)
    }
}
