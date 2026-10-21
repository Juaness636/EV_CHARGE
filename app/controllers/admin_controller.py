# Backend/controllers/admin_controller.py
from datetime import timezone
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.usuario_model import usuarios
from app.models.vehiculo_model import vehiculos
from app.models.reserva_model import Reservas
from app.models.carga_model import Cargas
from app.models.reporte_model import Reportes
from app.models.calificacion_model import Calificaciones
from app.models.cargador_model import Cargador
from app.models.empresa_model import Empresa
from app.models.estacion_propia_model import EstacionPropia
from app.models.estado_estacion_model import EstadoEstacion
from app.schemas.admin_schema import EstacionPropiaCreate, EstacionPropiaUpdate, EstadoUpdate, AdminReservaUpdate
from app.models.utils import ahora_utc
from app.controllers.estacion_estado_controller import cambiar_estado
from app.controllers.empresa_estaciones_controller import (
    cancelar_reservas_futuras_por_estacion,
    cargadores_effectivos,
    sincronizar_campos_legados,
)
from app.controllers.historial_controller import registrar_historial
from app.controllers.reportes_controller import cambiar_estado_reporte as cambiar_estado_reporte_shared
from app.utils.constantes import (
    ACCION_HISTORIAL_ELIMINAR,
    EMPRESA_APROBADA,
    EMPRESA_PENDIENTE,
    ESTADO_CARGA_COMPLETADA,
    ESTADO_ESTACION_ACTIVA,
    ESTADO_ESTACION_INACTIVA,
    ESTADO_REPORTE_ABIERTO,
    ESTADO_REPORTE_RESUELTO,
    ESTADOS_ESTACION,
    LONGITUD_MINIMA_MOTIVO,
)
import os
import requests


def _nombre_admin(actor) -> str:
    if not actor:
        return "Administrador"
    return f"{actor.nombre} {actor.apellido or ''}".strip() or "Administrador"


def listar_usuarios(db: Session, busqueda: str | None = None):
    consulta = db.query(usuarios)
    if busqueda:
        termino = f"%{busqueda.strip()}%"
        consulta = consulta.filter(
            (usuarios.nombre.ilike(termino))
            | (usuarios.apellido.ilike(termino))
            | (usuarios.email.ilike(termino))
        )
    return consulta.order_by(usuarios.created_at.desc()).all()


def actualizar_usuario(uid: str, data, db: Session):
    usuario = db.query(usuarios).filter(usuarios.id == uid).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    nombre = data.get("nombre")
    apellido = data.get("apellido")
    email = data.get("email")

    if nombre is not None and nombre.strip():
        usuario.nombre = nombre.strip()
    if apellido is not None:
        usuario.apellido = (apellido or "").strip()
    if email is not None and email.strip():
        email_normalizado = email.strip()
        existente = db.query(usuarios).filter(usuarios.email == email_normalizado, usuarios.id != uid).first()
        if existente:
            raise HTTPException(status_code=400, detail="Ya existe otro usuario con ese correo.")
        usuario.email = email_normalizado

    db.commit()
    db.refresh(usuario)
    return usuario


def obtener_estadisticas(db: Session):
    cargas = db.query(Cargas).filter(Cargas.estado == ESTADO_CARGA_COMPLETADA).all()
    return {
        "total_usuarios": db.query(usuarios).count(),
        "total_vehiculos": db.query(vehiculos).count(),
        "total_reservas_activas": db.query(Reservas).filter(Reservas.estado == "activa").count(),
        "total_cargas": len(cargas),
        "total_kwh_cargados": sum(c.kwh_cargados or 0 for c in cargas),
        "total_reportes_abiertos": db.query(Reportes).filter(Reportes.estado == ESTADO_REPORTE_ABIERTO).count(),
        "total_estaciones_propias": db.query(EstacionPropia).filter(EstacionPropia.eliminada.is_(False)).count(),
        "total_empresas": db.query(Empresa).count(),
        "empresas_pendientes": db.query(Empresa).filter(Empresa.estado == EMPRESA_PENDIENTE).count(),
    }


def listar_reportes(db: Session):
    return db.query(Reportes).options(joinedload(Reportes.usuario)).order_by(Reportes.fecha.desc()).all()


