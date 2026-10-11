plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

import java.util.Properties

// Firma de release: el keystore vive FUERA del proyecto (actualizar.py reemplaza la carpeta en cada deploy).
// Ruta: ../keystore-android/ respecto a la raíz del repo.
val keystoreDir = rootProject.projectDir.parentFile.parentFile.resolve("keystore-android")
val keystoreProps = Properties().apply {
    val f = keystoreDir.resolve("keystore.properties")
    if (f.exists()) f.inputStream().use { this.load(it) }
}
val hasKeystore = keystoreProps.getProperty("storePassword") != null

android {
    namespace = "pa.alertasismica"
    compileSdk = 35

    signingConfigs {
        if (hasKeystore) {
            create("release") {
                storeFile = keystoreDir.resolve(keystoreProps.getProperty("keystore"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("alias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    defaultConfig {
        applicationId = "pa.alertasismica"
        minSdk = 26
        targetSdk = 35
        // CI puede sobreescribir con -PversionCodeOverride=N -PversionNameOverride=X.Y.Z
        versionCode = (project.findProperty("versionCodeOverride") as? String)?.toIntOrNull() ?: 3
        versionName = (project.findProperty("versionNameOverride") as? String) ?: "1.2.0"
        // Editable en Ajustes de la app; este valor es solo el inicial.
        buildConfigField("String", "API_BASE_URL", "\"https://alerta-sismica-pa-production.up.railway.app\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasKeystore) signingConfig = signingConfigs.getByName("release")
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.00")
    implementation(composeBom)
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.navigation:navigation-compose:2.8.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    implementation("com.google.android.gms:play-services-location:21.3.0")

    implementation("androidx.work:work-runtime-ktx:2.9.1")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    testImplementation("junit:junit:4.13.2")
}
