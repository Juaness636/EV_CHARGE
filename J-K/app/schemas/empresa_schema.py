# Backend/schemas/empresa_schema.py
import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.utils.constantes import ESTADOS_CARGADOR, ESTADOS_EMPRESA, TIPOS_CONECTOR

# NIT colombiano: 7-14 dígitos con o sin puntos/guion, seguido del dígito de verificación.
NIT_PATTERN = re.compile(r"^\d{1,2}\.?\d{3}\.?\d{3,5}\-?\d{1,2}$")
COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


def normalizar_nit(valor: str) -> str:
    return re.sub(r"\D", "", valor)


def _validar_color(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    if not COLOR_PATTERN.match(v):
        raise ValueError("color_hex debe tener el formato #RRGGBB")
    return v.lower()


def _validar_logo(v: Optional[str]) -> Optional[str]:
    # Solo URLs http(s): evita guardar `javascript:` u otros esquemas que luego se pintan en <img>.
    if v is None or v.strip() == "":
        return None
    if not re.match(r"^https?://", v.strip(), re.IGNORECASE):
        raise ValueError("logo_url debe ser una URL http(s)")
    return v.strip()


class EmpresaCrear(BaseModel):
    """La crea el admin: los datos de negocio y la cuenta de acceso van en un solo request."""

    nombre_comercial: str = Field(min_length=2, max_length=120)
    razon_social: Optional[str] = Field(default=None, max_length=200)
    nit: Optional[str] = None
    telefono: Optional[str] = Field(default=None, max_length=30)
    email_contacto: Optional[EmailStr] = None
    direccion_sede: Optional[str] = Field(default=None, max_length=200)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    color_hex: str = "#16a34a"
    logo_url: Optional[str] = None
    estado: str = "aprobada"

    # Cuenta con la que la empresa entra al sistema.
    usuario_nombre: str = Field(min_length=2, max_length=80)
    usuario_apellido: Optional[str] = ""
    usuario_email: EmailStr
    usuario_password: str = Field(min_length=8)

    @field_validator("email_contacto", mode="before")
    @classmethod
    def _email_vacio(cls, v):
        return None if isinstance(v, str) and v.strip() == "" else v

    @field_validator("color_hex")
    @classmethod
    def _color_valido(cls, v: str) -> str:
        return _validar_color(v)

    @field_validator("logo_url")
    @classmethod
    def _logo_valido(cls, v: Optional[str]) -> Optional[str]:
        return _validar_logo(v)

    @field_validator("nit")
    @classmethod
    def _nit_valido(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        if not NIT_PATTERN.match(v.strip()):
            raise ValueError("El NIT no tiene un formato válido (ej: 900123456-7)")
        return normalizar_nit(v)

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: str) -> str:
        if v not in ESTADOS_EMPRESA:
            raise ValueError(f"Estado de empresa no válido. Use uno de: {', '.join(ESTADOS_EMPRESA)}")
        return v


class EmpresaUpdate(BaseModel):
    """Edición de la propia empresa: nunca toca `estado`, `nit` ni `usuario_id`."""

    nombre_comercial: Optional[str] = Field(default=None, min_length=2, max_length=120)
    razon_social: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=30)
    email_contacto: Optional[EmailStr] = None
    direccion_sede: Optional[str] = Field(default=None, max_length=200)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    color_hex: Optional[str] = None
    logo_url: Optional[str] = None

    @field_validator("email_contacto", mode="before")
    @classmethod
    def _email_vacio(cls, v):
        return None if isinstance(v, str) and v.strip() == "" else v

    @field_validator("color_hex")
    @classmethod
    def _color_valido(cls, v: Optional[str]) -> Optional[str]:
        return _validar_color(v)

    @field_validator("logo_url")
    @classmethod
    def _logo_valido(cls, v: Optional[str]) -> Optional[str]:
        return _validar_logo(v)


class EmpresaEstadoUpdate(BaseModel):
    """Cambio de estado, solo del admin (RN-E11)."""

    estado: str
    motivo: Optional[str] = Field(default=None, max_length=500)

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: str) -> str:
        if v not in ESTADOS_EMPRESA:
            raise ValueError(f"Estado de empresa no válido. Use uno de: {', '.join(ESTADOS_EMPRESA)}")
        return v


class EmpresaOut(BaseModel):
    id: str
    usuario_id: str
    nombre_comercial: str
    razon_social: Optional[str] = None
    nit: Optional[str] = None
    telefono: Optional[str] = None
    email_contacto: Optional[str] = None
    direccion_sede: Optional[str] = None
    descripcion: Optional[str] = None
    color_hex: str
    logo_url: Optional[str] = None
    estado: str
    created_at: Optional[datetime] = None
    total_estaciones: int = 0
    # Correo de acceso de la cuenta: solo lo ve el admin y la propia empresa.
    usuario_email: Optional[str] = None


class MarcaEmpresaOut(BaseModel):
    """Lo mínimo para pintar una estación con la marca de su empresa en el mapa (RN-E10)."""

    id: str
    nombre: str
    color_hex: str
    logo_url: Optional[str] = None
    estado: str


def _validar_conector(v: Optional[str]) -> Optional[str]:
    if v is not None and v not in TIPOS_CONECTOR:
        raise ValueError(f"Tipo de conector no válido. Use uno de: {', '.join(TIPOS_CONECTOR)}")
    return v


def _validar_estado_cargador(v: Optional[str]) -> Optional[str]:
    if v is not None and v not in ESTADOS_CARGADOR:
        raise ValueError("Estado de cargador debe ser 'disponible' o 'fuera_servicio'")
    return v


class CargadorCreate(BaseModel):
    numero: int = Field(ge=1, le=999)
    tipo_conector: str
    potencia_kw: float = Field(gt=0, le=1000)
    corriente: Optional[str] = Field(default="No especificada", max_length=40)
    bahias: int = Field(default=1, ge=1, le=20)
    estado: str = "disponible"

    @field_validator("tipo_conector")
    @classmethod
    def _conector_valido(cls, v: str) -> str:
        return _validar_conector(v)

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: str) -> str:
        return _validar_estado_cargador(v)


class CargadorUpdate(BaseModel):
    tipo_conector: Optional[str] = None
    potencia_kw: Optional[float] = Field(default=None, gt=0, le=1000)
    corriente: Optional[str] = Field(default=None, max_length=40)
    bahias: Optional[int] = Field(default=None, ge=1, le=20)
    estado: Optional[str] = None

    @field_validator("tipo_conector")
    @classmethod
    def _conector_valido(cls, v: Optional[str]) -> Optional[str]:
        return _validar_conector(v)

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: Optional[str]) -> Optional[str]:
        return _validar_estado_cargador(v)


class CargadorOut(BaseModel):
    id: Optional[str] = None
    numero: int
    tipo_conector: Optional[str] = None
    potencia_kw: Optional[float] = None
    corriente: Optional[str] = None
    bahias: int = 1
    estado: str
