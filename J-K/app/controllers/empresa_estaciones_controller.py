# Backend/controllers/empresa_estaciones_controller.py
"""CRUD de estaciones de la empresa, sus cargadores y los cambios de estado.

Aislamiento entre empresas: ninguna ruta recibe `empresa_id` del cliente. Todo se deduce
de la empresa autenticada y toda consulta filtra por ella, así que una estación se busca
siempre por `id` **y** `empresa_id` (404 si no coincide, para no revelar que existe).

Los cargadores viven en `estacion_cargadores`, la misma tabla que usa el admin, así el
mapa público y las reservas ven los cargadores de las empresas sin cambios.
"""

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.controllers.historial_controller import registrar_historial
from app.controllers.notificaciones_controller import crear_notificacion
from app.models.estacion_cargador_model import EstacionCargador
from app.models.estacion_propia_model import EstacionPropia
from app.models.incidente_model import Incidente
from app.models.pago_reserva_model import PagosReserva
from app.models.reserva_model import Reservas
from app.models.utils import ahora_utc
from app.schemas.empresa_schema import CargadorCreate, CargadorUpdate
from app.schemas.estacion_empresa_schema import (
    EstacionEmpresaCreate,
    EstacionEmpresaUpdate,
    EstacionEstadoUpdate,
)
from app.utils.constantes import (
    ACCION_HISTORIAL_AGREGAR_CARGADOR,
    ACCION_HISTORIAL_CREAR,
    ACCION_HISTORIAL_EDITAR,
    ACCION_HISTORIAL_ELIMINAR,
    ACCION_HISTORIAL_QUITAR_CARGADOR,
    CARGADOR_ESTADO_DISPONIBLE,
    ESTADO_ESTACION_ACTIVA,
    ESTADO_ESTACION_INACTIVA,
    ESTADO_RESERVA_CANCELADA,
    ESTADOS_RESERVA_VIGENTES,
    INCIDENTES_NO_CERRADOS,
)

CAMPOS_EDITABLES = ("nombre", "direccion", "lat", "lon", "descripcion")
CAMPOS_CARGADOR = ("tipo_conector", "potencia_kw", "corriente", "bahias", "estado")


# ---------------------------------------------------------------------------
# Helpers de propiedad
# ---------------------------------------------------------------------------

