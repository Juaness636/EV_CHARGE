# Backend/controllers/auth_controller.py
import hashlib
import re
from sqlalchemy.orm import Session
from fastapi import BackgroundTasks, HTTPException

from app.models.usuario_model import usuarios
from app.models.utils import ahora_utc
from app.utils.security import hash_password, verify_password
from app.utils.jwt import create_access_token
from app.utils.rate_limit import LimiteIntentos, error_demasiados_intentos
from app.controllers.notificaciones_controller import crear_notificacion
from app.services.email_service import enviar_en_segundo_plano, send_login_alert_email, send_welcome_email

# Fallos de login: por correo (protege cada cuenta) y por IP (frena barridos de contraseñas).
_fallos_login_correo = LimiteIntentos(maximo=8, ventana_segundos=15 * 60)
_fallos_login_ip = LimiteIntentos(maximo=30, ventana_segundos=15 * 60)


def validar_password_fuerte(password: str):
    """Verifica que la contraseña cumpla con los requisitos de seguridad."""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres.")
    if len(password) > 128:
        raise HTTPException(status_code=400, detail="La contraseña no puede superar los 128 caracteres.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos una letra mayúscula.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos una letra minúscula.")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos un número.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=]", password):
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos un símbolo o carácter especial.")


def register_user(db: Session, nombre: str, apellido: str, email: str, password: str, tareas: BackgroundTasks | None = None):
    email = email.strip().lower()
    existe = db.query(usuarios).filter(usuarios.email == email).first()
    if existe:
        raise HTTPException(status_code=400, detail="El correo ya está registrado.")

    # Validar la contraseña en el backend al registrarse
    validar_password_fuerte(password)

    nuevo_usuario = usuarios(
        nombre=nombre.strip(),
        apellido=(apellido or "").strip(),
        email=email,
        password_hash=hash_password(password),
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    # El correo sale después de responder: el registro no espera al servidor SMTP
    # y no se revierte si el proveedor de correo está temporalmente indisponible.
    enviar_en_segundo_plano(tareas, send_welcome_email, nuevo_usuario.email, nuevo_usuario.nombre)

    return {
        "access_token": "",
        "token_type": "bearer",
        "usuario": nuevo_usuario,
    }


def _huella_dispositivo(user_agent: str) -> str:
    return hashlib.sha256((user_agent or "desconocido").encode()).hexdigest()


def _describir_dispositivo(user_agent: str) -> str:
    ua = (user_agent or "").lower()
    if "okhttp" in ua or "android" in ua:
        return "App EV Charge en Android"
    if "cfnetwork" in ua or "darwin" in ua or "iphone" in ua or "ipad" in ua:
        return "App EV Charge en iPhone/iPad"
    for nombre, clave in (("Edge", "edg/"), ("Chrome", "chrome/"), ("Firefox", "firefox/"), ("Safari", "safari/")):
        if clave in ua:
            return f"Navegador {nombre}"
    return "Dispositivo no identificado"


def login_user(
    db: Session,
    email: str,
    password: str,
    ip: str = "desconocida",
    user_agent: str = "",
    tareas: BackgroundTasks | None = None,
):
    email = email.strip().lower()
    if _fallos_login_correo.bloqueado(email) or _fallos_login_ip.bloqueado(ip):
        raise error_demasiados_intentos("Demasiados intentos fallidos. Espera 15 minutos o recupera tu contraseña.")

    usuario = db.query(usuarios).filter(usuarios.email == email).first()
    if not usuario or not verify_password(password, usuario.password_hash):
        _fallos_login_correo.registrar(email)
        _fallos_login_ip.registrar(ip)
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    _fallos_login_correo.limpiar(email)

    # Aviso de seguridad cuando la cuenta se abre desde un dispositivo distinto al último.
    # El primer inicio después del registro solo guarda la huella (ya recibió la bienvenida).
    huella = _huella_dispositivo(user_agent)
    if usuario.ultimo_login_huella and usuario.ultimo_login_huella != huella:
        enviar_en_segundo_plano(
            tareas,
            send_login_alert_email,
            usuario.email,
            usuario.nombre,
            _describir_dispositivo(user_agent),
            ip,
            ahora_utc(),
        )
    if usuario.ultimo_login_huella != huella:
        usuario.ultimo_login_huella = huella
        db.commit()
        db.refresh(usuario)

    token = create_access_token({"sub": usuario.id}, usuario.token_version or 0)
    return {"access_token": token, "token_type": "bearer", "usuario": usuario}


def obtener_perfil(current_user, db: Session):
    from app.models.vehiculo_model import vehiculos

    db.refresh(current_user)
    vehiculo_activo = (
        db.query(vehiculos)
        .filter(vehiculos.usuario_id == current_user.id, vehiculos.activo == True)
        .first()
    )
    return {"usuario": current_user, "vehiculo_activo": vehiculo_activo}


def actualizar_perfil(current_user, data, db: Session):
    if data.nombre and data.nombre.strip():
        current_user.nombre = data.nombre.strip()
    if data.apellido is not None:
        current_user.apellido = data.apellido.strip()
    if data.email and str(data.email).strip():
        # Igual que en el registro y el login: los correos se guardan en minúsculas.
        nuevo_email = str(data.email).strip().lower()
        ocupado = (
            db.query(usuarios)
            .filter(usuarios.email == nuevo_email, usuarios.id != current_user.id)
            .first()
        )
        if ocupado:
            raise HTTPException(status_code=400, detail="El correo ya está registrado por otro usuario.")
        current_user.email = nuevo_email
    if data.compartir_nombre_reserva is not None:
        current_user.compartir_nombre_reserva = bool(data.compartir_nombre_reserva)

    crear_notificacion(db, current_user.id, "Perfil actualizado", "Actualizaste tus datos personales.", "sistema")
    db.commit()
    db.refresh(current_user)
    return {"usuario": current_user}


def cambiar_password(current_user, data, db: Session):
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    # Validar que la nueva contraseña sea fuerte
    validar_password_fuerte(data.new_password)

    current_user.password_hash = hash_password(data.new_password)
    # Las demás sesiones abiertas quedan cerradas; esta recibe un token nuevo.
    current_user.token_version = (current_user.token_version or 0) + 1
    crear_notificacion(db, current_user.id, "Contraseña actualizada", "Tu contraseña fue actualizada correctamente.", "sistema")
    db.commit()
    return {"ok": True, "access_token": create_access_token({"sub": current_user.id}, current_user.token_version)}
