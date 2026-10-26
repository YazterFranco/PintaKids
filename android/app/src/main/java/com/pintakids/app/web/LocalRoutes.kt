package com.pintakids.app.web

/**
 * Rutas de la app empaquetada. La PWA pide sus archivos con rutas absolutas (/app.js, /v1/catalog…)
 * igual que en la web; aquí se traducen a los assets del APK. Puro: se prueba en la JVM.
 */
sealed class Route {
    data class AppFile(val asset: String, val mime: String) : Route()
    data object CatalogIndex : Route()
    data class CatalogPack(val id: String) : Route()
    data class CatalogFile(val asset: String) : Route()
    data object NotFound : Route()
}

object LocalRoutes {
    private val PACK_ID = Regex("^[a-z0-9][a-z0-9-]{0,38}$")
    private val SVG_FILE = Regex("^[a-z0-9][a-z0-9._-]{0,58}\\.svg$", RegexOption.IGNORE_CASE)
    private val SAFE_SEGMENT = Regex("^[A-Za-z0-9._-]+$")

    private val MIME = mapOf(
        "html" to "text/html",
        "js" to "text/javascript",
        "mjs" to "text/javascript",
        "css" to "text/css",
        "json" to "application/json",
        "webmanifest" to "application/manifest+json",
        "svg" to "image/svg+xml",
        "png" to "image/png",
        "jpg" to "image/jpeg",
        "ttf" to "font/ttf",
        "woff2" to "font/woff2",
        "txt" to "text/plain",
    )

    fun mimeOf(name: String): String = MIME[name.substringAfterLast('.', "").lowercase()] ?: "application/octet-stream"

    fun resolve(path: String): Route {
        val segments = path.trim('/').split('/').filter { it.isNotEmpty() }
        if (segments.any { it == ".." || it == "." || !SAFE_SEGMENT.matches(it) }) return Route.NotFound

        if (segments.firstOrNull() == "v1") {
            if (segments.getOrNull(1) != "catalog") return Route.NotFound
            return when (segments.size) {
                2 -> Route.CatalogIndex
                3 -> if (PACK_ID.matches(segments[2])) Route.CatalogPack(segments[2]) else Route.NotFound
                5 -> {
                    val (pack, files, file) = Triple(segments[2], segments[3], segments[4])
                    if (PACK_ID.matches(pack) && files == "files" && SVG_FILE.matches(file)) Route.CatalogFile("catalog/$pack/$file") else Route.NotFound
                }
                else -> Route.NotFound
            }
        }

        val rel = if (segments.isEmpty()) "index.html" else segments.joinToString("/")
        return Route.AppFile("app/$rel", mimeOf(rel))
    }
}
