# Backend/controllers/empresa_estaciones_controller.py
"""CRUD de estaciones de la empresa, cargadores y cambios de estado.

Regla D3 (multi-tenencia): ninguna ruta recibe empresa_id del cliente. Todo se
deduce de la empresa autenticada y toda consulta filtra por ella, así que una
estación se busca siempre por `id` **y** `empresa_id` (404 si no coincide, para no
revelar que la estación existe).
"""

from fastapi import Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.config.database import get_db
from app.controllers.cargas_controller import descartar_sesion_de_reserva
from app.controllers.empresa_controller import (
    asegurar_empresa_operativa,
    get_current_user_empresa,
)
from app.controllers.historial_controller import registrar_historial
from app.controllers.notificaciones_controller import crear_notificacion
from app.models.cargador_model import Cargador
from app.models.estacion_propia_model import EstacionPropia
from app.models.incidente_model import Incidente
from app.models.reserva_model import Reservas
from app.models.utils import ahora_utc
from app.schemas.estacion_empresa_schema import (
    EstacionEmpresaCreate,
    EstacionEmpresaUpdate,
    EstacionEstadoUpdate,
)
from app.schemas.empresa_schema import CargadorCreate, CargadorUpdate
from app.utils.constantes import (
    ACCION_HISTORIAL_AGREGAR_CARGADOR,
    ACCION_HISTORIAL_CREAR,
    ACCION_HISTORIAL_EDITAR,
    ACCION_HISTORIAL_ELIMINAR,
    ACCION_HISTORIAL_QUITAR_CARGADOR,
    CARGADOR_ESTADO_DISPONIBLE,
    ESTADO_ESTACION_ACTIVA,
    ESTADO_ESTACION_INACTIVA,
    ESTADO_RESERVA_ACTIVA,
    ESTADO_RESERVA_CANCELADA,
    INCIDENTES_NO_CERRADOS,
    LONGITUD_MINIMA_MOTIVO,
)

CAMPOS_EDITABLES = ("nombre", "direccion", "lat", "lon", "descripcion")


# ---------------------------------------------------------------------------
# Contexto y helpers de propiedad
# ---------------------------------------------------------------------------

def leer(ctx: dict = Depends(get_current_user_empresa)) -> dict:
    """Rutas de solo lectura: pendiente/suspendida aún puede ver su información."""
    return ctx


def operar(ctx: dict = Depends(get_current_user_empresa)) -> dict:
    """Rutas de escritura: exige la empresa aprobada (RN-E11)."""
    asegurar_empresa_operativa(ctx["empresa"])
    return ctx


def obtener_estacion_de_empresa(db: Session, empresa_id: str, estacion_id: str) -> EstacionPropia:
    """Gatekeeper de propiedad: la única forma correcta de cargar una estación de empresa."""
    estacion = (
        db.query(EstacionPropia)
        .options(joinedload(EstacionPropia.cargadores))
        .filter(
            EstacionPropia.id == estacion_id,
            EstacionPropia.empresa_id == empresa_id,
            EstacionPropia.eliminada.is_(False),
        )
        .first()
    )
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    return estacion


def ids_estaciones_empresa(db: Session, empresa_id: str) -> list[str]:
    """Resuelve primero los ids de la empresa; se reusa en estadísticas, reportes y reseñas."""
    return [
        eid
        for (eid,) in db.query(EstacionPropia.id)
        .filter(EstacionPropia.empresa_id == empresa_id, EstacionPropia.eliminada.is_(False))
        .all()
    ]


def sincronizar_campos_legados(estacion: EstacionPropia) -> None:
    """Mantiene tipo_conector/potencia_kw coherentes con los cargadores.

    El admin y el mapa público todavía leen esos campos; mientras no migren del
    todo a `cargadores`, se derivan del cargador de mayor potencia.
    """
    cargadores = list(estacion.cargadores or [])
    if not cargadores:
        return
    tope = max(cargadores, key=lambda c: c.potencia_kw or 0)
    estacion.tipo_conector = tope.tipo_conector
    estacion.potencia_kw = tope.potencia_kw