def obtener_estacion_de_empresa(db: Session, empresa_id: str, estacion_id: str) -> EstacionPropia:
    """Única forma correcta de cargar una estación de empresa."""
    estacion = (
        db.query(EstacionPropia)
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
    """Ids de las estaciones vigentes de la empresa; lo reusan estadísticas, reportes y reseñas."""
    return [
        eid
        for (eid,) in db.query(EstacionPropia.id)
        .filter(EstacionPropia.empresa_id == empresa_id, EstacionPropia.eliminada.is_(False))
        .all()
    ]


def cargadores_de(db: Session, estacion_id: str) -> list[EstacionCargador]:
    return (
        db.query(EstacionCargador)
        .filter(EstacionCargador.estacion_id == estacion_id)
        .order_by(EstacionCargador.numero.asc().nullslast(), EstacionCargador.id.asc())
        .all()
    )


def referencias_cargador(db: Session, estacion_id: str, cargador: EstacionCargador) -> list[str]:
    """Ids con los que una reserva o una carga pueden nombrar a este cargador.

    El mapa identifica cada conector por su posición (`<estacion>-<n>`), así que se
    aceptan tanto el id real del cargador como esa referencia posicional.
    """
    referencias = [cargador.id]
    for posicion, actual in enumerate(cargadores_de(db, estacion_id), start=1):
        if actual.id == cargador.id:
            referencias.append(f"{estacion_id}-{posicion}")
            break
    return referencias


def cargador_por_referencia(db: Session, estacion_id: str, referencia: str | None) -> EstacionCargador | None:
    """Inverso de `referencias_cargador`: resuelve el cargador que nombra una reserva."""
    if not referencia:
        return None
    cargadores = cargadores_de(db, estacion_id)
    for posicion, cargador in enumerate(cargadores, start=1):
        if referencia in (cargador.id, f"{estacion_id}-{posicion}"):
            return cargador
    return None


def sincronizar_campos_legados(estacion: EstacionPropia, cargadores: list[EstacionCargador]) -> None:
    """Mantiene `tipo_conector`/`potencia_kw` de la estación iguales al cargador más potente.

    El admin y algunos listados todavía leen esos campos de la estación.
    """
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


def cargadores_efectivos(db: Session, estacion: EstacionPropia) -> list[dict]:
    """Los cargadores reales, o el campo legado de la estación si no tiene ninguno."""
    cargadores = cargadores_de(db, estacion.id)
    if cargadores:
        return [
            {
                "id": c.id,
                "numero": c.numero or indice,
                "tipo_conector": c.tipo_conector,
                "potencia_kw": c.potencia_kw,
                "corriente": c.corriente,
                "bahias": c.bahias or 1,
                "estado": c.estado or CARGADOR_ESTADO_DISPONIBLE,
            }
            for indice, c in enumerate(cargadores, start=1)
        ]
    if estacion.tipo_conector or estacion.potencia_kw:
        return [
            {
                "id": None,
                "numero": 1,
                "tipo_conector": estacion.tipo_conector or "No especificado",
                "potencia_kw": estacion.potencia_kw,
                "corriente": "No especificada",
                "bahias": 1,
                "estado": CARGADOR_ESTADO_DISPONIBLE,
            }
        ]
    return []


def serializar_estacion(db: Session, estacion: EstacionPropia) -> dict:
    # Import local: empresa_fotos_controller importa este módulo.
    from app.controllers.empresa_fotos_controller import fotos_de, url_foto

    cargadores = cargadores_efectivos(db, estacion)
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
        "tipo_conector": estacion.tipo_conector,
        "potencia_kw": estacion.potencia_kw,
        "created_at": estacion.created_at,
        "cargadores": cargadores,
        "total_cargadores": len(cargadores),
        "cargadores_disponibles": disponibles,
        "incidentes_abiertos": incidentes_abiertos,
        "fotos": [{"id": foto.id, "url": url_foto(foto)} for foto in fotos_de(db, estacion.id)],
    }


def cancelar_reservas_futuras_por_estacion(
    db: Session,
    estacion: EstacionPropia,
    motivo: str,
    cargador: EstacionCargador | None = None,
) -> int:
    """RN-E06: al inhabilitar, las reservas futuras se cancelan, se reembolsan y se avisa a cada usuario.

    Con `cargador` solo se cancelan las reservas de ese cargador.
    """
    consulta = db.query(Reservas).filter(
        Reservas.estacion_ocm_id == estacion.id,
        Reservas.estado.in_(ESTADOS_RESERVA_VIGENTES),
        Reservas.fecha_hora_fin >= ahora_utc(),
    )
    if cargador is not None:
        consulta = consulta.filter(Reservas.cargador_id.in_(referencias_cargador(db, estacion.id, cargador)))
    futuras = consulta.all()
    for reserva in futuras:
        reembolso = float(reserva.costo_pagado or 0)
        reserva.estado = ESTADO_RESERVA_CANCELADA
        # Igual que cuando el usuario cancela: el pago simulado se devuelve.
        reserva.costo_pagado = 0
        pago = db.query(PagosReserva).filter(PagosReserva.reserva_id == reserva.id).first()
        if pago:
            pago.estado = "reembolsado"
        detalle_reembolso = f" Se devolvieron ${reembolso:,.0f} COP." if reembolso > 0 else ""
        crear_notificacion(
            db,
            reserva.usuario_id,
            "Reserva cancelada",
            (
                f"Tu reserva de {estacion.nombre} del "
                f"{reserva.fecha_hora_inicio.strftime('%d/%m/%Y %H:%M')} fue cancelada. "
                f"Motivo: {motivo}.{detalle_reembolso}"
            ),
            "reserva",
        )
    return len(futuras)


# ---------------------------------------------------------------------------
# Estaciones
# ---------------------------------------------------------------------------

