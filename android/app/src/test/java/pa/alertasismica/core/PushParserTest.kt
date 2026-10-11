package pa.alertasismica.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PushParserTest {

    @Test
    fun parsesAlarmWithNumbersAndDrillFlag() {
        val alert = PushParser.parse(
            mapOf(
                "type" to "quake", "action" to "alarm", "level" to "critical",
                "eventId" to "q-1", "title" to "Sismo fuerte", "body" to "Cúbrase",
                "mag" to "5.4", "status" to "revisado", "lat" to "7.46", "lon" to "-80.27",
                "originTime" to "1791583565000", "distanceKm" to "142", "bearing" to "noreste",
                "drill" to "1", "sentAt" to "1791583570000",
            ),
        )!!
        assertEquals(Action.ALARM, alert.action)
        assertEquals(5.4, alert.mag!!, 0.0001)
        assertEquals(1791583565000L, alert.originTime)
        assertEquals(142.0, alert.distanceKm!!, 0.0001)
        assertTrue(alert.drill)
    }

    @Test
    fun rejectsUnknownActionOrMissingEventId() {
        assertNull(PushParser.parse(mapOf("action" to "explode", "eventId" to "q-1")))
        assertNull(PushParser.parse(mapOf("action" to "notify")))
        assertNull(PushParser.parse(mapOf("action" to "notify", "eventId" to "  ")))
    }

    @Test
    fun drillIsFalseUnlessExactlyOne() {
        val alert = PushParser.parse(mapOf("action" to "info", "eventId" to "q-2", "drill" to "0"))!!
        assertFalse(alert.drill)
    }

    @Test
    fun buildsFallbackBodyWhenServerSendsNone() {
        val alert = PushParser.parse(
            mapOf("action" to "notify", "eventId" to "q-3", "mag" to "4.8", "region" to "Panamá"),
        )!!
        assertEquals("Magnitud 4.8 · Panamá", alert.body)
        assertEquals("Sismo reportado", alert.title)
    }
}
