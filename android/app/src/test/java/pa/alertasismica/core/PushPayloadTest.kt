package pa.alertasismica.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PushPayloadTest {

    @Test
    fun convertsEveryValueToText() {
        val map = PushPayload.fromJson("""{"type":"quake","action":"alarm","mag":"5.4"}""")
        assertEquals(mapOf("type" to "quake", "action" to "alarm", "mag" to "5.4"), map)
    }

    @Test
    fun rejectsTextThatIsNotAnObject() {
        assertNull(PushPayload.fromJson("{no es json"))
        assertNull(PushPayload.fromJson("[1,2,3]"))
    }
}
