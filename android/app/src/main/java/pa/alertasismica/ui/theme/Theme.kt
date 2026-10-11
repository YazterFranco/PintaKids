package pa.alertasismica.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF0B3D5C),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFD6E9F7),
    secondary = Color(0xFFB8860B),
    tertiary = Color(0xFF3B6A7E),
    error = Color(0xFFB3261E),
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF9CCBF0),
    onPrimary = Color(0xFF06293F),
    primaryContainer = Color(0xFF123A52),
    secondary = Color(0xFFFFD166),
    tertiary = Color(0xFFB4CAD8),
    error = Color(0xFFFFB4AB),
    errorContainer = Color(0xFF8C1D18),
    onErrorContainer = Color(0xFFFFDAD6),
)

@Composable
fun AlertaTheme(content: @Composable () -> Unit) {
    // Paleta fija de marca (azul marino + dorado) para que la app se vea igual que la web.
    val colors = if (isSystemInDarkTheme()) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, content = content)
}

/** Color de magnitud: verde < 4, ámbar 4-5.9, naranja 6-6.9, rojo >= 7. */
fun magnitudeColor(mag: Double): Color = when {
    mag >= 7.0 -> Color(0xFFB3261E)
    mag >= 6.0 -> Color(0xFFD9611B)
    mag >= 4.0 -> Color(0xFFB8860B)
    else -> Color(0xFF2E7D32)
}