def _validar_nombre_libre(db: Session, empresa_id: str, nombre: str, excluir_id: str | None = None):
    consulta = db.query(EstacionPropia).filter(
        EstacionPropia.empresa_id == empresa_id,
        func.lower(EstacionPropia.nombre) == nombre.strip().lower(),
        EstacionPropia.eliminada.is_(False),
    )
    if excluir_id:
        consulta = consulta.filter(EstacionPropia.id != excluir_id)
    if consulta.first():
        raise HTTPException(status_code=400, detail="Ya tienes una estación con ese nombre.")


def cargadores_effectivos(estacion: EstacionPropia) -> list[dict]:
    """Vista unificada: los cargadores reales, o el campo legado si no tiene ninguno.

    Así las estaciones creadas antes de este módulo (sin fila en `cargadores`)
    siguen apareciendo como "1 conector" en el mapa y en las estadísticas.
    """
    cargadores = list(estacion.cargadores or [])
    if cargadores:
        return [
            {
                "id": c.id,
                "numero": c.numero,
                "tipo_conector": c.tipo_conector,
                "potencia_kw": c.potencia_kw,
                "estado": c.estado,
            }
            for c in cargadores
        ]
    if estacion.tipo_conector or estacion.potencia_kw:
        return [
            {
                "id": None,
                "numero": 1,
                "tipo_conector": estacion.tipo_conector or "No especificado",
                "potencia_kw": estacion.potencia_kw,
                "estado": CARGADOR_ESTADO_DISPONIBLE,
            }
        ]
    return []


def _serializar(db: Session, estacion: EstacionPropia) -> dict:
    cargadores = cargadores_effectivos(estacion)
    disponibles = sum(1 for c in cargadores if c["estado"] == CARGADOR_ESTADO_DISPONIBLE)
    incidentes_abiertos = (
        db.query(func.count(Incidente.id))
        .filter(Incidente.estacion_id == estacion.id, Incidente.estado.in_(INCIDENTES_NO_CERRADOS))
        .scalar()
        or 0
    )
    return {
        "id": estacion.id,
        "nombre": estacion.nombre,
        "direccion": estacion.direccion or "",
        "lat": estacion.lat,
        "lon": estacion.lon,
        "descripcion": estacion.descripcion or "",
        "operador": estacion.operador,
        "estado": estacion.estado or ESTADO_ESTACION_ACTIVA,
        "activa": bool(estacion.activa),
        "empresa_id": estacion.empresa_id,
        "eliminada": bool(estacion.eliminada),
        "tipo_conector": estacion.tipo_conector,
        "potencia_kw": estacion.potencia_kw,
        "created_at": estacion.created_at,
        "cargadores": cargadores,
        "total_cargadores": len(cargadores),
        "cargadores_disponibles": disponibles,
        "incidentes_abiertos": incidentes_abiertos,
    }


def cancelar_reservas_futuras_por_estacion(db: Session, estacion: EstacionPropia, motivo: str) -> int:
    """RN-E06: al inhabilitar, las reservas futuras activas se cancelan y se avisa a cada usuario."""
    ahora = ahora_utc()
    futuras = (
        db.query(Reservas)
        .filter(
            Reservas.estacion_ocm_id == estacion.id,
            Reservas.estado == ESTADO_RESERVA_ACTIVA,
            Reservas.fecha_hora_inicio >= ahora,
        )
        .all()
    )
    for reserva in futuras:
        reserva.estado = ESTADO_RESERVA_CANCELADA
        # La sesión de carga que abrió la reserva tampoco debe quedar en curso.
        descartar_sesion_de_reserva(db, reserva.id)
        crear_notificacion(
            db,
            reserva.usuario_id,
            "Reserva cancelada",
            (
                f"Tu reserva de {estacion.nombre} del "
                f"{reserva.fecha_hora_inicio.strftime('%d/%m/%Y %H:%M')} fue cancelada. "
                f"Motivo: {motivo}"
            ),
            "reserva",
        )
    return len(futuras)


# ---------------------------------------------------------------------------
# Estaciones
# ---------------------------------------------------------------------------

