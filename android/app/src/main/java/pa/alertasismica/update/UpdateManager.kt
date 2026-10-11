package pa.alertasismica.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import pa.alertasismica.net.ApiClient

/** Metadatos de la versión publicada en el servidor (GET /v1/app-version). */
data class AppVersion(
    val versionCode: Int,
    val versionName: String,
    val notes: String,
    val mandatory: Boolean,
    val apkUrl: String,
)

/**
 * Canal de autoactualización: compara la versión del servidor con la instalada,
 * descarga la APK con DownloadManager y abre el instalador de Android.
 * El usuario debe permitir "instalar apps desconocidas" la primera vez (normal en apps fuera de Play).
 */
class UpdateManager(private val context: Context) {

    fun installedVersionCode(): Int =
        context.packageManager.getPackageInfo(context.packageName, 0).longVersionCode.toInt()

    /** Devuelve la versión publicada si es más nueva que la instalada. */
    suspend fun check(api: ApiClient): AppVersion? {
        val remote = api.appVersion() ?: return null
        return if (remote.versionCode > installedVersionCode()) remote else null
    }

    fun downloadUrl(serverUrl: String, version: AppVersion): String =
        if (version.apkUrl.startsWith("http")) version.apkUrl else serverUrl.trimEnd('/') + version.apkUrl

    /** Encola la descarga en el caché de la app. Devuelve el id para seguir el progreso. */
    fun startDownload(version: AppVersion, url: String): Long {
        if (targetFile().exists()) targetFile().delete()
        val request = DownloadManager.Request(Uri.parse(url)).apply {
            setTitle("Actualizando Alerta Sísmica")
            setDescription("Descargando versión ${version.versionName}…")
            setMimeType("application/vnd.android.package-archive")
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, APK_NAME)
        }
        return manager().enqueue(request)
    }

    /** (descargado, total) o null si aún no hay progreso. */
    fun progress(id: Long): Pair<Int, Int>? {
        val c = manager().query(DownloadManager.Query().setFilterById(id)) ?: return null
        return try {
            if (!c.moveToFirst()) return null
            val done = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
            val total = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
            if (total <= 0) null else Pair(done, total)
        } finally {
            c.close()
        }
    }

    fun isComplete(id: Long): Boolean {
        val c = manager().query(DownloadManager.Query().setFilterById(id)) ?: return false
        return try {
            c.moveToFirst() && c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL
        } finally {
            c.close()
        }
    }

    fun failed(id: Long): Boolean {
        val c = manager().query(DownloadManager.Query().setFilterById(id)) ?: return true
        return try {
            c.moveToFirst() && c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_FAILED
        } finally {
            c.close()
        }
    }

    fun canInstall(): Boolean = context.packageManager.canRequestPackageInstalls()

    /** Lleva al ajuste exacto de Android para permitir instalar desde esta app. */
    fun openInstallPermissionSettings() {
        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.packageName))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
    }

    /** Abre el instalador con la APK descargada (FileProvider: la app no comparte resto de caché). */
    fun install(version: AppVersion) {
        val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", targetFile())
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private fun targetFile() = java.io.File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_NAME)

    private fun manager(): DownloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

    private companion object {
        const val APK_NAME = "app-update.apk"
    }
}
