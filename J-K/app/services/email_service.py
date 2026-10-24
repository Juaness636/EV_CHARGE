"""Envío de correos transaccionales de EV Charge.

Las credenciales se leen únicamente desde las variables de entorno. No se
guardan códigos, contraseñas ni credenciales SMTP en el código fuente.

Los correos siguen las pautas de Gmail para remitentes y así no terminan en spam:
- Remitente fijo con nombre visible ("EV Charge <correo>"), Message-ID y Date propios.
- Versión de texto plano además del HTML.
- HTML simple: tablas, estilos en línea, sin imágenes externas, sin scripts,
  sin enlaces acortados y sin adjuntos.
- Asuntos claros, sin mayúsculas sostenidas, signos repetidos ni emojis.
Para un dominio propio hay que publicar SPF, DKIM y DMARC (ver README).
"""

import html
import logging
import os
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

logger = logging.getLogger(__name__)

# Colores de la marca (los mismos de la app móvil).
VERDE = "#39a900"
VERDE_OSCURO = "#2a7300"
VERDE_SUAVE = "#eef8e6"
TEXTO = "#1f2933"
TEXTO_SUAVE = "#5f6b76"
FONDO = "#f3f5f7"
BORDE = "#e3e8ec"
FUENTE = "Arial, Helvetica, sans-serif"

# Colombia no tiene horario de verano: UTC-5 todo el año.
HORA_COLOMBIA = timezone(timedelta(hours=-5))


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
    # El nombre visible y la dirección son siempre los mismos: Gmail confía más en un
    # remitente estable que en uno que cambia de un correo a otro.
    message["From"] = formataddr((os.getenv("SENDER_NAME", "EV Charge").strip() or "EV Charge", sender))
    message["To"] = recipient
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=False)
    message["Message-ID"] = make_msgid(domain=sender.rsplit("@", 1)[-1])
    reply_to = os.getenv("REPLY_TO_EMAIL", "").strip()
    if reply_to:
        message["Reply-To"] = reply_to
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


def _correo_oculto(email: str) -> str:
    usuario, _, dominio = (email or "").partition("@")
    return f"{usuario[:2]}***@{dominio}" if dominio else "***"


def enviar_en_segundo_plano(tareas, funcion, *args) -> None:
    """Envía el correo después de responder al cliente; si falla, solo queda en el log.

    Sin `tareas` (por ejemplo en scripts) se envía en el momento.
    """
    def _enviar():
        try:
            funcion(*args)
        except Exception as exc:  # El correo nunca debe tumbar el registro ni el login.
            logger.warning("No se pudo enviar el correo '%s' a %s: %s", funcion.__name__, _correo_oculto(args[0] if args else ""), exc)

    if tareas is not None:
        tareas.add_task(_enviar)
    else:
        _enviar()


# ---------------------------------------------------------------------------
# Plantilla
# ---------------------------------------------------------------------------

def _parrafo(texto_html: str, estilo: str = "") -> str:
    return (
        f'<p style="margin:0 0 16px 0;font-family:{FUENTE};font-size:15px;line-height:24px;'
        f'color:{TEXTO};{estilo}">{texto_html}</p>'
    )


