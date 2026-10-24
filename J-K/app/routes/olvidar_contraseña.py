import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.auth_controller import validar_password_fuerte
from app.models.usuario_model import usuarios
from app.models.utils import ahora_utc
from app.schemas.olvidar_contraseña import ForgotPasswordSchema, VerifyPinSchema, ResetPasswordSchema
from app.utils.jwt import SECRET_KEY, create_reset_token, usuario_de_reset_token
from app.utils.rate_limit import LimiteIntentos, error_demasiados_intentos, ip_cliente
from app.utils.security import hash_password
from app.services.email_service import EmailDeliveryError, send_password_reset_email

router = APIRouter()

PIN_VIGENCIA_MINUTOS = 10
PIN_MAX_INTENTOS = 5
PIN_ESPERA_REENVIO_SEGUNDOS = 60

# Freno por IP y por correo, además del límite de intentos guardado en cada usuario.
_solicitudes_ip = LimiteIntentos(maximo=10, ventana_segundos=15 * 60)
_solicitudes_correo = LimiteIntentos(maximo=4, ventana_segundos=15 * 60)
_verificaciones_ip = LimiteIntentos(maximo=20, ventana_segundos=15 * 60)

MENSAJE_SOLICITUD = 'Si el correo está registrado, te enviamos un código de verificación.'
MENSAJE_PIN_INVALIDO = 'El código es incorrecto o ya venció. Solicita uno nuevo.'


def _hash_pin(usuario_id: str, pin: str) -> str:
    return hmac.new(SECRET_KEY.encode(), f'{usuario_id}:{pin}'.encode(), hashlib.sha256).hexdigest()


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _limpiar_pin(user) -> None:
    user.reset_pin = None
    user.reset_pin_expires = None
    user.reset_pin_intentos = 0


@router.post('/forgot-password')
def forgot_password(request: ForgotPasswordSchema, http: Request, db: Session = Depends(get_db)):
    email = request.email.strip().lower()
    if not _solicitudes_ip.consumir(ip_cliente(http)) or not _solicitudes_correo.consumir(email):
        raise error_demasiados_intentos('Has solicitado demasiados códigos. Espera unos minutos e inténtalo de nuevo.')

    user = db.query(usuarios).filter(usuarios.email == email).first()
    # Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados.
    if not user:
        return {'message': MENSAJE_SOLICITUD}
    enviado = _aware(user.reset_pin_enviado)
    if enviado and ahora_utc() - enviado < timedelta(seconds=PIN_ESPERA_REENVIO_SEGUNDOS):
        return {'message': MENSAJE_SOLICITUD}

    pin = f'{secrets.randbelow(1_000_000):06d}'
    user.reset_pin = _hash_pin(user.id, pin)
    user.reset_pin_expires = ahora_utc() + timedelta(minutes=PIN_VIGENCIA_MINUTOS)
    user.reset_pin_intentos = 0
    user.reset_pin_enviado = ahora_utc()
    db.commit()
    try:
        send_password_reset_email(user.email, user.nombre, pin, PIN_VIGENCIA_MINUTOS)
    except EmailDeliveryError as exc:
        _limpiar_pin(user)
        user.reset_pin_enviado = None
        db.commit()
        raise HTTPException(status_code=503, detail='No se pudo enviar el código al correo. Intenta nuevamente.') from exc
    return {'message': MENSAJE_SOLICITUD}


@router.post('/verify-pin')
def verify_pin(request: VerifyPinSchema, http: Request, db: Session = Depends(get_db)):
    if not _verificaciones_ip.consumir(ip_cliente(http)):
        raise error_demasiados_intentos('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')

    user = db.query(usuarios).filter(usuarios.email == request.email.strip().lower()).with_for_update().first()
    if not user or not user.reset_pin:
        raise HTTPException(status_code=400, detail=MENSAJE_PIN_INVALIDO)

    expira = _aware(user.reset_pin_expires)
    if not expira or ahora_utc() > expira:
        _limpiar_pin(user)
        db.commit()
        raise HTTPException(status_code=400, detail='El código venció. Solicita uno nuevo.')

    if not hmac.compare_digest(user.reset_pin, _hash_pin(user.id, request.pin.strip())):
        user.reset_pin_intentos = (user.reset_pin_intentos or 0) + 1
        restantes = PIN_MAX_INTENTOS - user.reset_pin_intentos
        if restantes <= 0:
            _limpiar_pin(user)
            db.commit()
            raise error_demasiados_intentos('Superaste el número de intentos. Solicita un código nuevo.')
        db.commit()
        quedan = 'Te queda 1 intento' if restantes == 1 else f'Te quedan {restantes} intentos'
        raise HTTPException(status_code=400, detail=f'El código es incorrecto. {quedan}.')

    # El PIN es de un solo uso: se borra al verificarse.
    _limpiar_pin(user)
    db.commit()
    return {'message': 'PIN verificado correctamente', 'reset_token': create_reset_token(user)}


@router.post('/reset-password')
def reset_password(request: ResetPasswordSchema, db: Session = Depends(get_db)):
    user = usuario_de_reset_token(request.token, db)
    validar_password_fuerte(request.new_password)
    user.password_hash = hash_password(request.new_password)
    # Cierra todas las sesiones abiertas y deja sin efecto el token de recuperación.
    user.token_version = (user.token_version or 0) + 1
    _limpiar_pin(user)
    db.commit()
    return {'message': 'Contraseña actualizada exitosamente'}
