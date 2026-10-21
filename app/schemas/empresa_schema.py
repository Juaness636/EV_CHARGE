# Backend/schemas/empresa_schema.py
import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.utils.constantes import ESTADOS_CARGADOR, ESTADOS_EMPRESA, TIPOS_CONECTOR

# NIT colombiano: 7-14 dígitos con o sin guiones, seguido de dígito de verificación.
NIT_PATTERN = re.compile(r"^\d{1,2}\.?\d{6,8}\-?\d{1,2}$")
COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


def normalizar_nit(valor: str) -> str:
    return re.sub(r"\D", "", valor)


class EmpresaCrear(BaseModel):
    """La crea el admin. Los datos de negocio y el usuario quedan en un solo request."""

    nombre_comercial: str = Field(min_length=2, max_length=120)
    razon_social: Optional[str] = None
    nit: Optional[str] = None
    telefono: Optional[str] = None
    email_contacto: Optional[str] = None
    direccion_sede: Optional[str] = None
    descripcion: Optional[str] = None
    color_hex: str = "#16a34a"
    logo_url: Optional[str] = None
    estado: str = "aprobada"

    # Cuenta con la que la empresa va a entrar al sistema.
    usuario_nombre: str = Field(min_length=2)
    usuario_apellido: Optional[str] = ""
    usuario_email: str
    usuario_password: str = Field(min_length=8)

    @field_validator("color_hex")
    @classmethod
    def _color_valido(cls, v: str) -> str:
        if not COLOR_PATTERN.match(v):
            raise ValueError("color_hex debe tener el formato #RRGGBB")
        return v.lower()

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
    """Edición de la propia empresa: nunca toca `estado` ni `usuario_id`."""

    nombre_comercial: Optional[str] = Field(default=None, min_length=2, max_length=120)
    razon_social: Optional[str] = None
    telefono: Optional[str] = None
    email_contacto: Optional[str] = None
    direccion_sede: Optional[str] = None
    descripcion: Optional[str] = None
    color_hex: Optional[str] = None
    logo_url: Optional[str] = None

    @field_validator("color_hex")
    @classmethod
    def _color_valido(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not COLOR_PATTERN.match(v):
            raise ValueError("color_hex debe tener el formato #RRGGBB")
        return v.lower() if v else v


class EmpresaEstadoUpdate(BaseModel):
    """Cambio de estado solo del admin (RN-E11)."""

    estado: str
    motivo: Optional[str] = None

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
    created_at: datetime
    total_estaciones: int = 0

    class Config:
        from_attributes = True


class CargadorBase(BaseModel):
    numero: int = Field(ge=1)
    tipo_conector: str
    potencia_kw: float = Field(gt=0)
    estado: str = "disponible"

    @field_validator("tipo_conector")
    @classmethod
    def _conector_valido(cls, v: str) -> str:
        if v not in TIPOS_CONECTOR:
            raise ValueError(f"Tipo de conector no válido. Use uno de: {', '.join(TIPOS_CONECTOR)}")
        return v

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: str) -> str:
        if v not in ESTADOS_CARGADOR:
            raise ValueError("Estado de cargador debe ser 'disponible' o 'fuera_servicio'")
        return v


class CargadorCreate(CargadorBase):
    pass


class CargadorUpdate(BaseModel):
    tipo_conector: Optional[str] = None
    potencia_kw: Optional[float] = Field(default=None, gt=0)
    estado: Optional[str] = None

    @field_validator("tipo_conector")
    @classmethod
    def _conector_valido(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in TIPOS_CONECTOR:
            raise ValueError(f"Tipo de conector no válido. Use uno de: {', '.join(TIPOS_CONECTOR)}")
        return v


class CargadorOut(BaseModel):
    id: str
    numero: int
    tipo_conector: str
    potencia_kw: float
    estado: str

    class Config:
        from_attributes = True