def listar_estaciones_empresa(ctx: dict = Depends(leer), db: Session = Depends(get_db)):
    estaciones = (
        db.query(EstacionPropia)
        .options(joinedload(EstacionPropia.cargadores))
        .filter(
            EstacionPropia.empresa_id == ctx["empresa_id"],
            EstacionPropia.eliminada.is_(False),
        )
        .order_by(EstacionPropia.nombre.asc())
        .all()
    )
    return [_serializar(db, e) for e in estaciones]


def detalle_estacion_empresa(
    estacion_id: str,
    ctx: dict = Depends(leer),
    db: Session = Depends(get_db),
):
    estacion = obtener_estacion_de_empresa(db, ctx["empresa_id"], estacion_id)
    return _serializar(db, estacion)


def crear_estacion_empresa(
    data: EstacionEmpresaCreate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    empresa = ctx["empresa"]
    _validar_nombre_libre(db, empresa.id, data.nombre)

    numeros = [c.numero for c in data.cargadores]
    if len(numeros) != len(set(numeros)):
        raise HTTPException(status_code=400, detail="El número de cargador no puede repetirse.")

    estado = data.estado or ESTADO_ESTACION_ACTIVA
    estacion = EstacionPropia(
        nombre=data.nombre.strip(),
        direccion=(data.direccion or "").strip(),
        lat=data.lat,
        lon=data.lon,
        descripcion=data.descripcion or "",
        # `operador` no viene del cliente: es el nombre comercial de la empresa (D3).
        operador=empresa.nombre_comercial,
        estado=estado,
        activa=estado == ESTADO_ESTACION_ACTIVA,
        empresa_id=empresa.id,
        cargadores=[
            Cargador(
                numero=c.numero,
                tipo_conector=c.tipo_conector,
                potencia_kw=c.potencia_kw,
                estado=c.estado,
            )
            for c in data.cargadores
        ],
    )
    sincronizar_campos_legados(estacion)
    db.add(estacion)
    # El id se genera al flush: sin esto la bitácora nacería con estacion_id NULL.
    db.flush()
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_CREAR,
        motivo="",
        detalle={"cargadores": len(data.cargadores), "estado": estado},
    )
    db.commit()
    db.refresh(estacion)
    return _serializar(db, estacion)


def actualizar_estacion_empresa(
    estacion_id: str,
    data: EstacionEmpresaUpdate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    datos = data.model_dump(exclude_unset=True)
    if not datos:
        return _serializar(db, estacion)

    if datos.get("nombre"):
        _validar_nombre_libre(db, empresa.id, datos["nombre"], excluir_id=estacion.id)

    antes = {campo: getattr(estacion, campo) for campo in CAMPOS_EDITABLES}
    for campo, valor in datos.items():
        if campo in CAMPOS_EDITABLES:
            setattr(estacion, campo, valor.strip() if isinstance(valor, str) else valor)
    sincronizar_campos_legados(estacion)

    cambios = {
        campo: {"antes": antes[campo], "despues": getattr(estacion, campo)}
        for campo in CAMPOS_EDITABLES
        if antes[campo] != getattr(estacion, campo)
    }
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_EDITAR,
        motivo="",
        detalle=cambios,
    )
    db.commit()
    db.refresh(estacion)
    return _serializar(db, estacion)


def eliminar_estacion_empresa(
    estacion_id: str,
    motivo: str,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    """RN-E08: soft delete, para conservar historial y estadísticas."""
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    if len(motivo.strip()) < LONGITUD_MINIMA_MOTIVO:
        raise HTTPException(
            status_code=400,
            detail=f"El motivo es obligatorio y debe tener al menos {LONGITUD_MINIMA_MOTIVO} caracteres.",
        )

    canceladas = cancelar_reservas_futuras_por_estacion(db, estacion, motivo.strip())
    estacion.eliminada = True
    estacion.estado = ESTADO_ESTACION_INACTIVA
    estacion.activa = False
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_ELIMINAR,
        motivo=motivo.strip(),
        detalle={"reservas_canceladas": canceladas},
    )
    db.commit()
    return {"ok": True, "reservas_canceladas": canceladas}


