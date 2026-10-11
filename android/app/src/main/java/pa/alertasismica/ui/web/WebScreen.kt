package pa.alertasismica.ui.web

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import pa.alertasismica.graph

/**
 * Muestra la página web dentro de la app nativa (mapa, gráficos, guía, emergencias).
 * Los enlaces que salen del dominio propio (tel:, wa.me, otras webs) se abren fuera.
 * El botón atrás navega por el historial del WebView antes de salir de la pestaña.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebScreen() {
    val context = LocalContext.current
    val inicio = context.graph.prefs.serverUrl
    var webView: WebView? by remember { mutableStateOf(null) }
    var puedeVolver by remember { mutableStateOf(false) }

    BackHandler(enabled = puedeVolver) { webView?.goBack() }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.allowFileAccess = false
                    // Sufijo para que la página sepa que corre dentro de la app y oculte "Activar avisos".
                    settings.userAgentString = settings.userAgentString + " AlertaSismicaApp"

                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                            val url = req.url
                            val esPropio = url.host != null && url.host == Uri.parse(inicio).host
                            if (req.isForMainFrame || !esPropio) {
                                if (!esPropio) {
                                    try {
                                        ctx.startActivity(Intent(Intent.ACTION_VIEW, url))
                                    } catch (e: Exception) {
                                        /* sin app para ese enlace */
                                    }
                                    return true
                                }
                            }
                            return false
                        }

                        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
                            puedeVolver = view.canGoBack()
                        }
                    }

                    loadUrl(inicio)
                    webView = this
                }
            },
            onRelease = { it.destroy() },
        )
    }
}
