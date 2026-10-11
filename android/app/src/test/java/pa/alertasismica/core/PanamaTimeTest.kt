package pa.alertasismica.core

import org.junit.Assert.assertEquals
import org.junit.Test

class PanamaTimeTest {

    @Test
    fun formatsUtcMinusFiveWithoutDaylightSaving() {
        assertEquals("09/10/2026 17:06", PanamaTime.format(1791583565000L))
    }
}
