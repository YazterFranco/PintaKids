# Alerta Sísmica PA: app Android

App nativa (Kotlin + Jetpack Compose) para recibir alertas de sismos en Panamá. Toda la interfaz está en español (Panamá). Contrato con el servidor: `../docs/API.md`.

> **Estado:** este código se escribió en un entorno sin Gradle ni Google Maven, por lo que **no fue compilado**. La primera compilación en Android Studio puede revelar errores menores de imports o versiones.

## Requisitos

- Android Studio Koala (2024.1) o superior, con JDK 17.
- Dispositivo o emulador con Android 8.0 (API 26) o superior.
- Gradle 8.9 (lo descarga el wrapper).
- **No requiere cuenta de Google** ni proyecto Firebase. Los avisos llegan por el propio servidor.

## 1. Configurar la URL del servidor

- Valor inicial: `API_BASE_URL` en `app/build.gradle.kts` (`https://CAMBIAR-ESTO.example.com`). Cámbielo por la URL real del servidor.
- También puede editarla después en **Ajustes → Servidor**. Solo se acepta `https://`.
- Si cambia la URL, la app se vuelve a registrar en ese servidor.

## 2. Generar el wrapper de Gradle

El repositorio no incluye `gradle-wrapper.jar`. Con Gradle 8.9 instalado, desde `android/`:

```bash
gradle wrapper --gradle-version 8.9
```

Esto crea `gradlew`, `gradlew.bat` y `gradle/wrapper/gradle-wrapper.jar`. Android Studio también puede hacerlo desde *Sync Project*.

## 3. Compilar e instalar

