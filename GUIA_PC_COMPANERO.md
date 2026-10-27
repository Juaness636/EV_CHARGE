# EV Charge: cómo correrlo en otro PC (Windows)

Esta rama (`feria-dia-2`) tiene el código exactamente como corre en el PC de Jhon.
Las contraseñas **no** están en GitHub: Jhon te pasa por USB, Drive o WhatsApp:

1. El archivo `.env` del backend (va en `J-K\.env`).
2. El respaldo de la base de datos `evcharge_feria.dump` (unos 25 MB, trae las fotos de las estaciones y las cuentas de la feria).

## 0. Programas que necesitas

- **Git**: https://git-scm.com/download/win
- **Python 3.12 o más nuevo**: https://www.python.org/downloads/ (marca "Add python.exe to PATH" al instalar).
- **Node.js 20 o más nuevo**: https://nodejs.org
- **PostgreSQL 16 o más nuevo**: https://www.postgresql.org/download/windows/ (anota la contraseña que le pongas al usuario `postgres`; el puerto deja 5432).
- En el celular: la app **Expo Go** (Play Store / App Store), actualizada.

El celular y el PC deben estar en la **misma red Wi‑Fi** (o el PC compartiendo zona Wi‑Fi al celular).

Todos los comandos son para **PowerShell**.

## 1. Descargar el código

```powershell
cd C:\
mkdir EVCharge
cd C:\EVCharge
git clone -b feria-dia-2 https://github.com/jhon71777/Avanze-react-native.git EVCharge
cd C:\EVCharge\EVCharge
```

(Si el repositorio es privado, Jhon te tiene que agregar como colaborador en GitHub, o te pasa la carpeta comprimida.)

## 2. Crear la base de datos y cargar los datos de Jhon

Copia `evcharge_feria.dump` a `C:\EVCharge\`. Luego:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"   # cambia 16 por tu versión si es otra
$env:PGPASSWORD = "LA_CONTRASEÑA_DE_TU_POSTGRES"
createdb -h 127.0.0.1 -U postgres Proyecto-EV
pg_restore -h 127.0.0.1 -U postgres -d Proyecto-EV --no-owner --no-acl C:\EVCharge\evcharge_feria.dump
```

Revisa que quedó bien (debe salir un número mayor que 0):

```powershell
psql -h 127.0.0.1 -U postgres -d Proyecto-EV -c "select count(*) from usuarios;"
```

Si te equivocas y quieres empezar de cero: `dropdb -h 127.0.0.1 -U postgres Proyecto-EV` y repite.

## 3. Configurar el backend

Pon el `.env` que te pasó Jhon en `C:\EVCharge\EVCharge\J-K\.env` y cambia **solo** esta línea por la contraseña de TU PostgreSQL:

```
DB_PASSWORD=LA_CONTRASEÑA_DE_TU_POSTGRES
```

(Las demás líneas déjalas igual. Si no te pasaron el `.env`, copia `J-K\.env.example` a `J-K\.env` y llénalo; `DB_NAME=Proyecto-EV`, `DB_USER=postgres`, `DB_HOST=127.0.0.1`, `DB_PORT=5432`, `ALGORITHM=HS256`, `ACCESS_TOKEN_EXPIRE_MINUTES=30`, y genera `SECRET_KEY` con `python -c "import secrets; print(secrets.token_urlsafe(48))"`.)

## 4. Instalar y arrancar el backend (ventana de PowerShell #1)

```powershell
cd C:\EVCharge\EVCharge\J-K
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Si `Activate.ps1` da error de permisos, corre una vez:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y vuelve a intentar.

Prueba en el navegador del PC: http://localhost:8000/docs (debe abrir la documentación de la API).
Deja esta ventana abierta.

## 5. Instalar y arrancar la app móvil (ventana de PowerShell #2)

```powershell
cd C:\EVCharge\EVCharge\mobile
npm install
npx expo start
```

Escanea el QR con Expo Go (Android) o con la cámara (iPhone).
**No hay que escribir la IP**: la app usa sola la IP del PC donde corre `npx expo start` y busca el backend en el puerto 8000.

Si el celular no conecta:
- La primera vez Windows pregunta por el Firewall para Python y Node: dale **Permitir** en redes privadas y públicas.
- Prueba en el navegador del celular `http://IP_DEL_PC:8000/docs` (la IP sale con `ipconfig`, en "Dirección IPv4").
- Último recurso: crea `mobile\.env` con `EXPO_PUBLIC_API_URL=http://IP_DEL_PC:8000` y reinicia con `npx expo start -c`.

## 6. (Opcional) Página web

```powershell
cd C:\EVCharge\EVCharge\J-K\frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Abre http://localhost:5173

## Cuentas para la feria

Las cuentas de demostración usan la contraseña `Avanze2026*`. Ejemplos de panel de empresa:
`voltex@terpel.com`, `movilidad@celsia.com`, `ecoestaciones@epm.com.co`.

## Plan B si no tienes el respaldo (.dump)

Con la base `Proyecto-EV` vacía (paso 2 solo con `createdb`), arranca el backend una vez (paso 4) para que cree las tablas, deténlo con Ctrl+C y corre:

```powershell
cd C:\EVCharge\EVCharge\J-K
.\.venv\Scripts\Activate.ps1
python -m app.scripts.seed_demo
```

Eso crea empresas, estaciones, conductores y reservas de demostración (sin las fotos que Jhon subió a mano).
**Ojo:** esto es solo para el PC nuevo; no lo corras en el PC de Jhon.
