package com.pintakids.app.web

import org.junit.Assert.assertEquals
import org.junit.Test

class LocalRoutesTest {

    @Test
    fun raizSirveIndex() {
        assertEquals(Route.AppFile("app/index.html", "text/html"), LocalRoutes.resolve("/"))
        assertEquals(Route.AppFile("app/index.html", "text/html"), LocalRoutes.resolve("/index.html"))
    }

    @Test
    fun modulosJsConMimeCorrecto() {
        // los ES modules exigen un MIME de JavaScript o el WebView los bloquea
        assertEquals(Route.AppFile("app/modes/learn.js", "text/javascript"), LocalRoutes.resolve("/modes/learn.js"))
        assertEquals(Route.AppFile("app/style.css", "text/css"), LocalRoutes.resolve("/style.css"))
        assertEquals(Route.AppFile("app/i18n/es.json", "application/json"), LocalRoutes.resolve("/i18n/es.json"))
        assertEquals(Route.AppFile("app/manifest.webmanifest", "application/manifest+json"), LocalRoutes.resolve("/manifest.webmanifest"))
        assertEquals(Route.AppFile("app/assets/fonts/Baloo2-Variable.ttf", "font/ttf"), LocalRoutes.resolve("/assets/fonts/Baloo2-Variable.ttf"))
    }

    @Test
    fun catalogo() {
        assertEquals(Route.CatalogIndex, LocalRoutes.resolve("/v1/catalog"))
        assertEquals(Route.CatalogIndex, LocalRoutes.resolve("/v1/catalog/"))
        assertEquals(Route.CatalogPack("animales"), LocalRoutes.resolve("/v1/catalog/animales"))
        assertEquals(Route.CatalogFile("catalog/animales/gato.svg"), LocalRoutes.resolve("/v1/catalog/animales/files/gato.svg"))
    }

    @Test
    fun nuncaSaleDeSusCarpetas() {
        assertEquals(Route.NotFound, LocalRoutes.resolve("/../secreto.txt"))
        assertEquals(Route.NotFound, LocalRoutes.resolve("/modes/../../x.js"))
        assertEquals(Route.NotFound, LocalRoutes.resolve("/v1/catalog/../x"))
        assertEquals(Route.NotFound, LocalRoutes.resolve("/v1/catalog/animales/files/../../x.svg"))
        assertEquals(Route.NotFound, LocalRoutes.resolve("/v1/catalog/animales/files/gato.png"))
        assertEquals(Route.NotFound, LocalRoutes.resolve("/v1/app-version"))
    }
}
