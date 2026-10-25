# Backend/utils/constantes.py
"""Valores enumerados del módulo de empresas, compartidos por modelos, controllers y schemas."""

ROL_USUARIO = "usuario"
ROL_ADMIN = "admin"
ROL_EMPRESA = "empresa"
ROLES = (ROL_USUARIO, ROL_ADMIN, ROL_EMPRESA)

ESTADO_ESTACION_ACTIVA = "activa"
ESTADO_ESTACION_MANTENIMIENTO = "mantenimiento"
ESTADO_ESTACION_INACTIVA = "inactiva"
ESTADOS_ESTACION = (
    ESTADO_ESTACION_ACTIVA,
    ESTADO_ESTACION_MANTENIMIENTO,
    ESTADO_ESTACION_INACTIVA,
)
# Estados que hacen que una estación no acepte reservas.
ESTADOS_QUE_NO_OPERAN = (ESTADO_ESTACION_MANTENIMIENTO, ESTADO_ESTACION_INACTIVA)

CARGADOR_ESTADO_DISPONIBLE = "disponible"
CARGADOR_ESTADO_FUERA_SERVICIO = "fuera_servicio"
ESTADOS_CARGADOR = (CARGADOR_ESTADO_DISPONIBLE, CARGADOR_ESTADO_FUERA_SERVICIO)

EMPRESA_PENDIENTE = "pendiente"
EMPRESA_APROBADA = "aprobada"
EMPRESA_SUSPENDIDA = "suspendida"
ESTADOS_EMPRESA = (EMPRESA_PENDIENTE, EMPRESA_APROBADA, EMPRESA_SUSPENDIDA)

ESTADO_INCIDENTE_ABIERTO = "abierto"
ESTADO_INCIDENTE_EN_PROGRESO = "en_progreso"
ESTADO_INCIDENTE_RESUELTO = "resuelto"
ESTADO_INCIDENTE_CERRADO = "cerrado"
ESTADOS_INCIDENTE = (
    ESTADO_INCIDENTE_ABIERTO,
    ESTADO_INCIDENTE_EN_PROGRESO,
    ESTADO_INCIDENTE_RESUELTO,
    ESTADO_INCIDENTE_CERRADO,
)

# RN-E07 / máquina de estados de incidentes.
TRANSICIONES_INCIDENTE = {
    ESTADO_INCIDENTE_ABIERTO: {ESTADO_INCIDENTE_EN_PROGRESO, ESTADO_INCIDENTE_CERRADO},
    ESTADO_INCIDENTE_EN_PROGRESO: {ESTADO_INCIDENTE_RESUELTO, ESTADO_INCIDENTE_CERRADO},
    ESTADO_INCIDENTE_RESUELTO: {ESTADO_INCIDENTE_CERRADO, ESTADO_INCIDENTE_EN_PROGRESO},
    ESTADO_INCIDENTE_CERRADO: set(),
}
INCIDENTES_NO_CERRADOS = (ESTADO_INCIDENTE_ABIERTO, ESTADO_INCIDENTE_EN_PROGRESO)

TIPOS_INCIDENTE = ("falla", "reparacion", "actualizacion")
PRIORIDADES_INCIDENTE = ("baja", "media", "alta")

# Estados de reserva que ocupan un cargador: se cancelan si la estación deja de operar.
ESTADOS_RESERVA_VIGENTES = ("pendiente", "activa")
ESTADO_RESERVA_ACTIVA = "activa"
ESTADO_RESERVA_CANCELADA = "cancelada"
# El usuario escaneó el QR del cargador: la carga empezó y el cargador está en uso.
ESTADO_RESERVA_EN_CURSO = "en_curso"
ESTADO_RESERVA_REALIZADA = "realizada"
# Estados que ocupan el cargador en su horario (nadie más puede reservarlo).
ESTADOS_RESERVA_OCUPAN = (ESTADO_RESERVA_ACTIVA, ESTADO_RESERVA_EN_CURSO)
# Ventana para escanear el QR: desde 15 min antes del inicio hasta 30 min después.
# Si no escanea en esos 30 min, la reserva se cancela sola (sin reembolso) y el cargador se libera.
MINUTOS_ANTICIPACION_QR = 15
MINUTOS_TOLERANCIA_LLEGADA = 30
MOTIVO_CANCELACION_NO_LLEGO = "no_llego"

ESTADO_REPORTE_ABIERTO = "abierto"
# La empresa atiende un reporte resolviéndolo o descartándolo. Poner la estación en
# mantenimiento pasa por el cambio de estado (con motivo e historial), no por el reporte.
ESTADOS_REPORTE_EMPRESA = ("resuelto", "descartado")

# En Avanze una carga cuenta como consumo cuando quedó validada.
ESTADO_CARGA_VALIDADA = "validada"

ACCION_HISTORIAL_CREAR = "crear"
ACCION_HISTORIAL_EDITAR = "editar"
ACCION_HISTORIAL_AGREGAR_CARGADOR = "agregar_cargador"
ACCION_HISTORIAL_QUITAR_CARGADOR = "quitar_cargador"
ACCION_HISTORIAL_CAMBIAR_ESTADO = "cambiar_estado"
ACCION_HISTORIAL_ABRIR_INCIDENTE = "abrir_incidente"
ACCION_HISTORIAL_CERRAR_INCIDENTE = "cerrar_incidente"
ACCION_HISTORIAL_ELIMINAR = "eliminar"
ACCION_HISTORIAL_SUBIR_FOTO = "subir_foto"
ACCION_HISTORIAL_QUITAR_FOTO = "quitar_foto"
ACCIONES_HISTORIAL = (
    ACCION_HISTORIAL_CREAR,
    ACCION_HISTORIAL_EDITAR,
    ACCION_HISTORIAL_AGREGAR_CARGADOR,
    ACCION_HISTORIAL_QUITAR_CARGADOR,
    ACCION_HISTORIAL_CAMBIAR_ESTADO,
    ACCION_HISTORIAL_ABRIR_INCIDENTE,
    ACCION_HISTORIAL_CERRAR_INCIDENTE,
    ACCION_HISTORIAL_ELIMINAR,
    ACCION_HISTORIAL_SUBIR_FOTO,
    ACCION_HISTORIAL_QUITAR_FOTO,
)

# Fotos de estaciones: formatos aceptados (por su firma binaria, no por la extensión).
FOTO_TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024
FOTOS_MAXIMAS_POR_ESTACION = 8

# Misma lista que usan los formularios de vehículos y estaciones del frontend.
TIPOS_CONECTOR = ("CCS", "Type 2", "CHAdeMO", "GB/T", "J1772")

# Los meses y días de las estadísticas se cortan en hora de Colombia.
ZONA_HORARIA_COLOMBIA = "America/Bogota"


def zona_colombia():
    """Zona horaria de Colombia. Windows no trae la base de zonas horarias (falta el
    paquete tzdata), así que si ZoneInfo falla se usa UTC-5 fijo: Colombia no tiene
    horario de verano, por lo que el resultado es el mismo."""
    from datetime import timedelta, timezone
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    try:
        return ZoneInfo(ZONA_HORARIA_COLOMBIA)
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=-5), "COT")

LONGITUD_MINIMA_MOTIVO = 10