```bash
./gradlew testDebugUnitTest      # pruebas de lógica pura (JVM)
./gradlew assembleDebug          # APK en app/build/outputs/apk/debug/
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Para un APK de publicación, configure la firma en `signingConfigs` y use `assembleRelease` (R8 activo).

## 4. Primer paso de verificación: el simulacro

1. Abra la app con conexión. El primer inicio pide permisos y registra el teléfono en el servidor. Eso arranca el canal en vivo.
2. Confirme que aparece la notificación fija **"Alerta sísmica activa · conectado"** y que Inicio dice **"Alertas activas"**.
3. Vaya a **Simulacro** y pulse **Enviar simulacro**.
4. Debe llegar una alarma marcada como **SIMULACRO**, con pantalla completa sobre la pantalla de bloqueo.
5. Si el teléfono estaba desconectado, la pantalla dirá "Simulacro en cola": llegará cuando la app se reconecte.
6. Si pulsa de nuevo antes de 60 s, verá "Espere 60 s".

Si el simulacro no llega, revise antes que nada la notificación fija y el punto 5 de la lista de verificación.

## 5. Cómo funcionan los avisos (canal en vivo)

- La app mantiene abierta una conexión con el servidor desde un **servicio en primer plano**. Mientras está activo, Android muestra una **notificación fija** en el canal "Estado". Es de baja importancia: no suena ni vibra. No la quite, porque es lo que mantiene la app escuchando.
- Si la conexión se corta, la app reconecta sola con esperas de 5 s, 10 s, 20 s, 40 s y 60 s como máximo. La notificación pasa a "reconectando".
- Si no hay conexión durante más de 10 minutos, Inicio muestra: "Sin conexión con el servidor: sus alertas pueden llegar tarde".
- Tras reiniciar el teléfono, el servicio vuelve a arrancar si el dispositivo ya estaba registrado. En Android 15 o superior, el sistema puede impedir ese arranque automático; en ese caso basta con abrir la app.
- Algunos fabricantes (Xiaomi, Huawei, Samsung, entre otros) cortan los servicios en segundo plano. Quite la optimización de batería desde **Ajustes → Sin restricción de batería** y, en esos celulares, permita el inicio automático.

### Limitación de Android 15 y superior

Android limita los servicios de tipo `dataSync` a unas 6 horas por cada 24 horas. Cuando se alcanza el límite, el sistema detiene el canal en vivo: la app muestra "sin conexión" y las alertas pueden llegar tarde hasta que se vuelva a abrir la app. Esta limitación es de la plataforma y debe revisarse antes de publicar (ver "Pendientes").

## 6. Lista de verificación en dispositivo real

Pruebe en al menos un celular de cada fabricante importante (Samsung, Xiaomi, Motorola, Google Pixel).

- [ ] **Simulacro:** llega como alarma marcada SIMULACRO (ver punto 4).
- [ ] **Notificación fija:** aparece al abrir la app y cambia a "reconectando" al cortar la red.
- [ ] **Alarma con pantalla bloqueada:** el simulacro enciende la pantalla y muestra la alerta sin desbloquear.
- [ ] **Sonido de alarma:** suena aunque el teléfono esté en silencio (volumen de alarma). Revisar en *Ajustes → Sonidos*.
- [ ] **No molestar:** en *Ajustes → Canal de alarma* active "Anular No molestar". Pruebe con No molestar activado.
- [ ] **Pantalla completa (Android 14+):** en *Ajustes de la app* confirme "Mostrar sobre otras apps / pantalla completa". La app lo indica en Ajustes.
- [ ] **Ahorro de batería por fabricante:** quite la optimización de batería y, en Xiaomi/Huawei/Samsung, permita el inicio automático. Pruebe con la app cerrada y el teléfono en reposo durante 30 min.
- [ ] **Reinicio del teléfono:** tras reiniciar, la notificación fija vuelve a aparecer (o al abrir la app, en Android 15+).
- [ ] **Ubicación en segundo plano:** en *Ajustes → Permisos → Ubicación* elija "Permitir todo el tiempo". Confirme que la app aparece en *Ajustes → Ubicación* sin restricciones.
- [ ] **Sin ubicación:** deniegue la ubicación. La app debe seguir recibiendo alertas, sin distancia.
- [ ] **Sin conexión:** active modo avión. La lista y la guía deben mostrarse desde el teléfono.
- [ ] **Deduplicación:** el mismo aviso no debe aparecer dos veces, ni tras reconectar ni tras reiniciar la app.
- [ ] **Actualización:** un aviso `update` reemplaza la notificación del mismo sismo y muestra "ACTUALIZADO".

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `core/` | Lógica pura sin Android: modelos, parser SSE, parseo de push, deduplicación, geografía, hora de Panamá, validación de ajustes. Probada en `app/src/test/`. |
| `live/` | Canal en vivo: servicio en primer plano, cliente de stream con reconexión, estado visible y receptor de arranque. |
| `messaging/` | Procesamiento de cada aviso (deduplicar, guardar, mostrar, confirmar) y worker de confirmación (ack). |
| `notify/` | Canales, notificaciones y botón "Entendido". |
| `sync/` | Registro, ubicación y ajustes con el servidor. |
| `location/` | Ubicación aproximada con Fused Location. |
| `net/` | Cliente HTTP con timeouts y reintentos. |
| `data/` | Preferencias privadas, lista local de sismos y guía offline. |
| `ui/` | Pantallas Compose: Inicio, Detalle, Guía, Simulacro, Ajustes, Salud, Alerta y Permisos. |

## Notas de seguridad

- `allowBackup="false"`: el `deviceId` y el secreto no salen en copias de seguridad.
- El secreto está solo en SharedPreferences privadas y nunca se escribe en logs.
- El secreto viaja solo en la cabecera `Authorization` del canal en vivo y de las demás llamadas.
- `network_security_config` impide tráfico sin cifrar.
- La ubicación se redondea a 0.05° (~5 km) antes de enviarla, igual que en el servidor.

## Pendientes conocidos

- **Límite de 6 h por día del servicio `dataSync` (Android 15+):** es la principal limitación del canal en vivo. Revisar antes de publicar: cambiar el tipo de servicio, usar una notificación de alta prioridad para alarmas, o aceptar el límite y documentarlo para el usuario.
- `assets/guide.json`: el archivo `server/data/guide.json` no estaba en el entorno de generación. La copia incluida es un **borrador** con todos los pasos marcados `confirmed: false` ("por confirmar"). Reemplácelo por la guía validada con Sinaproc y agregue las fuentes oficiales.
- Ícono de la app: es provisional (un triángulo). Reemplácelo antes de publicar.
- Formato de `sources` en `GET /v1/health`: el contrato no define su forma. La app acepta un objeto con `ok` o cualquier otro valor, y lo muestra tal cual.

No compilado en el entorno de generación.
