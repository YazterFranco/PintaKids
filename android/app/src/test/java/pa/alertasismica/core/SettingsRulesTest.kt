package pa.alertasismica.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SettingsRulesTest {

    @Test
    fun defaultsAreValid() {
        assertTrue(SettingsRules.validate(Settings()).isEmpty())
    }

    @Test
    fun nullInformativeMagMeansOffAndIsValid() {
        assertTrue(SettingsRules.validate(Settings(informativeMag = null)).isEmpty())
    }

    @Test
    fun reportsEachOutOfRangeField() {
        val errors = SettingsRules.validate(
            Settings(criticalRegionalMag = 3.9, digestMinutes = 4, maxImportantPerHour = 21),
        )
        assertEquals(3, errors.size)
    }
}
