import os
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import jwt
from dotenv import load_dotenv  # <-- Importamos dotenv
from app.controllers.auth_controller import validar_password_fuerte
from app.config.database import get_db 
from app.models.usuario_model import usuarios
from app.schemas.olvidar_contraseña import ForgotPasswordSchema, VerifyPinSchema, ResetPasswordSchema
from app.utils.security import hash_password

# Cargamos las variables del archivo .env
load_dotenv()

router = APIRouter()

# --- CONFIGURACIÓN DE CORREO SMTP DESDE .ENV ---
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

SECRET_KEY = os.getenv("SECRET_KEY", "tu_clave_secreta_super_segura")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

def enviar_correo_smtp(destinatario: str, pin: str):
    """Envía un correo profesional HTML con logo adjunto vía CID"""
    msg = MIMEMultipart("related")
    msg["Subject"] = "Código de Recuperación — E.V CHARGE"
    msg["From"] = f"E.V CHARGE <{SENDER_EMAIL}>"
    msg["To"] = destinatario

    msg_alternative = MIMEMultipart("alternative")
    msg.attach(msg_alternative)

    # 1. Texto plano
    text_plain = f"""
Hola,

Has solicitado restablecer tu contraseña en E.V CHARGE.

Tu código de verificación (PIN) es: {pin}

Este código es válido por 15 minutos. Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.

Atentamente,
El equipo de E.V CHARGE
    """.strip()
    msg_alternative.attach(MIMEText(text_plain, "plain", "utf-8"))

    # 2. Plantilla HTML (con src="cid:evcharge_logo")
    html_content = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperación de Contraseña</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0d1117; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0d1117; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width: 480px; background-color: #161b22; border: 1px solid #30363d; border-radius: 16px; border-top: 4px solid #39a900; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden;" cellspacing="0" cellpadding="0" border="0">
              
              <!-- Header con Logo enlazado por CID -->
              <tr>
                <td align="center" style="padding: 32px 24px 20px 24px;">
                  <img src="cid:evcharge_logo" alt="E.V CHARGE" width="120" style="display: block; border: 0; outline: none; text-decoration: none; max-width: 120px; height: auto;">
                </td>
              </tr>

              <!-- Cuerpo del Mensaje -->
              <tr>
                <td style="padding: 0 32px 32px 32px; text-align: center;">
                  <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.3px;">
                    Recuperación de Contraseña
                  </h1>
                  <p style="color: #8b949e; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">
                    Recibimos una solicitud para restablecer tu contraseña. Utiliza el siguiente código de seguridad en la plataforma:
                  </p>

                  <div style="background-color: #0d1117; border: 1px solid #30363d; border-radius: 12px; padding: 18px; margin-bottom: 24px; display: inline-block; width: 85%;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; color: #39a900; letter-spacing: 8px; display: block;">
                      {pin}
                    </span>
                  </div>

                  <p style="color: #d29922; font-size: 12px; font-weight: 600; margin: 0 0 20px 0;">
                    ⏱️ Este código expirará en 15 minutos.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #21262d; margin: 24px 0;">

                  <p style="color: #484f58; font-size: 12px; line-height: 1.4; margin: 0;">
                    Si no solicitaste este código, puedes ignorar este correo con tranquilidad. Tu contraseña permanecerá intacta.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #0d1117; padding: 20px 32px; text-align: center; border-top: 1px solid #21262d;">
                  <p style="color: #484f58; font-size: 11px; margin: 0;">
                    © {datetime.now().year} E.V CHARGE • Plataforma de Movilidad Eléctrica
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
    msg_alternative.attach(MIMEText(html_content, "html", "utf-8"))

    # 3. Cargar la imagen directamente desde app/img/logo.png
    ruta_logo = os.path.join("app", "img", "logo.png")
    if os.path.exists(ruta_logo):
        with open(ruta_logo, "rb") as img_file:
            mime_img = MIMEImage(img_file.read())
            mime_img.add_header("Content-ID", "<evcharge_logo>")
            mime_img.add_header("Content-Disposition", "inline", filename="logo.png")
            msg.attach(mime_img)

    # 4. Envío por SMTP
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, destinatario, msg.as_string())

# ==========================================
# RUTA 1: Solicitar PIN al correo
# ==========================================
@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordSchema, db: Session = Depends(get_db)):
    user = db.query(usuarios).filter(usuarios.email == request.email).first()
    
    if not user:
        return {"message": "Si el correo está registrado, recibirás un PIN."}

    pin = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Usamos datetime.now() local para ser 100% compatibles con el sistema y la BD
    user.reset_pin = pin
    user.reset_pin_expires = datetime.now() + timedelta(minutes=15)
    db.commit()

    try:
        enviar_correo_smtp(user.email, pin)
        print(f"\n[ÉXITO] Correo enviado a {user.email} con el PIN: {pin}\n")
    except Exception as e:
        print(f"\n[ERROR] Falló el envío del correo: {e}\n")

    return {"message": "Si el correo está registrado, recibirás un PIN."}


# ==========================================
# RUTA 2: Verificar PIN y entregar Token
# ==========================================
@router.post("/verify-pin")
def verify_pin(request: VerifyPinSchema, db: Session = Depends(get_db)):
    user = db.query(usuarios).filter(usuarios.email == request.email).first()
    
    if not user or not user.reset_pin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Datos inválidos")

    if user.reset_pin.strip() != request.pin.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El PIN es incorrecto")

    # Comparación segura de tiempo local
    if user.reset_pin_expires:
        expires_local = user.reset_pin_expires.replace(tzinfo=None)
        now_local = datetime.now().replace(tzinfo=None)
        
        if now_local > expires_local:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El PIN ha expirado")

    # Generamos el Token JWT (expira en 10 minutos)
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    to_encode = {"sub": user.email, "exp": expire}
    reset_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return {"message": "PIN verificado correctamente", "reset_token": reset_token}


# ==========================================
# RUTA 3: Establecer la nueva contraseña
# ==========================================
@router.post("/reset-password")
def reset_password(request: ResetPasswordSchema, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    except jwt.JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")

    user = db.query(usuarios).filter(usuarios.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    # --- NUEVA LÍNEA DE VALIDACIÓN ---
    validar_password_fuerte(request.new_password)

    user.password_hash = hash_password(request.new_password)
    user.reset_pin = None
    user.reset_pin_expires = None
    db.commit()

    return {"message": "Contraseña actualizada exitosamente"}