def resolver_reporte(rid: str, db: Session):
    return cambiar_estado_reporte_shared(db, rid, ESTADO_REPORTE_RESUELTO)


def cambiar_estado_reporte(rid: str, estado: str, db: Session):
    return cambiar_estado_reporte_shared(db, rid, estado)



def listar_estaciones(db: Session, busqueda: str | None = None, estado: str | None = None):
    consulta = (
        db.query(EstacionPropia)
        .options(joinedload(EstacionPropia.cargadores), joinedload(EstacionPropia.empresa))
        .filter(EstacionPropia.eliminada.is_(False))
    )
    if busqueda:
        termino = f"%{busqueda.strip()}%"
        consulta = consulta.filter(
            (EstacionPropia.id.ilike(termino))
            | (EstacionPropia.nombre.ilike(termino))
            | (EstacionPropia.operador.ilike(termino))
        )
    if estado:
        if estado not in ESTADOS_ESTACION:
            raise HTTPException(status_code=400, detail="Estado de estacion no valido.")
        consulta = consulta.filter(EstacionPropia.estado == estado)
    return [
        {
            "id": e.id,
            "nombre": e.nombre,
            "direccion": e.direccion or "",
            "lat": e.lat,
            "lon": e.lon,
            "tipo_conector": e.tipo_conector,
            "potencia_kw": e.potencia_kw,
            "descripcion": e.descripcion or "",
            "operador": e.operador or "EV Charge",
            "activa": bool(e.activa),
            "estado": e.estado or ESTADO_ESTACION_ACTIVA,
            "created_at": e.created_at,
            # El admin necesita saber de quién es cada estación para no editar la ajena.
            "empresa_id": e.empresa_id,
            "empresa": _marca_estacion(e),
            "cargadores": cargadores_effectivos(e),
            "total_cargadores": len(cargadores_effectivos(e)),
        }
        for e in consulta.all()
    ]


def crear_estacion(data: EstacionPropiaCreate, db: Session):
    if data.estado not in ESTADOS_ESTACION:
        raise HTTPException(status_code=400, detail="Estado de estación no válido.")
    nueva = EstacionPropia(**data.model_dump())
    nueva.estado = data.estado
    nueva.activa = data.estado == ESTADO_ESTACION_ACTIVA
    # El formulario del admin sigue manejando un solo conector: se materializa como
    # el cargador #1 para que `cargadores` sea ya la fuente de verdad.
    nueva.cargadores = [
        Cargador(numero=1, tipo_conector=data.tipo_conector, potencia_kw=data.potencia_kw)
    ]
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


def actualizar_estacion(eid: str, data: EstacionPropiaUpdate, db: Session, admin=None):
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == eid).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    datos = data.model_dump(exclude_unset=True)
    nuevo_id = datos.pop("id", None)
    estado = datos.pop("estado", None)
    if nuevo_id and nuevo_id != eid:
        if db.query(EstacionPropia).filter(EstacionPropia.id == nuevo_id).first():
            raise HTTPException(status_code=400, detail="Ya existe una estación con ese ID.")
        estacion.id = nuevo_id

    motivo = (datos.pop("motivo", None) or "").strip()
    if estado is not None and estado != estacion.estado:
        # El cambio de estado pasa por la misma función que usa la empresa (RN-E03/E04/E06).
        cambiar_estado(
            db,
            estacion,
            estado,
            motivo,
            actor_id=getattr(admin, "id", None),
            actor_nombre=_nombre_admin(admin),
        )
    elif estado is not None:
        estacion.estado = estado
        estacion.activa = estado == ESTADO_ESTACION_ACTIVA

    for key, value in datos.items():
        if value is not None:
            setattr(estacion, key, value)
    _sincronizar_cargador_principal(estacion, datos.get("tipo_conector"), datos.get("potencia_kw"))
    db.commit()
    db.refresh(estacion)
    return estacion


