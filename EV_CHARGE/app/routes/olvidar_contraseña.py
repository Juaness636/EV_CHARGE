import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import jwt

from app.config.database import get_db 
from app.models.usuario_model import usuarios
from app.schemas.olvidar_contraseña import ForgotPasswordSchema, VerifyPinSchema, ResetPasswordSchema
from app.utils.security import hash_password

router = APIRouter()

# --- CONFIGURACIÓN DE CORREO SMTP ---
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "eevcharge@gmail.com"
SENDER_PASSWORD = "cjlllnkexzmzjyqy"  # Tu contraseña de aplicación de 16 caracteres

SECRET_KEY = "tu_clave_secreta_super_segura"
ALGORITHM = "HS256"

def enviar_correo_smtp(destinatario: str, pin: str):
    """Función directa para enviar correos vía SMTP nativo de Python"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Código de Recuperación - EV CHARGE"
    msg["From"] = SENDER_EMAIL
    msg["To"] = destinatario

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Recuperación de Contraseña</h2>
        <p>Tu código de seguridad (PIN) es: <b style="font-size: 20px; color: #2563eb;">{pin}</b></p>
        <p>Este código expira en 15 minutos.</p>
      </body>
    </html>
    """
    msg.attach(MIMEText(html, "html"))

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
        # Quitamos la zona horaria a ambas para comparar en la misma escala (Local)
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

    user.password_hash = hash_password(request.new_password)
    user.reset_pin = None
    user.reset_pin_expires = None
    db.commit()

    return {"message": "Contraseña actualizada exitosamente"}