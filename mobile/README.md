# EV Charge Móvil (React Native + Expo)

Este proyecto es la versión móvil nativa de **EV Charge**, adaptada desde el frontend web React a React Native con Expo SDK 57.

## Características y Adaptaciones

- **Sintaxis y Componentes Nativos**: Conversión de etiquetas HTML (`div`, `section`, `h1-h6`, `button`, etc.) a primitivos nativos (`View`, `Text`, `TouchableOpacity`, `TextInput`, `ScrollView`, `Modal`, `SafeAreaView`).
- **Mapas Interactivos**: Equivalente nativo a Leaflet mediante **`react-native-maps`** (Google Maps en Android / Apple Maps en iOS) con soporte para marcadores por estado (operativa, reservada, mantenimiento) y callouts informativos.
- **Iconos**: Uso de `@expo/vector-icons` (`FontAwesome6`) sin dependencias de fuentes web.
- **Efectos Visuales**: `expo-linear-gradient` para recrear los orbes brillantes de neón verde sobre fondo oscuro (`#0d0d0d`).
- **Almacenamiento Persistente**: `@react-native-async-storage/async-storage` para gestionar el token de sesión (`ev_token`).
- **Peticiones HTTP**: Cliente Axios (`src/api/httpClient.ts`) con interceptores para token Bearer y configuración automática de IP para emuladores Android (`10.0.2.2`) y dispositivos físicos vía `EXPO_PUBLIC_API_URL`.

## Estructura de `/src`

```text
src/
├── api/
│   ├── httpClient.ts       # Configuración de Axios con AsyncStorage
│   ├── auth.api.ts         # Login, registro y perfil
│   ├── contacto.api.ts     # Enviar mensajes de contacto
│   ├── notificaciones.api.ts # Listar y gestionar notificaciones
│   └── mapa.api.ts         # Estaciones y planificación de viaje
├── context/
│   └── AuthContext.tsx     # Contexto global de sesión
├── theme/
│   ├── colors.ts           # Paleta oficial (verde #39a900, neón #39FF14, fondo #0d0d0d)
│   └── spacing.ts          # Espaciados y radios
├── components/
│   ├── Header.tsx          # Barra superior con logo, notificaciones y login
│   ├── HeroSection.tsx     # Orbes de neón, eslogan y botones CTA
│   ├── CategoriesSection.tsx # Tarjetas de categorías
│   ├── ServicesSection.tsx # 6 tarjetas de servicios con imágenes e iconos
│   ├── AboutSection.tsx    # Quiénes somos (Proyecto ADSO SENA)
│   ├── StatsSection.tsx    # Estadísticas "En números"
│   ├── ContactSection.tsx  # Formulario interactivo de contacto
│   ├── FaqSection.tsx      # Acordeón de preguntas frecuentes
│   ├── FooterSection.tsx   # Pie de página móvil
│   ├── AuthModal.tsx       # Modal nativo para iniciar sesión y registrarse
│   └── MapPreviewModal.tsx # Modal de mapa nativo con react-native-maps
├── screens/
│   └── HomeScreen.tsx      # Pantalla principal integradora
└── types/
    └── index.ts            # Tipos e interfaces TypeScript
```

## Cómo Ejecutar el Proyecto

1. Abrir terminal en la carpeta `mobile`:
   ```bash
   cd mobile
   ```

2. Iniciar el servidor de desarrollo de Expo:
   ```bash
   npx expo start
   ```

3. Opciones de visualización:
   - **En tu celular físico**: Descarga la app **Expo Go** (Android o iOS) y escanea el código QR mostrado en la terminal.
   - **En Emulador Android**: Presiona `a` en la terminal.
   - **En Simulador iOS** (macOS): Presiona `i` en la terminal.
   - **En Navegador Web**: Presiona `w` en la terminal.
