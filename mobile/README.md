# EV Charge — App multiplataforma (React Native + Expo SDK 57)

Versión de **EV Charge** para **Android, iOS y Web (PC)** a partir de un mismo código.
Replica todas las funciones del frontend web (`J-K/frontend`) y consume el mismo backend FastAPI (`J-K/app`).

## Funcionalidades

| Módulo | Ruta | Contenido |
|---|---|---|
| Inicio | `/` | Hero, categorías, servicios, quiénes somos, cifras, contacto, preguntas frecuentes, notificaciones |
| Autenticación | modal global | Iniciar sesión, registro con medidor de contraseña, "Recuérdame", captcha tras varios intentos, recuperación por código |
| Mapa | `/mapa` | Leaflet + OpenStreetMap, filtros (conector, departamento, vehículo), estado en vivo, detalle de estación, reserva con cotización y pago, favoritos, calificar, reportar, ruta y navegación GPS con simulación |
| Productos | `/productos` | Catálogo, búsqueda, categorías, orden, detalle y compra con pago simulado |
| Dashboard | `/dashboard` | Inicio, vehículos, reservas, métodos de pago, compras, cargas, favoritos, reportes, calificaciones, perfil |
| Administración | `/admin` | Resumen, usuarios y roles, reportes, estaciones (CRUD con cargadores), reservas, notificaciones, calificaciones, contactos, perfil |
| Global | — | Asistente IA flotante, notificaciones, tema oscuro/claro/sistema |

La interfaz es adaptable: en PC/tablet muestra barra lateral y panel lateral del mapa; en celular usa pestañas y hojas inferiores.

### Animaciones y experiencia

- **Arranque:** icono y splash con el logo de EV Charge; al abrir, el logo aparece con un resplandor verde y una barra de progreso mientras se verifica la sesión.
- **Cargas con identidad:** el logo animado reemplaza los spinners (login, registro, pagos); las listas muestran tarjetas "fantasma" mientras llegan los datos.
- **Calcular ruta:** tarjeta con un carro que recorre la vía y las etapas *ubicación → ruta → lista*.
- **Fluidez:** secciones que aparecen al hacer scroll, botones y tarjetas con resorte al tocar (y elevación al pasar el mouse en PC), modales con entrada elástica, toasts deslizantes, marcadores del mapa que rebotan y cifras que cuentan.
- **Vibración ligera** en el celular al confirmar reservas, pagos y avisos.
- Todo respeta la opción **"reducir movimiento"** del sistema operativo.

Los componentes están en `src/components/animacion.tsx`. Los iconos de la app (`assets/icon.png`, `splash-icon.png`, `android-icon-*.png`, `favicon.png`) se generaron a partir de `assets/images/logo.png`.

## Requisitos

- Node.js 20 o superior.
- Backend FastAPI funcionando en el puerto **8000** (ver `J-K/README.md`).
- Para el celular: app **Expo Go** (Android/iOS) y estar en la **misma red Wi-Fi** que el computador.

## Ejecutar

```bash
cd mobile
npm install
npx expo start
```

- **Celular:** escanea el código QR con Expo Go (Android) o con la cámara (iOS).
- **PC / navegador:** presiona `w` o abre http://localhost:8081.
- **Emulador Android:** presiona `a`.

El backend debe iniciarse escuchando en toda la red para que el celular lo alcance:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Conexión con el backend

No hace falta escribir la IP del computador: la app la detecta sola (`src/api/httpClient.ts`).

- Web: usa el mismo host del navegador en el puerto 8000.
- Expo Go: usa la IP del computador que ejecuta `npx expo start`.
- Emulador Android: usa `10.0.2.2`.

Solo si el backend está en otro equipo, define `EXPO_PUBLIC_API_URL` en `mobile/.env` (ver `.env.example`) y reinicia Expo.

> El GPS en la versión web solo funciona en `localhost` o HTTPS (restricción de los navegadores). En el celular con Expo Go funciona siempre.

## Comandos útiles

```bash
npm run typecheck     # Verifica tipos TypeScript
npm run build:web     # Genera la versión web estática en dist/
```

## Estructura

```text
mobile/
├── app/                     # Rutas (Expo Router): index, mapa, productos, dashboard, admin
└── src/
    ├── api/                 # Cliente Axios y un módulo por recurso del backend
    ├── components/          # AuthModal, ModalPago, AsistenteChat, Notificaciones, PanelLayout...
    │   └── ui/              # Botones, campos, selectores, modales adaptativos
    ├── context/             # Sesión (AuthContext) y estado de interfaz (UIContext)
    ├── features/
    │   ├── landing/         # Pantalla de inicio
    │   ├── mapa/            # Mapa Leaflet (WebView en móvil, iframe en web), detalle y navegación
    │   ├── productos/       # Catálogo
    │   ├── dashboard/       # Panel del usuario
    │   └── admin/           # Panel de administración
    ├── theme/               # Paleta oscura/clara y espaciados
    └── utils/               # Formatos, eventos, filtros de contenido, utilidades de estaciones
```
