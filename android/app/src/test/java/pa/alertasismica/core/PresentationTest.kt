package pa.alertasismica.core

import org.junit.Assert.assertEquals
import org.junit.Test

class PresentationTest {

    private fun alert(action: Action, drill: Boolean = false) = PushAlert(
        type = "quake", action = action, level = "critical", eventId = "q-1",
        title = "Sismo", body = "", mag = 5.4, magMin = null, magMax = null,
        status = "preliminar", source = "igc", region = "Tonosí", lat = null, lon = null,
        depthKm = null, originTime = 1791583565000L, distanceKm = 142.0, bearing = "noreste",
        drill = drill, sentAt = null,
    )

    @Test
    fun mapsEveryActionToItsChannel() {
        assertEquals(ChannelKind.ALARM, ChannelMapping.channelFor(Action.ALARM))
        assertEquals(ChannelKind.HIGH, ChannelMapping.channelFor(Action.NOTIFY))
        assertEquals(ChannelKind.HIGH, ChannelMapping.channelFor(Action.UPDATE))
        assertEquals(ChannelKind.LOW, ChannelMapping.channelFor(Action.INFO))
        assertEquals(ChannelKind.NONE, ChannelMapping.channelFor(Action.SILENT))
    }

    @Test
    fun drillPrefixesTitleAndUpdateSuffixesIt() {
        assertEquals("SIMULACRO: Sismo", AlertText.title(alert(Action.ALARM, drill = true)))
        assertEquals("Sismo · ACTUALIZADO", AlertText.title(alert(Action.UPDATE)))
    }

    @Test
    fun detailLinesUsePanamaTimeAndDistance() {
        val lines = AlertText.detailLines(alert(Action.ALARM))
        assertEquals("Magnitud 5.4", lines[0])
        assertEquals("Estado: PRELIMINAR", lines[1])
        assertEquals("A 142 km, rumbo noreste", lines[3])
        assertEquals("Hora de Panamá: 09/10/2026 17:06", lines[4])
    }

    @Test
    fun immediateStepsComeFromDuringSection() {
        val guide = Guide(
            sections = listOf(
                GuideSection("antes", "Antes", "before", listOf(GuideItem("A"))),
                GuideSection("durante", "Durante", "during", listOf(GuideItem("B1"), GuideItem("B2"))),
            ),
        )
        assertEquals(listOf("B1", "B2"), GuideSteps.immediate(guide))
    }
}
