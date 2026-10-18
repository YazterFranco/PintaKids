package com.pintakids.app.update

import org.json.JSONObject

/**
 * Reglas puras del canal de autoactualización (testeables sin Android).
 * Mismo contrato que el servidor Pintakids: GET /v1/app-version.
 */
data class AppVersion(
    val versionCode: Int,
    val versionName: String,
    val notes: String,
    val mandatory: Boolean,
    val apkUrl: String,
)

object UpdateRules {
    fun parse(json: String): AppVersion? {
        val o = try {
            JSONObject(json)
        } catch (_: Exception) {
            return null
        }
        if (o.optString("app") != "pintakids") return null
        val code = o.optInt("versionCode", 0)
        if (code <= 0) return null
        return AppVersion(
            versionCode = code,
            versionName = o.optString("versionName", "$code"),
            notes = o.optString("notes", ""),
            mandatory = o.optBoolean("mandatory", false),
            apkUrl = o.optString("apkUrl", "/descargas/app.apk"),
        )
    }

    /** Solo actualizar si la del servidor es MÁS nueva (nunca degradar o reinstalar la misma). */
    fun shouldUpdate(remote: AppVersion?, installedCode: Int): Boolean =
        remote != null && remote.versionCode > installedCode

    /** URL absoluta de descarga relative al servidor. */
    fun apkUrl(baseUrl: String, version: AppVersion): String =
        if (version.apkUrl.startsWith("http")) version.apkUrl else baseUrl.trimEnd('/') + version.apkUrl
}
