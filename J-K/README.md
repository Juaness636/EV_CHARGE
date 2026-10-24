# EV Charge

EV Charge es una plataforma web para localizar estaciones de carga de vehículos eléctricos en Colombia, consultar cargadores, planificar rutas y gestionar reservas.

El proyecto corresponde a una aplicación académica ADSO del SENA y está compuesto por:

- `app/`: API backend desarrollada con FastAPI, SQLAlchemy y PostgreSQL.
- `frontend/`: aplicación web desarrollada con React, TypeScript y Vite.
- `.env.example`: plantilla de configuración local.
- `requirements.txt`: dependencias del backend.

## Requisitos

- Python 3.12 o superior.
- Node.js 20 o superior.
- PostgreSQL 14 o superior.

## Configuración inicial

Desde la carpeta raíz del proyecto, crea la base de datos `ev_charge_db` en PostgreSQL. Las tablas se crean al iniciar el backend mediante los modelos de SQLAlchemy.

### Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Completa `.env` con la conexión de PostgreSQL y una clave segura:

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=ev_charge_db
DB_USER=postgres
DB_PASSWORD=TU_CONTRASEÑA
SECRET_KEY=GENERA_UNA_CON_EL_COMANDO_DE_ABAJO
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
VITE_API_URL=http://127.0.0.1:8000
OCM_API_KEY=TU_CLAVE_DE_OPENCHARGEMAP
```

`SECRET_KEY` debe tener al menos 32 caracteres aleatorios; si es más corta, la API no arranca. Genera una con:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Cambiar `SECRET_KEY` cierra todas las sesiones abiertas: los usuarios solo tienen que volver a iniciar sesión.

Inicia la API:

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

La documentación queda disponible en `http://127.0.0.1:8000/docs`.

### Frontend

En otra terminal:

```powershell
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`.

Para probar la página desde un celular conectado a la misma red Wi-Fi:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

Abre en el celular la dirección IPv4 del computador con el puerto `5173`, por ejemplo `http://192.168.1.20:5173`. El backend debe estar iniciado y `CORS_ORIGINS` debe incluir el origen utilizado.

## Funciones principales

- Registro, inicio de sesión, cierre de sesión y recuperación de contraseña.
- Perfil de usuario y cambio de contraseña.
- Registro, edición, eliminación y selección de vehículos.
- Mapa Leaflet con estaciones propias y estaciones de OpenChargeMap.
- Búsqueda por ubicación, estaciones cercanas, estaciones de Bogotá y filtros por conector o vehículo.
- Detalle de estación, disponibilidad de cargadores y estados operativos.
- Cálculo de rutas y planificación de paradas de carga.
- Reservas, cotización de tarifas, pagos simulados, cancelaciones y reembolsos simulados.
- Métodos de pago, cargas, estadísticas, favoritos, reportes y calificaciones.
- Catálogo de productos, compras y asistente de ayuda de EV Charge.
- Notificaciones personales y panel administrativo.
- Administración de usuarios, estaciones, reservas, cargas, reportes, contactos y calificaciones.
- Interfaz adaptable para computador y celular, con tema claro y oscuro.

## Cuenta administradora

Registra un usuario desde la aplicación y habilita el rol administrador desde PostgreSQL:

```sql
UPDATE usuarios
SET is_admin = TRUE
WHERE email = 'TU_CORREO';
```

El proyecto no crea administradores automáticamente.

## Servicios externos

`OCM_API_KEY` permite consultar estaciones externas de OpenChargeMap. Si no está configurada o el servicio no responde, la aplicación conserva las estaciones propias disponibles en la base de datos.

El envío de correos y el asistente con IA son opcionales. Sus claves se configuran únicamente en `.env` y nunca deben escribirse en el frontend ni publicarse.

### Correos (bienvenida, código de recuperación y aviso de inicio de sesión)

Los correos se envían por SMTP con `SENDER_EMAIL` y `SENDER_PASSWORD` (en Gmail, una contraseña de aplicación). Para que Gmail no los marque como spam:

- Usa siempre el mismo remitente. `SENDER_NAME` define el nombre visible (por defecto `EV Charge`) y `REPLY_TO_EMAIL` (opcional) la dirección de respuesta.
- No cambies el contenido por HTML con imágenes pesadas, enlaces acortados ni adjuntos: las plantillas de `app/services/email_service.py` ya siguen esas pautas e incluyen versión en texto plano.
- Con una cuenta `@gmail.com` no hace falta configurar nada más, pero Gmail limita el envío a unos 500 correos por día.
- Si usas un dominio propio (por ejemplo `no-reply@evcharge.co` con Google Workspace u otro proveedor SMTP), publica en el DNS del dominio:
  - **SPF**: un registro TXT que autorice al proveedor, por ejemplo `v=spf1 include:_spf.google.com ~all`.
  - **DKIM**: activa la firma en el proveedor y publica la clave TXT que te entregue (en Google Workspace: Admin › Gmail › Autenticar correo electrónico).
  - **DMARC**: un TXT en `_dmarc.tu-dominio`, empezando por `v=DMARC1; p=none; rua=mailto:dmarc@tu-dominio` y subiendo a `p=quarantine` cuando los reportes salgan limpios.
  - Gmail exige SPF, DKIM y DMARC a quien envía más de 5.000 correos al día a cuentas de Gmail.

## Comprobaciones

Backend:

```powershell
python -m compileall -q app
```

Frontend:

```powershell
cd frontend
npm run build
```

## Seguridad y archivos locales

No publiques `.env`, contraseñas, claves de servicios, `.venv`, `frontend/node_modules` ni archivos generados de compilación. El archivo `.env.example` sirve como plantilla para otros equipos.

El Excel actualizado de historias de usuario se encuentra en `outputs/historias_usuario_evcharge_20260910_final/Historias_de_usuario_EV_Charge_actualizado.xlsx`.
