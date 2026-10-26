package com.pintakids.app.web

import android.content.res.AssetManager
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.IOException

/**
 * Sirve la PWA y su catálogo de dibujos desde los assets del APK (sin red, sin servidor).
 * Mismo contrato que el servidor: /v1/catalog, /v1/catalog/{pack}, /v1/catalog/{pack}/files/{file}.
 */
class LocalWeb(private val assets: AssetManager) : WebViewAssetLoader.PathHandler {

    override fun handle(path: String): WebResourceResponse? = when (val r = LocalRoutes.resolve("/$path")) {
        is Route.AppFile -> open(r.asset, r.mime)
        is Route.CatalogFile -> open(r.asset, "image/svg+xml")
        is Route.CatalogPack -> manifest(r.id)?.let { json(it.put("id", r.id)) }
        Route.CatalogIndex -> json(index())
        Route.NotFound -> null
    }

    private fun open(asset: String, mime: String): WebResourceResponse? = try {
        WebResourceResponse(mime, "utf-8", assets.open(asset))
    } catch (_: IOException) {
        null
    }

    private fun manifest(pack: String): JSONObject? = try {
        JSONObject(assets.open("catalog/$pack/manifest.json").bufferedReader().use { it.readText() })
    } catch (_: Exception) {
        null
    }

    private fun index(): JSONObject {
        val packs = JSONArray()
        var total = 0
        // Orden del catálogo: el del generador (animales, granja, …) si está; si no, alfabético.
        val ids = (assets.list("catalog") ?: emptyArray()).sortedBy { ORDER.indexOf(it).let { i -> if (i < 0) 99 else i } }
        for (id in ids) {
            val m = manifest(id) ?: continue
            val count = m.optJSONArray("files")?.length() ?: 0
            total += count
            packs.put(
                JSONObject()
                    .put("id", id)
                    .put("name", m.optString("name", id))
                    .put("name_en", m.optString("name_en", m.optString("name", id)))
                    .put("version", m.optInt("version", 1))
                    .put("fileCount", count),
            )
        }
        return JSONObject().put("packs", packs).put("total", total).put("licenses", JSONArray().put("gratis-sin-condiciones"))
    }

    private fun json(o: JSONObject) = WebResourceResponse("application/json", "utf-8", ByteArrayInputStream(o.toString().toByteArray()))

    private companion object {
        val ORDER = listOf("animales", "granja", "oceano", "dinosaurios", "vehiculos", "fantasia", "espacio", "comida")
    }
}
