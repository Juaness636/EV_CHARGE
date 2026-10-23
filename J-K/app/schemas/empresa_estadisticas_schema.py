# Backend/schemas/empresa_estadisticas_schema.py
"""Respuestas del panel y las estadísticas de empresa (todas con response_model)."""
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel


class EmpresaResumida(BaseModel):
    id: str
    nombre_comercial: str
    color_hex: str
    logo_url: Optional[str] = None
    estado: str


class KpisEmpresa(BaseModel):
    total_estaciones: int
    estaciones_activas: int
    estaciones_mantenimiento: int
    total_cargadores: int
    cargadores_disponibles: int
    cargas_mes: int
    kwh_mes: float
    ingresos_mes: float
    reservas_proximas: int
    calificacion_promedio: Optional[float] = None
    total_resenas: int


class AlertaEmpresa(BaseModel):
    tipo: str
    mensaje: str
    cantidad: int


class NotificacionEmpresa(BaseModel):
    id: str
    titulo: str
    mensaje: str
    tipo: str
    leida: bool
    created_at: datetime


class DashboardEmpresaOut(BaseModel):
    empresa: EmpresaResumida
    kpis: KpisEmpresa
    alertas: List[AlertaEmpresa]
    reportes_pendientes: int
    incidentes_abiertos: int
    notificaciones: List[NotificacionEmpresa]


class ResumenEmpresaOut(BaseModel):
    desde: datetime
    hasta: datetime
    total_cargas: int
    total_kwh: float
    ingresos_estimados: float
    promedio_kwh_por_carga: float
    cargas_periodo_anterior: int
    variacion_cargas_pct: Optional[float] = None
    total_estaciones: int
    estaciones_activas: int
    total_cargadores: int
    cargadores_disponibles: int
    reservas_activas: int
    calificacion_promedio: Optional[float] = None
    total_resenas: int


class EstadisticaEstacionOut(BaseModel):
    estacion_id: str
    nombre: str
    estado: str
    total_cargadores: int
    cargas: int
    kwh: float
    ingresos: float
    reservas_activas: int
    incidentes_abiertos: int
    calificacion_promedio: Optional[float] = None


class EstadisticaCargadorOut(BaseModel):
    cargador_id: str
    estacion_id: str
    estacion_nombre: str
    numero: int
    tipo_conector: Optional[str] = None
    potencia_kw: Optional[float] = None
    estado: str
    sesiones: int
    kwh: float
    participacion_pct: float


class EstadisticasCargadoresOut(BaseModel):
    resultados: List[EstadisticaCargadorOut]
    mas_usado: Optional[EstadisticaCargadorOut] = None
    criterio: str
    total_sesiones_con_cargador: int


class PuntoSerie(BaseModel):
    periodo: datetime
    cargas: int
    kwh: float
    ingresos: float


class SerieTemporalOut(BaseModel):
    granularidad: str
    desde: datetime
    hasta: datetime
    zona_horaria: str
    puntos: List[PuntoSerie]


class ResenaOut(BaseModel):
    id: str
    estacion_id: str
    estacion_nombre: str
    puntaje: int
    comentario: str
    fecha: Optional[datetime] = None
    usuario_nombre: str


class ResenasEmpresaOut(BaseModel):
    promedio: Optional[float] = None
    total_general: int
    total: int
    distribucion: Dict[str, int]
    page: int
    limit: int
    resultados: List[ResenaOut]
