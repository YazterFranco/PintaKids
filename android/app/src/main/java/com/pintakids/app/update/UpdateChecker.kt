package com.pintakids.app.update

import android.app.Activity
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.widget.Toast
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.pintakids.app.BuildConfig
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Autoactualización heredada del proyecto anterior, sin Compose:
 * pregunta a /v1/app-version en segundo plano y ofrece descargar la APK nueva con DownloadManager.
 * El usuario debe permitir "instalar apps desconocidas" (normal en apps fuera de Play).
 */
object UpdateChecker {

    private var downloadId: Long = -1L

    fun checkOnLaunch(activity: Activity) {
        Executors.newSingleThreadExecutor().execute {
            val remote = try {
                val conn = URL(BuildConfig.API_BASE_URL + "/v1/app-version").openConnection() as HttpURLConnection
                conn.connectTimeout = 5_000
                conn.readTimeout = 5_000
                if (conn.responseCode == 200) UpdateRules.parse(conn.inputStream.bufferedReader().readText()) else null
            } catch (_: Exception) {
                null
            }
            val installed = activity.packageManager.getPackageInfo(activity.packageName, 0).longVersionCode.toInt()
            if (!UpdateRules.shouldUpdate(remote, installed)) return@execute
            activity.runOnUiThread { offerUpdate(activity, remote!!) }
        }
    }

    private fun offerUpdate(activity: android.app.Activity, version: AppVersion) {
        val dialog = MaterialAlertDialogBuilder(activity)
            .setTitle("🎉 ${com.pintakids.app.R.string.update_title}")
            .setMessage(listOfNotNull(version.versionName, version.notes.ifBlank { null }).joinToString("\n\n"))
            .setCancelable(!version.mandatory)
            .setPositiveButton(com.pintakids.app.R.string.update_download) { _, _ -> download(activity, version) }
            .setNegativeButton(com.pintakids.app.R.string.cancel, null)
            .show()
        if (version.mandatory) dialog.setOnCancelListener { activity.finish() }
    }

    private fun download(activity: android.app.Activity, version: AppVersion) {
        if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            Toast.makeText(activity, com.pintakids.app.R.string.update_allow_unknown, Toast.LENGTH_LONG).show()
            runCatching {
                activity.startActivity(
                    Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.packageName))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            }
            return
        }
        targetFile(activity).delete()
        val request = DownloadManager.Request(Uri.parse(UpdateRules.apkUrl(BuildConfig.API_BASE_URL, version))).apply {
            setTitle(activity.getString(com.pintakids.app.R.string.update_title))
            setDescription("v${version.versionName}")
            setMimeType("application/vnd.android.package-archive")
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, APK_NAME)
        }
        val manager = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        downloadId = manager.enqueue(request)

        activity.registerReceiver(
            object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    if (intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L) != downloadId) return
                    install(activity)
                }
            },
            IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
        )
    }

    private fun install(activity: android.app.Activity) {
        val file = targetFile(activity)
        if (!file.exists()) return
        val uri = androidx.core.content.FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { activity.startActivity(intent) }
    }

    private fun targetFile(activity: android.app.Activity) = File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_NAME)

    private const val APK_NAME = "pintakids-update.apk"
}
