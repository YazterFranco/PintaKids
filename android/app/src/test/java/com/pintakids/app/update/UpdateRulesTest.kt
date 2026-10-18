package com.pintakids.app.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateRulesTest {

    private val jsonOk = """{"app":"pintakids","versionCode":3,"versionName":"1.2.0","notes":"más brochas","mandatory":false,"apkUrl":"/descargas/app.apk"}"""

    @Test
    fun aceptaElCanalPintakids() {
        val v = UpdateRules.parse(jsonOk)!!
        assertEquals(3, v.versionCode)
        assertEquals("1.2.0", v.versionName)
        assertTrue(v.apkUrl.contains("app.apk"))
    }

    @Test
    fun ignoraOtroCanalLaAppDeSismos() {
        val otra = jsonOk.replace("pintakids", "alerta-sismica-pa")
        assertEquals(null, UpdateRules.parse(otra))
    }

    @Test
    fun ignoraJsonRotoOVersionCero() {
        assertEquals(null, UpdateRules.parse("{"))
        assertEquals(null, UpdateRules.parse("""{"app":"pintakids","versionCode":0}"""))
        assertEquals(null, UpdateRules.parse("""{"app":"pintakids"}"""))
    }

    @Test
    fun soloActualizaSiElCodigoEsMayor() {
        val v = UpdateRules.parse(jsonOk)!!
        assertTrue(UpdateRules.shouldUpdate(v, 2))
        assertFalse("igual no debe actualizar", UpdateRules.shouldUpdate(v, 3))
        assertFalse("menor no debe actualizar", UpdateRules.shouldUpdate(v, 4))
        assertFalse(UpdateRules.shouldUpdate(null, 1))
    }

    @Test
    fun armaUrlDeDescargaSinDoblesBarras() {
        val v = UpdateRules.parse(jsonOk)!!
        assertEquals("https://x.up.railway.app/descargas/app.apk", UpdateRules.apkUrl("https://x.up.railway.app/", v))
        assertEquals("https://cdn.app/a.apk", UpdateRules.apkUrl("https://x/", v.copy(apkUrl = "https://cdn.app/a.apk")))
    }
}