def _sincronizar_cargador_principal(estacion: EstacionPropia, tipo_conector, potencia_kw):
    """El formulario del admin edita un solo conector; se refleja en el cargador #1.

    Sin esto, `cargadores` (la fuente de verdad) y los campos legados divergen según
    desde qué panel se edite la estación.
    """
    if tipo_conector is None and potencia_kw is None:
        return
    if not estacion.cargadores:
        if tipo_conector and potencia_kw:
            estacion.cargadores.append(
                Cargador(numero=1, tipo_conector=tipo_conector, potencia_kw=potencia_kw)
            )
        return
    principal = min(estacion.cargadores, key=lambda c: c.numero)
    if tipo_conector:
        principal.tipo_conector = tipo_conector
    if potencia_kw:
        principal.potencia_kw = potencia_kw
    # Se deja `sincronizar_campos_legados` correr para que los campos legados queden
    # derivados de los cargadores, que es la regla del módulo.
    sincronizar_campos_legados(estacion)



def cambiar_estado_estacion(eid: str, data: EstadoUpdate, db: Session, admin=None):
    """Cambio de estado desde el panel de admin, por la misma vía que usa la empresa.

    Con `empresa_id` la consulta se restringe a las estaciones de esa empresa, así el
    endpoint de `/empresa` puede delegar aquí sin revelar que una estación existe.
    """
    consulta = db.query(EstacionPropia).filter(EstacionPropia.id == eid)
    if data.empresa_id:
        consulta = consulta.filter(EstacionPropia.empresa_id == data.empresa_id)
    estacion = consulta.first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")

    resultado = cambiar_estado(
        db,
        estacion,
        data.estado,
        data.motivo or "",
        actor_id=getattr(admin, "id", None),
        actor_nombre=_nombre_admin(admin),
    )
    db.commit()
    db.refresh(estacion)
    return resultado


def cambiar_estado_estacion_ocm(eid: str, data: EstadoUpdate, db: Session):
    if data.estado not in ESTADOS_ESTACION:
        raise HTTPException(status_code=400, detail="Estado de estación no válido.")
    estado = db.query(EstadoEstacion).filter(EstadoEstacion.estacion_ocm_id == eid).first()
    if not estado:
        estado = EstadoEstacion(estacion_ocm_id=eid, estado=data.estado)
        db.add(estado)
    else:
        estado.estado = data.estado
    db.commit()
    db.refresh(estado)
    return {"estacion_ocm_id": estado.estacion_ocm_id, "estado": estado.estado}


def listar_estaciones_ocm_admin(db: Session, busqueda: str | None = None, estado: str | None = None):
    if estado and estado not in ESTADOS_ESTACION:
        raise HTTPException(status_code=400, detail="Estado de estacion no valido.")
    url = "https://api.openchargemap.io/v3/poi/?output=json&countrycode=CO&latitude=4.6651&longitude=-74.1204&distance=20&distanceunit=KM&compact=false&verbose=false&maxresults=50"
    try:
        externas = requests.get(url, params={"key": os.getenv("OCM_API_KEY", "")}, timeout=10).json()
    except requests.RequestException as error:
        raise HTTPException(status_code=503, detail="No se pudieron consultar las estaciones externas.") from error
    overrides = {item.estacion_ocm_id: item for item in db.query(EstadoEstacion).all()}
    resultado = []
    for estacion in externas:
        eid = str(estacion.get("ID", ""))
        info = estacion.get("AddressInfo") or {}
        override = overrides.get(eid)
        if override and override.eliminada:
            continue
        resultado.append({
            "id": eid,
            "nombre": (override.nombre if override and override.nombre else info.get("Title", "Estación")),
            "direccion": (override.direccion if override and override.direccion else info.get("AddressLine1", "")),
            "operador": (override.operador if override and override.operador else (estacion.get("OperatorInfo") or {}).get("Title", "No informado")),
            "lat": override.lat if override and override.lat is not None else info.get("Latitude"),
            "lon": override.lon if override and override.lon is not None else info.get("Longitude"),
            "estado": override.estado if override else "activa",
            "origen": "OpenChargeMap",
            "empresa": None,
            "conectores": [
                {
                    "tipo": (conector.get("ConnectionType") or {}).get("Title", "No especificado"),
                    "potencia_kw": conector.get("PowerKW"),
                    "corriente": (conector.get("CurrentType") or {}).get("Title", "No especificada"),
                    "bahias": conector.get("Quantity") or 1,
                }
                for conector in estacion.get("Connections") or []
            ],
        })
    ids_externos = {item["id"] for item in resultado}
    propias = (
        db.query(EstacionPropia)
        .options(joinedload(EstacionPropia.cargadores), joinedload(EstacionPropia.empresa))
        .filter(EstacionPropia.eliminada.is_(False))
        .all()
    )
    for estacion in propias:
        if estacion.id in ids_externos:
            continue
        resultado.append({
            "id": estacion.id,
            "nombre": estacion.nombre,
            "direccion": estacion.direccion or "",
            "operador": estacion.operador or "EV Charge",
            "lat": estacion.lat,
            "lon": estacion.lon,
            "estado": estacion.estado or ("activa" if estacion.activa else "inactiva"),
            "origen": "Empresa" if estacion.empresa_id else "EV Charge",
            "empresa": _marca_estacion(estacion),
            # Fuente de verdad: los cargadores, con fallback al campo legado.
            "conectores": [
                {
                    "tipo": c["tipo_conector"],
                    "potencia_kw": c["potencia_kw"],
                    "corriente": "No especificada",
                    "bahias": 1,
                    "numero": c["numero"],
                    "estado": c["estado"],
                    "cargador_id": c["id"],
                }
                for c in cargadores_effectivos(estacion)
            ],
        })
    if busqueda:
        termino = busqueda.casefold().strip()
        resultado = [
            estacion for estacion in resultado
            if termino in estacion["id"].casefold()
            or termino in estacion["nombre"].casefold()
            or termino in estacion["operador"].casefold()
        ]
    if estado:
        resultado = [estacion for estacion in resultado if estacion["estado"] == estado]
    return resultado


