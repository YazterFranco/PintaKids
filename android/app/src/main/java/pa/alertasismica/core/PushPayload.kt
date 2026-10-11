package pa.alertasismica.core

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Convierte el JSON de `data` de un evento push en el mapa plano que entiende PushParser. */
object PushPayload {

    /** Devuelve null si el texto no es un objeto JSON. Todos los valores quedan como texto. */
    fun fromJson(text: String): Map<String, String>? {
        return try {
            val obj = AppJson.parseToJsonElement(text) as? JsonObject ?: return null
            obj.mapValues { (_, value) ->
                (value as? JsonPrimitive)?.content ?: value.toString()
            }
        } catch (e: Exception) {
            null
        }
    }
}
