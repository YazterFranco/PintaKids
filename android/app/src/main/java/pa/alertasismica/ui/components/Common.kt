package pa.alertasismica.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pa.alertasismica.ui.theme.magnitudeColor

@Composable
fun MagnitudeBadge(magnitude: Double, large: Boolean = false) {
    val size = if (large) 120.dp else 56.dp
    Box(
        modifier = Modifier
            .size(size)
            .background(magnitudeColor(magnitude), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = String.format(java.util.Locale.ROOT, "%.1f", magnitude),
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = if (large) 40.sp else 18.sp,
        )
    }
}

@Composable
fun SectionCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) { content() }
    }
}

@Composable
fun ErrorText(message: String?) {
    if (message.isNullOrBlank()) return
    Text(message, color = MaterialTheme.colorScheme.error)
}
