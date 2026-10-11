package pa.alertasismica.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GeoTest {

    @Test
    fun oneDegreeOfLatitudeIsAbout111Km() {
        assertEquals(111.19, Geo.haversineKm(0.0, 0.0, 1.0, 0.0), 0.05)
    }

    @Test
    fun bearingNamesCardinalDirections() {
        assertEquals("norte", Geo.bearingName(9.0, -79.5, 10.0, -79.5))
        assertEquals("este", Geo.bearingName(9.0, -79.5, 9.0, -78.5))
    }

    @Test
    fun coarsenRoundsToFiveHundredthsOfDegree() {
        assertEquals(7.45, Geo.coarsen(7.4616), 1e-9)
    }

    @Test
    fun locationIsSentOnlyWhenMovedOrStale() {
        val last = SentLocation(9.0, -79.5, sentAt = 0L)
        val oneHour = 60L * 60 * 1000
        assertTrue(Geo.shouldSendLocation(null, 0L, 9.0, -79.5))
        assertFalse(Geo.shouldSendLocation(last, oneHour, 9.0, -79.5))
        assertTrue(Geo.shouldSendLocation(last, oneHour, 9.1, -79.5)) // ~11 km
        assertTrue(Geo.shouldSendLocation(last, 6 * oneHour, 9.0, -79.5))
        assertFalse(Geo.shouldSendLocation(last, 6 * oneHour - 1, 9.0, -79.5))
    }
}
