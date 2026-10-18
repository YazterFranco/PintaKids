# Pintakids: el puente JS↔nativo se invoca por reflexión desde el WebView.
-keepclassmembers class com.pintakids.app.Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