def cambiar_estado_estacion_empresa(
    estacion_id: str,
    data: EstacionEstadoUpdate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    """RN-E03, RN-E04 y RN-E06: delega en la misma función que usa el admin.

    El import es diferido porque `estacion_estado_controller` ya importa de este
    módulo sus helpers; así se evita un ciclo y sigue habiendo una sola implementación.
    """
    from app.controllers.estacion_estado_controller import cambiar_estado

    estacion = obtener_estacion_de_empresa(db, ctx["empresa_id"], estacion_id)
    resultado = cambiar_estado(
        db,
        estacion,
        data.estado,
        data.motivo,
        actor_id=ctx["usuario_id"],
        actor_nombre=ctx["usuario_nombre"],
    )
    db.commit()
    db.refresh(estacion)
    return {**_serializar(db, estacion), "reservas_canceladas": resultado["reservas_canceladas"]}


# ---------------------------------------------------------------------------
# Cargadores
# ---------------------------------------------------------------------------

def _cargador_o_404(db: Session, estacion: EstacionPropia, cargador_id: str) -> Cargador:
    cargador = (
        db.query(Cargador)
        .filter(Cargador.id == cargador_id, Cargador.estacion_id == estacion.id)
        .first()
    )
    if not cargador:
        raise HTTPException(status_code=404, detail="Cargador no encontrado.")
    return cargador


def agregar_cargador(
    estacion_id: str,
    data: CargadorCreate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    existe = (
        db.query(Cargador)
        .filter(Cargador.estacion_id == estacion.id, Cargador.numero == data.numero)
        .first()
    )
    if existe:
        raise HTTPException(
            status_code=400, detail=f"Ya existe un cargador #{data.numero} en esta estación."
        )

    cargador = Cargador(
        estacion_id=estacion.id,
        numero=data.numero,
        tipo_conector=data.tipo_conector,
        potencia_kw=data.potencia_kw,
        estado=data.estado,
    )
    estacion.cargadores.append(cargador)
    sincronizar_campos_legados(estacion)
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_AGREGAR_CARGADOR,
        motivo="",
        detalle={
            "numero": data.numero,
            "tipo_conector": data.tipo_conector,
            "potencia_kw": data.potencia_kw,
        },
    )
    db.commit()
    db.refresh(estacion)
    return _serializar(db, estacion)


def actualizar_cargador(
    estacion_id: str,
    cargador_id: str,
    data: CargadorUpdate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    cargador = _cargador_o_404(db, estacion, cargador_id)

    datos = data.model_dump(exclude_unset=True)
    if not datos:
        return _serializar(db, estacion)

    antes = {
        "tipo_conector": cargador.tipo_conector,
        "potencia_kw": cargador.potencia_kw,
        "estado": cargador.estado,
    }
    for campo, valor in datos.items():
        setattr(cargador, campo, valor)
    sincronizar_campos_legados(estacion)

    cambios = {
        campo: {"antes": antes[campo], "despues": valor}
        for campo, valor in datos.items()
        if antes.get(campo) != valor
    }
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_EDITAR,
        motivo="",
        detalle={"cargador_id": cargador.id, "numero": cargador.numero, **cambios},
    )
    db.commit()
    return _serializar(db, estacion)


def quitar_cargador(
    estacion_id: str,
    cargador_id: str,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    cargador = _cargador_o_404(db, estacion, cargador_id)

    # RN-E03: una estación activa no puede quedarse sin cargadores.
    if estacion.estado == ESTADO_ESTACION_ACTIVA and len(estacion.cargadores) <= 1:
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes quitar el único cargador de una estación activa (RN-E03). "
                "Primero cámbiala a mantenimiento o inactiva."
            ),
        )

    numero = cargador.numero
    tipo = cargador.tipo_conector
    estacion.cargadores.remove(cargador)
    db.delete(cargador)
    sincronizar_campos_legados(estacion)
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_QUITAR_CARGADOR,
        motivo="",
        detalle={"numero": numero, "tipo_conector": tipo},
    )
    db.commit()
    db.refresh(estacion)
    return _serializar(db, estacion)