def _marca_estacion(estacion: EstacionPropia):
    """Nombre, color y logo de la empresa para pintar el marcador (RN-E10)."""
    empresa = estacion.empresa
    if not empresa:
        return None
    return {
        "id": empresa.id,
        "nombre": empresa.nombre_comercial,
        "color_hex": empresa.color_hex,
        "logo_url": empresa.logo_url,
        "estado": empresa.estado,
    }


def listar_estaciones_mapa(db: Session):
    """Payload de `/estaciones-mapa` (mapa público), con la marca de cada empresa.

    Van aquí las estaciones de empresa aprobadas (RN-E11: pendiente o suspendida no
    publica) y las de EV Charge; se excluyen las borradas y las inactivas, que ya no
    son un punto donde cargar.
    """
    estaciones = listar_estaciones_ocm_admin(db)
    payload = []
    for estacion in estaciones:
        marca = estacion.get("empresa")
        if marca and marca["estado"] != EMPRESA_APROBADA:
            continue
        if estacion["origen"] != "OpenChargeMap" and estacion["estado"] == ESTADO_ESTACION_INACTIVA:
            continue
        payload.append({
            "ID": estacion["id"],
            "AddressInfo": {
                "Title": estacion["nombre"],
                "AddressLine1": estacion["direccion"],
                "Latitude": estacion["lat"],
                "Longitude": estacion["lon"],
            },
            "OperatorInfo": {"Title": estacion["operador"]},
            "Estado": estacion["estado"],
            "Origen": estacion["origen"],
            "Empresa": marca,
            "Connections": [{
                "ConnectionType": {"Title": conector["tipo"]},
                "PowerKW": conector["potencia_kw"],
                "CurrentType": {"Title": conector["corriente"]},
                "Quantity": conector["bahias"],
                "Estado": conector.get("estado"),
                "CargadorId": conector.get("cargador_id"),
                "Numero": conector.get("numero"),
            } for conector in estacion["conectores"]],
        })
    return payload


def actualizar_estacion_ocm(eid: str, data, db: Session):
    if data.estado is not None and data.estado not in ESTADOS_ESTACION:
        raise HTTPException(status_code=400, detail="Estado de estación no válido.")
    estado = db.query(EstadoEstacion).filter(EstadoEstacion.estacion_ocm_id == eid).first()
    if not estado:
        estado = EstadoEstacion(estacion_ocm_id=eid)
        db.add(estado)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(estado, key, value)
    db.commit()
    db.refresh(estado)
    return {"id": eid, "nombre": estado.nombre, "direccion": estado.direccion, "operador": estado.operador, "lat": estado.lat, "lon": estado.lon, "estado": estado.estado}


