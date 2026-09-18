"""Envío de correos transaccionales de EV Charge.

Las credenciales se leen únicamente desde las variables de entorno. No se
guardan códigos, contraseñas ni credenciales SMTP en el código fuente.
"""

import html
import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)


class EmailDeliveryError(RuntimeError):
    """Indica que un correo no pudo entregarse al servidor SMTP."""


def _smtp_config() -> tuple[str, int, str, str]:
    server = os.getenv("SMTP_SERVER", "smtp.gmail.com").strip()
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError as exc:
        raise EmailDeliveryError("El puerto SMTP no es válido.") from exc
    sender = os.getenv("SENDER_EMAIL", "").strip()
    password = os.getenv("SENDER_PASSWORD", "")
    if not sender or not password:
        raise EmailDeliveryError("La configuración SMTP está incompleta.")
    return server, port, sender, password


def _send_email(recipient: str, subject: str, text_body: str, html_body: str) -> None:
    server, port, sender, password = _smtp_config()
    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(server, port, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(sender, password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError("No se pudo enviar el correo.") from exc


def send_welcome_email(recipient: str, nombre: str) -> None:
    safe_name = html.escape(nombre or "usuario")
    _send_email(
        recipient,
        "Bienvenido a EV Charge",
        f"Hola {nombre or 'usuario'},\n\nTu cuenta de EV Charge fue creada correctamente. Ya puedes iniciar sesión y comenzar a usar la plataforma.\n\nEquipo EV Charge",
        f"<div style=\"font-family:Arial,sans-serif;color:#202020\"><h2 style=\"color:#39a900\">Bienvenido a EV Charge, {safe_name}</h2><p>Tu cuenta fue creada correctamente.</p><p>Ya puedes iniciar sesión y comenzar a usar la plataforma.</p><p>Equipo EV Charge</p></div>",
    )


def send_password_reset_email(recipient: str, nombre: str, pin: str) -> None:
    safe_name = html.escape(nombre or "usuario")
    _send_email(
        recipient,
        "Código para recuperar tu contraseña | EV Charge",
        f"Hola {nombre or 'usuario'},\n\nTu código de recuperación es: {pin}\n\nEste código vence en 15 minutos. Si no solicitaste el cambio, ignora este mensaje.\n\nEquipo EV Charge",
        f"<div style=\"font-family:Arial,sans-serif;color:#202020\"><h2 style=\"color:#39a900\">Recuperación de contraseña</h2><p>Hola {safe_name},</p><p>Tu código de recuperación es:</p><p style=\"font-size:28px;font-weight:700;letter-spacing:8px;color:#39a900\">{pin}</p><p>Este código vence en 15 minutos. Si no solicitaste el cambio, ignora este mensaje.</p><p>Equipo EV Charge</p></div>",
    )


def log_welcome_email_failure(recipient: str, exc: Exception) -> None:
    logger.warning("No se pudo enviar el correo de bienvenida a %s: %s", recipient, exc)