def _plantilla(titulo: str, preheader: str, cuerpo_html: str) -> str:
    """Correo de una columna (máx. 600 px) hecho con tablas y estilos en línea."""
    anio = datetime.now(HORA_COLOMBIA).year
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{html.escape(titulo)}</title>
</head>
<body style="margin:0;padding:0;background-color:{FONDO};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{FONDO};font-size:1px;line-height:1px;">{html.escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{FONDO}" style="background-color:{FONDO};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td style="padding:0 4px 16px 4px;font-family:{FUENTE};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="{VERDE}" style="background-color:{VERDE};border-radius:8px;padding:6px 10px;font-family:{FUENTE};font-size:14px;font-weight:bold;color:#ffffff;letter-spacing:1px;">EV</td>
                <td style="padding-left:10px;font-family:{FUENTE};font-size:20px;font-weight:bold;color:{TEXTO};">EV Charge</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid {BORDE};border-radius:12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="{VERDE}" style="background-color:{VERDE};height:4px;line-height:4px;font-size:0;border-radius:12px 12px 0 0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:32px 32px 16px 32px;">
                  <h1 style="margin:0 0 20px 0;font-family:{FUENTE};font-size:22px;line-height:30px;color:{TEXTO};">{html.escape(titulo)}</h1>
                  {cuerpo_html}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0 8px;font-family:{FUENTE};font-size:12px;line-height:18px;color:{TEXTO_SUAVE};text-align:center;">
            Recibes este correo porque tienes una cuenta en EV Charge. Es un mensaje automático de seguridad de tu cuenta.<br>
            &copy; {anio} EV Charge &middot; Estaciones de carga para vehículos eléctricos en Colombia
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


def _texto(titulo: str, *bloques: str) -> str:
    pie = (
        "Recibes este correo porque tienes una cuenta en EV Charge. "
        "Es un mensaje automático de seguridad de tu cuenta.\n"
        "EV Charge - Estaciones de carga para vehículos eléctricos en Colombia"
    )
    return "\n\n".join([titulo, *bloques, "-- ", pie])


def _caja_aviso(texto_html: str) -> str:
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;">
  <tr>
    <td bgcolor="{FONDO}" style="background-color:{FONDO};border-left:4px solid {VERDE};border-radius:6px;padding:14px 16px;font-family:{FUENTE};font-size:13px;line-height:20px;color:{TEXTO_SUAVE};">{texto_html}</td>
  </tr>
</table>"""


# ---------------------------------------------------------------------------
# Correos
# ---------------------------------------------------------------------------

def send_welcome_email(recipient: str, nombre: str) -> None:
    nombre = (nombre or "").strip() or "conductor"
    safe_name = html.escape(nombre)
    pasos = [
        ("Registra tu vehículo", "Así te mostramos solo los cargadores compatibles con tu conector."),
        ("Encuentra estaciones", "Consulta en el mapa la disponibilidad y el estado de cada cargador."),
        ("Reserva y paga", "Asegura tu cargador en el horario que necesites desde la app."),
    ]
    filas = "".join(
        f"""<tr>
  <td valign="top" width="36" style="padding:0 0 14px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="{VERDE_SUAVE}" width="26" height="26" style="background-color:{VERDE_SUAVE};border-radius:13px;font-family:{FUENTE};font-size:13px;font-weight:bold;color:{VERDE_OSCURO};">{i}</td>
    </tr></table>
  </td>
  <td valign="top" style="padding:2px 0 14px 0;font-family:{FUENTE};font-size:14px;line-height:21px;color:{TEXTO};">
    <strong>{html.escape(t)}</strong><br><span style="color:{TEXTO_SUAVE};">{html.escape(d)}</span>
  </td>
</tr>"""
        for i, (t, d) in enumerate(pasos, start=1)
    )
    cuerpo = (
        _parrafo(f"Hola {safe_name},")
        + _parrafo("Tu cuenta de EV Charge quedó creada correctamente. Ya puedes iniciar sesión con este correo y empezar a planear tus cargas.")
        + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px 0;">{filas}</table>'
        + _caja_aviso(
            "Por tu seguridad, EV Charge nunca te pedirá tu contraseña ni códigos de verificación "
            "por correo, teléfono o redes sociales."
        )
        + _parrafo("Gracias por unirte,<br><strong>El equipo de EV Charge</strong>", "margin-bottom:8px;")
    )
    texto = _texto(
        "Bienvenido a EV Charge",
        f"Hola {nombre},",
        "Tu cuenta de EV Charge quedó creada correctamente. Ya puedes iniciar sesión con este correo y empezar a planear tus cargas.",
        "\n".join(f"{i}. {t}: {d}" for i, (t, d) in enumerate(pasos, start=1)),
        "Por tu seguridad, EV Charge nunca te pedirá tu contraseña ni códigos de verificación por correo, teléfono o redes sociales.",
        "Gracias por unirte,\nEl equipo de EV Charge",
    )
    _send_email(
        recipient,
        "Bienvenido a EV Charge: tu cuenta está lista",
        texto,
        _plantilla("Te damos la bienvenida a EV Charge", "Tu cuenta quedó creada. Estos son tus primeros pasos.", cuerpo),
    )


def send_password_reset_email(recipient: str, nombre: str, pin: str, minutos_vigencia: int = 10) -> None:
    nombre = (nombre or "").strip() or "usuario"
    safe_name = html.escape(nombre)
    safe_pin = html.escape(pin)
    caja_codigo = f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;">
  <tr>
    <td align="center" bgcolor="{VERDE_SUAVE}" style="background-color:{VERDE_SUAVE};border:1px solid #cfe9bb;border-radius:10px;padding:20px 12px;">
      <div style="font-family:{FUENTE};font-size:12px;line-height:18px;color:{TEXTO_SUAVE};text-transform:uppercase;letter-spacing:1px;">Tu código de verificación</div>
      <div style="font-family:'Courier New', Courier, monospace;font-size:34px;line-height:44px;font-weight:bold;color:{VERDE_OSCURO};letter-spacing:10px;padding-top:6px;">{safe_pin}</div>
      <div style="font-family:{FUENTE};font-size:13px;line-height:20px;color:{TEXTO_SUAVE};padding-top:6px;">Vence en {minutos_vigencia} minutos y solo se puede usar una vez.</div>
    </td>
  </tr>
</table>"""
    cuerpo = (
        _parrafo(f"Hola {safe_name},")
        + _parrafo("Recibimos una solicitud para restablecer la contraseña de tu cuenta de EV Charge. Escribe este código en la aplicación para continuar:")
        + caja_codigo
        + _caja_aviso(
            "<strong style=\"color:#1f2933;\">¿No fuiste tú?</strong> Ignora este mensaje: tu contraseña no cambiará. "
            "No compartas este código con nadie; el equipo de EV Charge nunca te lo pedirá."
        )
        + _parrafo("El equipo de EV Charge", "margin-bottom:8px;font-weight:bold;")
    )
    texto = _texto(
        "Restablece tu contraseña de EV Charge",
        f"Hola {nombre},",
        "Recibimos una solicitud para restablecer la contraseña de tu cuenta de EV Charge. Escribe este código en la aplicación para continuar:",
        f"Código de verificación: {pin}\nVence en {minutos_vigencia} minutos y solo se puede usar una vez.",
        "¿No fuiste tú? Ignora este mensaje: tu contraseña no cambiará. No compartas este código con nadie; el equipo de EV Charge nunca te lo pedirá.",
        "El equipo de EV Charge",
    )
    _send_email(
        recipient,
        "Tu código para restablecer la contraseña de EV Charge",
        texto,
        _plantilla("Restablece tu contraseña", f"Usa este código en la app. Vence en {minutos_vigencia} minutos.", cuerpo),
    )


def send_login_alert_email(recipient: str, nombre: str, dispositivo: str, ip: str, fecha: datetime) -> None:
    nombre = (nombre or "").strip() or "usuario"
    fecha_local = fecha.astimezone(HORA_COLOMBIA).strftime("%d/%m/%Y a las %I:%M %p").replace("AM", "a. m.").replace("PM", "p. m.")
    datos = [("Fecha", f"{fecha_local} (hora de Colombia)"), ("Dispositivo", dispositivo), ("Dirección IP", ip)]
    filas = "".join(
        f"""<tr>
  <td style="padding:10px 14px;border-bottom:1px solid {BORDE};font-family:{FUENTE};font-size:13px;color:{TEXTO_SUAVE};" width="120">{html.escape(k)}</td>
  <td style="padding:10px 14px;border-bottom:1px solid {BORDE};font-family:{FUENTE};font-size:14px;color:{TEXTO};font-weight:bold;">{html.escape(v)}</td>
</tr>"""
        for k, v in datos
    )
    cuerpo = (
        _parrafo(f"Hola {html.escape(nombre)},")
        + _parrafo("Detectamos un inicio de sesión en tu cuenta de EV Charge desde un dispositivo que no habías usado recientemente.")
        + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px 0;border:1px solid {BORDE};border-radius:8px;">{filas}</table>'
        + _parrafo("<strong>¿Fuiste tú?</strong> No tienes que hacer nada.")
        + _caja_aviso(
            "<strong style=\"color:#1f2933;\">¿No reconoces este acceso?</strong> Cambia tu contraseña de inmediato desde "
            "<em>Mi perfil</em> o con la opción <em>Olvidé mi contraseña</em> en la app. Al cambiarla se cierran todas las sesiones abiertas."
        )
        + _parrafo("El equipo de EV Charge", "margin-bottom:8px;font-weight:bold;")
    )
    texto = _texto(
        "Nuevo inicio de sesión en tu cuenta de EV Charge",
        f"Hola {nombre},",
        "Detectamos un inicio de sesión en tu cuenta de EV Charge desde un dispositivo que no habías usado recientemente.",
        "\n".join(f"{k}: {v}" for k, v in datos),
        "¿Fuiste tú? No tienes que hacer nada.",
        "¿No reconoces este acceso? Cambia tu contraseña de inmediato desde Mi perfil o con la opción Olvidé mi contraseña en la app. Al cambiarla se cierran todas las sesiones abiertas.",
        "El equipo de EV Charge",
    )
    _send_email(
        recipient,
        "Nuevo inicio de sesión en tu cuenta de EV Charge",
        texto,
        _plantilla("Nuevo inicio de sesión", f"Acceso desde {dispositivo} el {fecha_local}.", cuerpo),
    )
