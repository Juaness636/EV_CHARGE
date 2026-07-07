# Backend/schemas/user_schema.py
import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional

class UserSchema(BaseModel):
    # Validamos longitud mínima, máxima y eliminamos espacios basura al inicio/final (strip_whitespace)
    nombre: str = Field(
        ..., 
        min_length=3, 
        max_length=60, 
        strip_whitespace=True,
        description="Nombre completo del usuario"
    )
    
    # EmailStr valida automáticamente el formato de correo (ej: nombre@dominio.com)
    email: EmailStr = Field(
        ..., 
        strip_whitespace=True,
        description="Correo electrónico único del usuario"
    )
    
    # Exigimos una contraseña segura desde el frontend
    password: str = Field(
        ..., 
        min_length=8, 
        max_length=100,
        description="Contraseña de acceso (mínimo 8 caracteres)"
    )
    
    # Reemplazamos 'is_admin' por el nuevo campo de rol que creamos en la base de datos
    role_id: Optional[str] = Field(
        None, 
        description="ID del rol asignado al usuario (opcional al registrarse)"
    )

    # ==========================================
    # VALIDACIONES PERSONALIZADAS (Pydantic v2)
    # ==========================================
    
    @field_validator('nombre')
    @classmethod
    def validar_nombre_real(cls, v: str) -> str:
        # Evita que metan números o caracteres raros en el nombre utilizando expresiones regulares
        if not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$', v):
            raise ValueError('El nombre solo debe contener letras y espacios.')
        return v

    @field_validator('password')
    @classmethod
    def validar_fuerza_password(cls, v: str) -> str:
        # Controlamos contraseñas absurdamente predecibles comunes en pruebas de estudiantes
        password_bloqueadas = ["12345678", "password", "contraseña", "qwertyui", "evcharger"]
        if v.lower() in password_bloqueadas:
            raise ValueError('La contraseña es demasiado común o predecible. Elige una más segura.')
            
        # Validación opcional: Verificar que tenga al menos una mayúscula y un número
        if not any(char.isupper() for char in v):
            raise ValueError('La contraseña debe incluir al menos una letra mayúscula.')
        if not any(char.isdigit() for char in v):
            raise ValueError('La contraseña debe incluir al menos un número.')
            
        return v

    class Config:
        from_attributes = True