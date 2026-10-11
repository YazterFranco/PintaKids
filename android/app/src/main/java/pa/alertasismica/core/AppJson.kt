package pa.alertasismica.core

import kotlinx.serialization.json.Json

/** Configuración JSON única: tolerante a campos nuevos del servidor. */
val AppJson: Json = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    isLenient = false
}
