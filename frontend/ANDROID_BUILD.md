# Build Android APK - Lifestyle With Lam

## Requisitos previos

1. **Android Studio** instalado (descargar de https://developer.android.com/studio)
2. **Java JDK 17+** instalado
3. **Node.js 18+** instalado

## Pasos para generar el APK

### 1. Preparar el build web

```bash
cd frontend
npm install
npm run build
npm run cap:sync
```

### 2. Abrir en Android Studio

```bash
npm run android:studio
```

O manualmente: abre Android Studio y selecciona "Open" > navega a `frontend/android`

### 3. Generar APK de debug (para pruebas)

En Android Studio:
1. Ve a **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**
2. Espera a que termine
3. El APK estará en: `android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Generar APK de release (para distribución)

#### Crear keystore (solo una vez):
```bash
keytool -genkey -v -keystore lifestyle-release.keystore -alias lifestyle -keyalg RSA -keysize 2048 -validity 10000
```

#### Configurar signing en `android/app/build.gradle`:
Añadir antes de `buildTypes`:
```gradle
signingConfigs {
    release {
        storeFile file('lifestyle-release.keystore')
        storePassword 'TU_PASSWORD'
        keyAlias 'lifestyle'
        keyPassword 'TU_PASSWORD'
    }
}
```

Y modificar `buildTypes.release`:
```gradle
release {
    signingConfig signingConfigs.release
    minifyEnabled true
    proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
}
```

#### Generar APK release:
En Android Studio: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**

El APK estará en: `android/app/build/outputs/apk/release/app-release.apk`

## Comandos rápidos

| Comando | Descripción |
|---------|-------------|
| `npm run android:build` | Build web + sync Android |
| `npm run android:studio` | Abrir Android Studio |
| `npm run android:run` | Build y ejecutar en dispositivo/emulador |
| `npm run cap:sync` | Sincronizar cambios web a Android |

## Probar en dispositivo

1. Activa "Opciones de desarrollador" en tu Android
2. Activa "Depuración USB"
3. Conecta el dispositivo por USB
4. En Android Studio: **Run** > **Run 'app'**

## Estructura del proyecto Android

```
android/
├── app/
│   ├── src/main/
│   │   ├── assets/public/     # Web app compilada
│   │   ├── java/              # Código nativo
│   │   └── res/
│   │       ├── drawable/      # Splash screen
│   │       ├── mipmap-*/      # Iconos de la app
│   │       └── values/        # Colores, strings, estilos
│   └── build.gradle           # Configuración de build
└── build.gradle               # Configuración del proyecto
```

## Solución de problemas

### "SDK location not found"
Crea archivo `android/local.properties`:
```
sdk.dir=C:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk
```

### "Gradle sync failed"
1. File > Invalidate Caches / Restart
2. Build > Clean Project
3. Build > Rebuild Project

### La app no se conecta al backend
Verifica que `capacitor.config.json` tenga la URL correcta del servidor en producción.
