plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

import java.util.Properties

// Firma de release: el keystore vive FUERA del proyecto (para que los zips no lo arrastren).
// Ruta: ../keystore-pintakids/ respecto a la raíz del repo.
val keystoreDir = rootProject.projectDir.parentFile.parentFile.resolve("keystore-pintakids")
val keystoreProps = Properties().apply {
    val f = keystoreDir.resolve("keystore.properties")
    if (f.exists()) f.inputStream().use { this.load(it) }
}
val hasKeystore = keystoreProps.getProperty("storePassword") != null

android {
    namespace = "com.pintakids.app"
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
        applicationId = "com.pintakids.app"
        minSdk = 26
        targetSdk = 35
        versionCode = (project.findProperty("versionCodeOverride") as? String)?.toIntOrNull() ?: 3
        versionName = (project.findProperty("versionNameOverride") as? String) ?: "1.0.2"
        buildConfigField("String", "API_BASE_URL", "\"https://pintakids-production.up.railway.app\"")
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

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

// La app es la PWA: los assets del APK son server/web, copiados en cada build.
// Así el APK offline y la web servida son SIEMPRE el mismo código.
val syncWebAssets = tasks.register<Copy>("syncWebAssets") {
    from(rootProject.projectDir.resolve("../server/web").normalize())
    into(projectDir.resolve("src/main/assets/app"))
}
tasks.named("preBuild") { dependsOn(syncWebAssets) }

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.google.android.material:material:1.12.0")

    testImplementation("junit:junit:4.13.2")
    // android.jar trae org.json como stub que lanza RuntimeException en JVM puro.
    testImplementation("org.json:json:20240303")
}
