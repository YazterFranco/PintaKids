package com.pintakids.app

import android.annotation.SuppressLint
import androidx.activity.ComponentActivity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import com.pintakids.app.web.LocalWeb
import com.pintakids.app.update.UpdateChecker

/**
 * Pintakids: la app ENTERA es la PWA empaquetada en assets/app (server/web, copiada por Gradle).
 * El shell nativo solo aporta: funcionamiento 100 % offline, puentes (guardar imagen, compartir),
 * permisos de cámara/micrófono para Foto→colorear y cuentos, y el canal de autoactualización.
 * Seguridad infantil: no se navega fuera del origen propio; sin ubicación ni notificaciones.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var pendingUpload: ValueCallback<Array<Uri>>? = null
    private var pendingPermission: PermissionRequest? = null

    private val fileChooser =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uris = extractUris(result.resultCode, result.data)
            pendingUpload?.onReceiveValue(uris)
            pendingUpload = null
        }

    private val micPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            pendingPermission?.let { if (granted) it.grant(it.resources) else it.deny() }
            pendingPermission = null
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Depuración remota del WebView (chrome://inspect) solo en compilaciones de depuración.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        // La PWA usa rutas absolutas (/app.js, /v1/catalog…): todo se sirve desde los assets del APK.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", LocalWeb(assets))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)

                // Barrera exterior: cualquier destino que no sea la propia app empaquetada se bloquea.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    request.url.host != "appassets.androidplatform.net"
            }

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread {
                        val needsMic = request.resources.any { it == "audio-in" }
                        if (!needsMic || ContextCompat.checkSelfPermission(this@MainActivity, android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(request.resources)
                        } else {
                            pendingPermission = request
                            micPermission.launch(android.Manifest.permission.RECORD_AUDIO)
                        }
                    }
                }

                override fun onShowFileChooser(
                    view: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    params: FileChooserParams,
                ): Boolean {
                    pendingUpload?.onReceiveValue(null)
                    pendingUpload = filePathCallback
                    return try {
                        fileChooser.launch(Intent.createChooser(params.createIntent(), "Pintakids"))
                        true
                    } catch (_: Exception) {
                        pendingUpload = null
                        false
                    }
                }
            }

            addJavascriptInterface(Bridge(this@MainActivity, this), "PintakidsBridge")
            loadUrl("https://appassets.androidplatform.net/index.html")
        }

        setContentView(webView)
        UpdateChecker.checkOnLaunch(this)
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onPause() {
        super.onPause()
        webView.pauseTimers()
    }

    override fun onResume() {
        super.onResume()
        webView.resumeTimers()
        // Si el niño regresó de "instalar apps desconocidas", la cortina ya pasó sola.
    }

    companion object {
        /** Saca los URIs elegidos (uno o varios) del resultado del selector de archivos. */
        fun extractUris(resultCode: Int, data: Intent?): Array<Uri>? {
            if (resultCode != RESULT_OK || data == null) return null
            val clip = data.clipData
            if (clip != null) {
                return Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
            }
            return data.data?.let { arrayOf(it) }
        }
    }
}