def eliminar_estacion_ocm(eid: str, db: Session):
    estado = db.query(EstadoEstacion).filter(EstadoEstacion.estacion_ocm_id == eid).first()
    if not estado:
        estado = EstadoEstacion(estacion_ocm_id=eid)
        db.add(estado)
    estado.eliminada = True
    estado.estado = "inactiva"
    db.commit()
    return {"ok": True}


def eliminar_estacion(eid: str, db: Session, motivo: str = "", admin=None):
    """RN-E08: borrado lógico. El historial y las estadísticas necesitan la fila.

    Antes esto era `db.delete()`, que con el módulo de empresas habría borrado también
    los cargadores, los incidentes y (vía snapshot) dejaba el historial huérfano.
    """
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == eid).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")

    motivo_limpio = (motivo or "").strip()
    if len(motivo_limpio) < LONGITUD_MINIMA_MOTIVO:
        raise HTTPException(
            status_code=400,
            detail=f"El motivo es obligatorio y debe tener al menos {LONGITUD_MINIMA_MOTIVO} caracteres.",
        )

    canceladas = cancelar_reservas_futuras_por_estacion(db, estacion, motivo_limpio)
    estacion.eliminada = True
    estacion.estado = ESTADO_ESTACION_INACTIVA
    estacion.activa = False
    registrar_historial(
        db,
        empresa_id=estacion.empresa_id,
        usuario_id=getattr(admin, "id", None),
        usuario_nombre=_nombre_admin(admin),
        estacion=estacion,
        accion=ACCION_HISTORIAL_ELIMINAR,
        motivo=motivo_limpio,
        detalle={"reservas_canceladas": canceladas, "por": "admin"},
    )
    db.commit()
    return {"ok": True, "reservas_canceladas": canceladas}


def listar_reservas(db: Session):
    reservas = db.query(Reservas).all()
    # La relación 'usuario' en el modelo Reservas nos permite acceder
    # a los datos del usuario que creó la reserva
    return reservas


def actualizar_reserva(rid: str, data: AdminReservaUpdate, db: Session):
    reserva = db.query(Reservas).filter(Reservas.id == rid).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")

    datos = data.model_dump(exclude_unset=True)
    inicio = datos.get("fecha_hora_inicio") or reserva.fecha_hora_inicio
    fin = datos.get("fecha_hora_fin") or reserva.fecha_hora_fin
    inicio_utc = inicio.replace(tzinfo=timezone.utc) if inicio.tzinfo is None else inicio
    fin_utc = fin.replace(tzinfo=timezone.utc) if fin.tzinfo is None else fin

    if inicio_utc >= fin_utc:
        raise HTTPException(status_code=400, detail="Inicio debe ser anterior a Fin.")
    if inicio_utc < ahora_utc():
        raise HTTPException(status_code=400, detail="La reserva no puede estar en una fecha pasada.")

    estado = datos.get("estado", reserva.estado)
    if estado == "activa":
        solapada = db.query(Reservas).filter(
            Reservas.id != rid,
            Reservas.estacion_ocm_id == reserva.estacion_ocm_id,
            Reservas.estado == "activa",
            Reservas.fecha_hora_inicio < fin,
            Reservas.fecha_hora_fin > inicio,
        ).first()
        if solapada:
            raise HTTPException(status_code=400, detail="La estación ya tiene una reserva activa en ese horario.")

    for key, value in datos.items():
        setattr(reserva, key, value)
    db.commit()
    db.refresh(reserva)
    return reserva


def eliminar_reserva(rid: str, db: Session):
    reserva = db.query(Reservas).filter(Reservas.id == rid).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    db.delete(reserva)
    db.commit()
    return {"ok": True}


def listar_calificaciones(db: Session):
    calificaciones = db.query(Calificaciones).options(joinedload(Calificaciones.usuario)).all()
    return [{
        "id": cal.id,
        "usuario_id": cal.usuario_id,
        "usuario_nombre": f"{cal.usuario.nombre} {cal.usuario.apellido or ''}".strip(),
        "estacion_ocm_id": cal.estacion_ocm_id,
        "estacion_nombre": cal.estacion_nombre,
        "puntaje": cal.puntaje,
        "comentario": cal.comentario,
        "fecha": cal.fecha,
    } for cal in calificaciones]
