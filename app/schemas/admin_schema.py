# Backend/schemas/admin_schema.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AdminEstadisticas(BaseModel):
    total_usuarios: int
    total_vehiculos: int
    total_reservas_activas: int
    total_cargas: int
    total_kwh_cargados: float
    total_reportes_abiertos: int
    total_estaciones_propias: int


class EstacionPropiaCreate(BaseModel):
    nombre: str
    direccion: Optional[str] = None
    lat: float
    lon: float
    tipo_conector: str
    potencia_kw: float
    descripcion: Optional[str] = ""
    activa: Optional[bool] = True


class EstadoUpdate(BaseModel):
    activa: bool


class AdminReservaUpdate(BaseModel):
    estado: Optional[str] = None
    fecha_hora_inicio: Optional[datetime] = None
    fecha_hora_fin: Optional[datetime] = None