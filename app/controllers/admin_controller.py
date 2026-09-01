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
from app.models.estacion_propia_model import EstacionPropia
from app.models.estado_estacion_model import EstadoEstacion
from app.schemas.admin_schema import EstacionPropiaCreate, EstacionPropiaUpdate, EstadoUpdate, AdminReservaUpdate
from app.models.utils import ahora_utc
from app.controllers.notificaciones_controller import crear_notificacion
from app.models.estado_estacion_model import EstadoEstacion
import os
import requests


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
    cargas = db.query(Cargas).all()
    return {
        "total_usuarios": db.query(usuarios).count(),
        "total_vehiculos": db.query(vehiculos).count(),
        "total_reservas_activas": db.query(Reservas).filter(Reservas.estado == "activa").count(),
        "total_cargas": len(cargas),
        "total_kwh_cargados": sum(c.kwh_cargados for c in cargas) if cargas else 0.0,
        "total_reportes_abiertos": db.query(Reportes).filter(Reportes.estado == "abierto").count(),
        "total_estaciones_propias": db.query(EstacionPropia).count(),
    }


def listar_reportes(db: Session):
    return db.query(Reportes).options(joinedload(Reportes.usuario)).order_by(Reportes.fecha.desc()).all()


def resolver_reporte(rid: str, db: Session):
    reporte = db.query(Reportes).filter(Reportes.id == rid).first()
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado.")
    reporte.estado = "resuelto"
    crear_notificacion(db, reporte.usuario_id, "Reporte resuelto", f"Tu reporte de {reporte.estacion_nombre or reporte.estacion_ocm_id} fue resuelto por el administrador.", "reporte")
    db.commit()
    db.refresh(reporte)
    return reporte


def cambiar_estado_reporte(rid: str, estado: str, db: Session):
    if estado not in {"abierto", "resuelto", "descartado"}:
        raise HTTPException(status_code=400, detail="Estado de reporte no válido.")
    reporte = db.query(Reportes).filter(Reportes.id == rid).first()
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado.")
    reporte.estado = estado
    crear_notificacion(db, reporte.usuario_id, "Estado de reporte actualizado", f"Tu reporte de {reporte.estacion_nombre or reporte.estacion_ocm_id} ahora está {estado}.", "reporte")
    db.commit()
    db.refresh(reporte)
    return reporte


def listar_estaciones(db: Session, busqueda: str | None = None, estado: str | None = None):
    consulta = db.query(EstacionPropia)
    if busqueda:
        termino = f"%{busqueda.strip()}%"
        consulta = consulta.filter(
            (EstacionPropia.id.ilike(termino))
            | (EstacionPropia.nombre.ilike(termino))
            | (EstacionPropia.operador.ilike(termino))
        )
    if estado:
        if estado not in {"activa", "mantenimiento", "inactiva"}:
            raise HTTPException(status_code=400, detail="Estado de estacion no valido.")
        consulta = consulta.filter(EstacionPropia.estado == estado)
    return consulta.all()


def crear_estacion(data: EstacionPropiaCreate, db: Session):
    if data.estado not in {"activa", "mantenimiento", "inactiva"}:
        raise HTTPException(status_code=400, detail="Estado de estación no válido.")
    nueva = EstacionPropia(**data.model_dump())
    nueva.activa = data.estado == "activa"
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


def actualizar_estacion(eid: str, data: EstacionPropiaUpdate, db: Session):
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
    if estado is not None:
        if estado not in {"activa", "mantenimiento", "inactiva"}:
            raise HTTPException(status_code=400, detail="Estado de estación no válido.")
        estacion.estado = estado
        estacion.activa = estado == "activa"
    for key, value in datos.items():
        if value is not None:
            setattr(estacion, key, value)
    db.commit()
    db.refresh(estacion)
    return estacion


def cambiar_estado_estacion(eid: str, data: EstadoUpdate, db: Session):
    if data.estado not in {"activa", "mantenimiento", "inactiva"}:
        raise HTTPException(status_code=400, detail="Estado de estación no válido.")
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == eid).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    estacion.estado = data.estado
    estacion.activa = data.estado == "activa"
    db.commit()
    db.refresh(estacion)
    return estacion


def cambiar_estado_estacion_ocm(eid: str, data: EstadoUpdate, db: Session):
    if data.estado not in {"activa", "mantenimiento", "inactiva"}:
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
    if estado and estado not in {"activa", "mantenimiento", "inactiva"}:
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
    for estacion in db.query(EstacionPropia).all():
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
            "origen": "EV Charge",
            "conectores": [{
                "tipo": estacion.tipo_conector,
                "potencia_kw": estacion.potencia_kw,
                "corriente": "No especificada",
                "bahias": 1,
            }],
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


def listar_estaciones_mapa(db: Session):
    estaciones = listar_estaciones_ocm_admin(db)
    return [{
        "ID": estacion["id"],
        "AddressInfo": {
            "Title": estacion["nombre"],
            "AddressLine1": estacion["direccion"],
            "Latitude": estacion["lat"],
            "Longitude": estacion["lon"],
        },
        "OperatorInfo": {"Title": estacion["operador"]},
        "Connections": [{
            "ConnectionType": {"Title": conector["tipo"]},
            "PowerKW": conector["potencia_kw"],
            "CurrentType": {"Title": conector["corriente"]},
            "Quantity": conector["bahias"],
        } for conector in estacion["conectores"]],
    } for estacion in estaciones]


def actualizar_estacion_ocm(eid: str, data, db: Session):
    if data.estado is not None and data.estado not in {"activa", "mantenimiento", "inactiva"}:
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


def eliminar_estacion(eid: str, db: Session):
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == eid).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    db.delete(estacion)
    db.commit()
    return {"ok": True}


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
