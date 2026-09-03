import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.utils import formatdate, make_msgid
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

def enviar_correo_bienvenida_smtp(destinatario: str, nombre_usuario: str):
    """Envía el correo de confirmación de registro (estilo transaccional)."""
    try:
        msg = MIMEMultipart("related")
        # ASUNTO SERIO Y SIN EMOJIS
        msg["Subject"] = "Confirmación de Registro — E.V CHARGE"
        msg["From"] = f"E.V CHARGE <{SENDER_EMAIL}>"
        msg["To"] = destinatario
        
        # Cabeceras anti-spam
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain="evcharge.local")

        msg_alternative = MIMEMultipart("alternative")
        msg.attach(msg_alternative)

        # 1. Texto plano
        text_plain = f"""
Hola {nombre_usuario},

Te confirmamos que tu cuenta en la plataforma de E.V CHARGE ha sido creada correctamente.

Ya puedes iniciar sesión en el sistema para acceder a los servicios.

Atentamente,
El equipo de E.V CHARGE
        """.strip()
        msg_alternative.attach(MIMEText(text_plain, "plain", "utf-8"))

        # 2. Plantilla HTML (Idéntica en estructura a la de Olvidar Contraseña)
        html_content = f"""
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0d1117; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0d1117; padding: 40px 10px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" style="max-width: 480px; background-color: #161b22; border: 1px solid #30363d; border-radius: 16px; border-top: 4px solid #39a900; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden;" cellspacing="0" cellpadding="0" border="0">
                  
                  <!-- Header con Logo -->
                  <tr>
                    <td align="center" style="padding: 32px 24px 20px 24px;">
                      <img src="cid:evcharge_logo" alt="E.V CHARGE" width="120" style="display: block; border: 0; outline: none; text-decoration: none; max-width: 120px; height: auto;">
                    </td>
                  </tr>

                  <!-- Cuerpo del Mensaje -->
                  <tr>
                    <td style="padding: 0 32px 32px 32px; text-align: center;">
                      <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.3px;">
                        Registro Exitoso
                      </h1>
                      <p style="color: #8b949e; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">
                        Hola, <strong>{nombre_usuario}</strong>.
                      </p>
                      
                      <p style="color: #8b949e; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">
                        Te confirmamos que tu cuenta en la plataforma de E.V CHARGE ha sido creada correctamente. Ya puedes iniciar sesión para acceder al mapa de estaciones y gestionar tus vehículos.
                      </p>

                      <hr style="border: none; border-top: 1px solid #21262d; margin: 24px 0;">

                      <p style="color: #484f58; font-size: 12px; line-height: 1.4; margin: 0;">
                        Este es un mensaje automático del sistema, por favor no respondas a este correo.
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

        # 3. Adjuntar el logo
        ruta_logo = os.path.join("app", "img", "logo.png")
        if os.path.exists(ruta_logo):
            with open(ruta_logo, "rb") as img_file:
                mime_img = MIMEImage(img_file.read())
                mime_img.add_header("Content-ID", "<evcharge_logo>")
                mime_img.add_header("Content-Disposition", "inline", filename="logo.png")
                msg.attach(mime_img)

        # 4. Envío por SMTP
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, destinatario, msg.as_string())
            
        print(f"\n✅ [ÉXITO] Correo de bienvenida enviado a {destinatario}\n")
        
    except Exception as e:
        print(f"\n❌ [ERROR] Falló el envío del correo de bienvenida a {destinatario}: {e}\n")