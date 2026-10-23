# Backend/schemas/admin_schema.py
from pydantic import BaseModel, field_validator

from app.utils.constantes import ESTADOS_CARGADOR
from typing import Optional
from datetime import datetime


class EstacionCargadorData(BaseModel):
    id: Optional[str] = None
    numero: Optional[int] = None
    tipo_conector: str
    potencia_kw: float
    corriente: Optional[str] = "No especificada"
    bahias: int = 1
    estado: Optional[str] = None

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ESTADOS_CARGADOR:
            raise ValueError("Estado de cargador debe ser 'disponible' o 'fuera_servicio'")
        return v


class AdminEstadisticas(BaseModel):
    total_usuarios: int
    total_vehiculos: int
    total_reservas_activas: int
    total_cargas: int
    total_kwh_cargados: float
    total_reportes_abiertos: int
    total_estaciones_propias: int
    total_empresas: int = 0
    empresas_pendientes: int = 0


class EstacionPropiaCreate(BaseModel):
    nombre: str
    direccion: Optional[str] = None
    lat: float
    lon: float
    tipo_conector: str
    potencia_kw: float
    descripcion: Optional[str] = ""
    operador: Optional[str] = "EV Charge"
    activa: Optional[bool] = True
    estado: Optional[str] = "activa"
    cargadores: Optional[list[EstacionCargadorData]] = None


class EstacionPropiaUpdate(BaseModel):
    id: Optional[str] = None
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    tipo_conector: Optional[str] = None
    potencia_kw: Optional[float] = None
    descripcion: Optional[str] = None
    operador: Optional[str] = None
    estado: Optional[str] = None
    cargadores: Optional[list[EstacionCargadorData]] = None


class EstadoUpdate(BaseModel):
    estado: str
    # Obligatorio en la práctica para estaciones de empresa: queda en su historial.
    motivo: Optional[str] = None


class AdminEstacionOcmUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    operador: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    estado: Optional[str] = None


class AdminReservaUpdate(BaseModel):
    estado: Optional[str] = None


class AdminCargaUpdate(BaseModel):
    estado: str


class AdminReporteEstado(BaseModel):
    estado: str


class UsuarioInfo(BaseModel):
    id: str
    nombre: str
    apellido: Optional[str] = ""
    email: str

    class Config:
        from_attributes = True


class AdminReservaDetail(BaseModel):
    id: str
    usuario_id: str
    usuario: UsuarioInfo
    estacion_ocm_id: str
    cargador_id: Optional[str] = None
    estacion_nombre: str
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    estado: str
    created_at: datetime

    class Config:
        from_attributes = True
