# Backend/schemas/auth_schema.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.schemas.vehiculo_schema import VehiculoOut


class UsuarioRegistro(BaseModel):
    nombre: str
    apellido: Optional[str] = ""
    email: EmailStr
    password: str


class UsuarioOut(BaseModel):
    id: str
    nombre: str
    apellido: Optional[str] = ""
    email: EmailStr
    is_admin: bool = False
    rol: str = "usuario"
    compartir_nombre_reserva: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class PerfilOut(BaseModel):
    """Perfil propio: nunca expone password_hash ni el PIN de recuperación."""
    usuario: UsuarioOut
    vehiculo_activo: Optional[VehiculoOut] = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str
    usuario: UsuarioOut


class VehiculoActivoOut(BaseModel):
    id: str
    usuario_id: str
    marca: str
    modelo: str
    anio: Optional[int] = None
    autonomia_km: Optional[float] = None
    tipo_conector: str
    activo: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PerfilOut(BaseModel):
    usuario: UsuarioOut
    vehiculo_activo: Optional[VehiculoActivoOut] = None


class PerfilActualizadoOut(BaseModel):
    usuario: UsuarioOut


class PerfilUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    email: Optional[EmailStr] = None
    compartir_nombre_reserva: Optional[bool] = None


class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str