def listar_estaciones_empresa(ctx: dict, db: Session):
    estaciones = (
        db.query(EstacionPropia)
        .filter(
            EstacionPropia.empresa_id == ctx["empresa_id"],
            EstacionPropia.eliminada.is_(False),
        )
        .order_by(EstacionPropia.nombre.asc())
        .all()
    )
    return [serializar_estacion(db, e) for e in estaciones]


def detalle_estacion_empresa(estacion_id: str, ctx: dict, db: Session):
    estacion = obtener_estacion_de_empresa(db, ctx["empresa_id"], estacion_id)
    return serializar_estacion(db, estacion)


def crear_estacion_empresa(data: EstacionEmpresaCreate, ctx: dict, db: Session):
    empresa = ctx["empresa"]
    _validar_nombre_libre(db, empresa.id, data.nombre)

    estado = data.estado or ESTADO_ESTACION_ACTIVA
    if estado == ESTADO_ESTACION_ACTIVA and not any(
        c.estado == CARGADOR_ESTADO_DISPONIBLE for c in data.cargadores
    ):
        raise HTTPException(
            status_code=400,
            detail="Una estación activa necesita al menos un cargador disponible (RN-E03).",
        )

    estacion = EstacionPropia(
        nombre=data.nombre.strip(),
        direccion=(data.direccion or "").strip(),
        lat=data.lat,
        lon=data.lon,
        descripcion=data.descripcion or "",
        # `operador` no viene del cliente: es el nombre comercial de la empresa.
        operador=empresa.nombre_comercial,
        estado=estado,
        activa=estado == ESTADO_ESTACION_ACTIVA,
        empresa_id=empresa.id,
    )
    db.add(estacion)
    # El id se genera al flush: sin esto cargadores e historial nacerían sin estacion_id.
    db.flush()
    cargadores = [
        EstacionCargador(estacion_id=estacion.id, **c.model_dump())
        for c in data.cargadores
    ]
    db.add_all(cargadores)
    sincronizar_campos_legados(estacion, cargadores)
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_CREAR,
        motivo="",
        detalle={"cargadores": len(cargadores), "estado": estado},
    )
    db.commit()
    db.refresh(estacion)
    return serializar_estacion(db, estacion)


def actualizar_estacion_empresa(estacion_id: str, data: EstacionEmpresaUpdate, ctx: dict, db: Session):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    datos = {k: v for k, v in data.model_dump(exclude_unset=True).items() if k in CAMPOS_EDITABLES}
    if not datos:
        return serializar_estacion(db, estacion)

    if datos.get("nombre"):
        _validar_nombre_libre(db, empresa.id, datos["nombre"], excluir_id=estacion.id)
    for campo in ("nombre", "lat", "lon"):
        if campo in datos and datos[campo] is None:
            raise HTTPException(status_code=400, detail=f"El campo '{campo}' no puede quedar vacío.")

    antes = {campo: getattr(estacion, campo) for campo in CAMPOS_EDITABLES}
    for campo, valor in datos.items():
        setattr(estacion, campo, valor.strip() if isinstance(valor, str) else valor)

    cambios = {
        campo: {"antes": antes[campo], "despues": getattr(estacion, campo)}
        for campo in CAMPOS_EDITABLES
        if antes[campo] != getattr(estacion, campo)
    }
    if cambios:
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
    return serializar_estacion(db, estacion)


def eliminar_estacion_empresa(estacion_id: str, motivo: str, ctx: dict, db: Session):
    """RN-E08: borrado lógico, para conservar historial, reseñas y estadísticas."""
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    motivo = motivo.strip()

    canceladas = cancelar_reservas_futuras_por_estacion(db, estacion, motivo)
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
        motivo=motivo,
        detalle={"reservas_canceladas": canceladas},
    )
    db.commit()
    return {"ok": True, "reservas_canceladas": canceladas}


