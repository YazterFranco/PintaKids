# kotlinx-serialization: conservar serializadores generados de los modelos de la app.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class pa.alertasismica.**$$serializer { *; }
-keepclassmembers class pa.alertasismica.** {
    *** Companion;
}
-keepclasseswithmembers class pa.alertasismica.** {
    kotlinx.serialization.KSerializer serializer(...);
}