def cambiar_estado_estacion_empresa(estacion_id: str, data: EstacionEstadoUpdate, ctx: dict, db: Session):
    """RN-E03, RN-E04 y RN-E06: usa la misma función de cambio de estado que el admin.

    Import diferido: `estacion_estado_controller` importa helpers de este módulo.
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
    return {**serializar_estacion(db, estacion), "reservas_canceladas": resultado["reservas_canceladas"]}


# ---------------------------------------------------------------------------
# Cargadores
# ---------------------------------------------------------------------------

def _cargador_o_404(db: Session, estacion: EstacionPropia, cargador_id: str) -> EstacionCargador:
    cargador = (
        db.query(EstacionCargador)
        .filter(EstacionCargador.id == cargador_id, EstacionCargador.estacion_id == estacion.id)
        .first()
    )
    if not cargador:
        raise HTTPException(status_code=404, detail="Cargador no encontrado.")
    return cargador


def _validar_queda_disponible(estacion: EstacionPropia, cargadores: list[EstacionCargador]):
    """RN-E03: una estación activa no puede quedarse sin cargadores disponibles."""
    if estacion.estado == ESTADO_ESTACION_ACTIVA and not any(
        c.estado == CARGADOR_ESTADO_DISPONIBLE for c in cargadores
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "La estación activa debe conservar al menos un cargador disponible (RN-E03). "
                "Primero cámbiala a mantenimiento o inactiva."
            ),
        )


def agregar_cargador(estacion_id: str, data: CargadorCreate, ctx: dict, db: Session):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    existentes = cargadores_de(db, estacion.id)
    if any(c.numero == data.numero for c in existentes):
        raise HTTPException(status_code=400, detail=f"Ya existe un cargador #{data.numero} en esta estación.")

    cargador = EstacionCargador(estacion_id=estacion.id, **data.model_dump())
    db.add(cargador)
    sincronizar_campos_legados(estacion, [*existentes, cargador])
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_AGREGAR_CARGADOR,
        motivo="",
        detalle={"numero": data.numero, "tipo_conector": data.tipo_conector, "potencia_kw": data.potencia_kw},
    )
    db.commit()
    db.refresh(estacion)
    return serializar_estacion(db, estacion)


def actualizar_cargador(estacion_id: str, cargador_id: str, data: CargadorUpdate, ctx: dict, db: Session):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    cargador = _cargador_o_404(db, estacion, cargador_id)

    datos = {k: v for k, v in data.model_dump(exclude_unset=True).items() if k in CAMPOS_CARGADOR and v is not None}
    if not datos:
        return serializar_estacion(db, estacion)

    antes = {campo: getattr(cargador, campo) for campo in CAMPOS_CARGADOR}
    for campo, valor in datos.items():
        setattr(cargador, campo, valor)
    existentes = cargadores_de(db, estacion.id)
    _validar_queda_disponible(estacion, existentes)
    sincronizar_campos_legados(estacion, existentes)

    canceladas = 0
    if antes["estado"] == CARGADOR_ESTADO_DISPONIBLE and cargador.estado != CARGADOR_ESTADO_DISPONIBLE:
        # Un cargador fuera de servicio no puede atender las reservas que tenía.
        canceladas = cancelar_reservas_futuras_por_estacion(
            db, estacion, f"El cargador #{cargador.numero} quedó fuera de servicio", cargador=cargador
        )

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
        detalle={"cargador_id": cargador.id, "numero": cargador.numero, "reservas_canceladas": canceladas, **cambios},
    )
    db.commit()
    db.refresh(estacion)
    return {**serializar_estacion(db, estacion), "reservas_canceladas": canceladas}


def quitar_cargador(estacion_id: str, cargador_id: str, ctx: dict, db: Session):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    cargador = _cargador_o_404(db, estacion, cargador_id)
    restantes = [c for c in cargadores_de(db, estacion.id) if c.id != cargador.id]
    _validar_queda_disponible(estacion, restantes)

    numero = cargador.numero
    tipo = cargador.tipo_conector
    canceladas = cancelar_reservas_futuras_por_estacion(
        db, estacion, f"El cargador #{numero} fue retirado de la estación", cargador=cargador
    )
    db.delete(cargador)
    sincronizar_campos_legados(estacion, restantes)
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_QUITAR_CARGADOR,
        motivo="",
        detalle={"numero": numero, "tipo_conector": tipo, "reservas_canceladas": canceladas},
    )
    db.commit()
    db.refresh(estacion)
    return {**serializar_estacion(db, estacion), "reservas_canceladas": canceladas}
