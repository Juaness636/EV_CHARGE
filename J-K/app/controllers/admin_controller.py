# Backend/controllers/admin_controller.py
from datetime import timezone
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.usuario_model import usuarios
from app.models.vehiculo_model import vehiculos
from app.models.reserva_model import Reservas
from app.models.carga_model import Cargas
from app.models.reporte_model import Reportes
from app.models.calificacion_model import Calificaciones
from app.models.notificacion_model import Notificacion
from app.models.estacion_propia_model import EstacionPropia
from app.models.estacion_cargador_model import EstacionCargador
from app.models.estado_estacion_model import EstadoEstacion
from app.models.empresa_model import Empresa
from app.schemas.admin_schema import EstacionPropiaCreate, EstacionPropiaUpdate, EstadoUpdate, AdminReservaUpdate
from app.models.utils import ahora_utc
from app.controllers.notificaciones_controller import crear_notificacion
from app.controllers.empresa_controller import marca_empresa
from app.controllers.empresa_fotos_controller import urls_fotos_por_estacion
from app.utils.constantes import EMPRESA_APROBADA, EMPRESA_PENDIENTE, ROL_ADMIN, ROL_EMPRESA, ROL_USUARIO
from app.utils.estaciones_empresa import empresa_por_texto, lista_palabras
import os
import requests
import time
import math
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed


# Centros de cobertura para consultar las principales zonas habitadas del país.
# Los resultados se combinan por ID para evitar duplicados en zonas superpuestas.
CENTROS_COLOMBIA = [
    ("Bogotá", 4.6651, -74.1204), ("Medellín", 6.2442, -75.5812),
    ("Tunja", 5.5353, -73.3678), ("Cali", 3.4516, -76.5320),
    ("Barranquilla", 10.9685, -74.7813), ("Cartagena", 10.3910, -75.4794),
    ("Bucaramanga", 7.1193, -73.1227), ("Pereira", 4.8143, -75.6946),
    ("Manizales", 5.0703, -75.5138), ("Armenia", 4.5339, -75.6811),
    ("Ibagué", 4.4389, -75.2322), ("Neiva", 2.9273, -75.2819),
    ("Villavicencio", 4.1420, -73.6266), ("Pasto", 1.2136, -77.2811),
    ("Cúcuta", 7.8939, -72.5078), ("Santa Marta", 11.2408, -74.1990),
    ("Valledupar", 10.4631, -73.2532), ("Montería", 8.7479, -75.8814),
    ("Sincelejo", 9.3047, -75.3978), ("Popayán", 2.4448, -76.6147),
    ("Quibdó", 5.6947, -76.6611), ("Riohacha", 11.5444, -72.9072),
    ("Yopal", 5.3378, -72.3959), ("Florencia", 1.6144, -75.6062),
]
DEPARTAMENTO_POR_CIUDAD = {
    "Bogotá": "Bogotá D.C.", "Medellín": "Antioquia", "Tunja": "Boyacá", "Cali": "Valle del Cauca",
    "Barranquilla": "Atlántico", "Cartagena": "Bolívar", "Bucaramanga": "Santander", "Pereira": "Risaralda",
    "Manizales": "Caldas", "Armenia": "Quindío", "Ibagué": "Tolima", "Neiva": "Huila", "Villavicencio": "Meta",
    "Pasto": "Nariño", "Cúcuta": "Norte de Santander", "Santa Marta": "Magdalena", "Valledupar": "Cesar",
    "Montería": "Córdoba", "Sincelejo": "Sucre", "Popayán": "Cauca", "Quibdó": "Chocó", "Riohacha": "La Guajira",
    "Yopal": "Casanare", "Florencia": "Caquetá",
}
_ESTACIONES_OCM_CACHE: tuple[float, list[tuple[dict, str]]] | None = None
_ESTACIONES_OCM_CACHE_TTL = 300


def operador_visible(valor, contexto: str = "") -> str:
    """Evita mostrar valores técnicos de OCM como '(Unknown Operator)'."""
    operador = str(valor or "").strip()
    desconocidos = {"", "unknown operator", "unknown", "null", "none", "n/a"}
    if operador.casefold() not in desconocidos:
        return operador
    texto = contexto.casefold()
    for nombre in ("enel x", "enelx", "terpel", "primax", "ecopetrol"):
        if nombre in texto:
            return nombre.upper() if nombre in {"enel x", "enelx"} else nombre.title()
    return "Operador no informado"


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

    if set(data) - {"is_admin"}:
        raise HTTPException(status_code=400, detail="Solo se puede modificar el rol del usuario.")
    if "is_admin" not in data or not isinstance(data["is_admin"], bool):
        raise HTTPException(status_code=400, detail="El rol debe indicar si el usuario es administrador.")
    # Una cuenta de empresa se gestiona desde el módulo de empresas, no como administrador.
    if usuario.rol == ROL_EMPRESA:
        raise HTTPException(status_code=400, detail="Las cuentas de empresa no pueden ser administradoras.")
    usuario.rol = ROL_ADMIN if data["is_admin"] else ROL_USUARIO

    db.commit()
    db.refresh(usuario)
    return usuario


def obtener_estadisticas(db: Session):
    total_cargas = db.query(Cargas).count()
    total_kwh_cargados = db.query(func.coalesce(func.sum(Cargas.kwh_cargados), 0)).scalar() or 0
    return {
        "total_usuarios": db.query(usuarios).count(),
        "total_vehiculos": db.query(vehiculos).count(),
        "total_reservas_activas": db.query(Reservas).filter(Reservas.estado == "activa").count(),
        "total_cargas": total_cargas,
        "total_kwh_cargados": float(total_kwh_cargados),
        "total_reportes_abiertos": db.query(Reportes).filter(Reportes.estado == "abierto").count(),
        "total_estaciones_propias": db.query(EstacionPropia).filter(EstacionPropia.eliminada.is_(False)).count(),
        "total_empresas": db.query(Empresa).count(),
        "empresas_pendientes": db.query(Empresa).filter(Empresa.estado == EMPRESA_PENDIENTE).count(),
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
    if estado not in {"abierto", "mantenimiento", "resuelto", "fuera_servicio"}:
        raise HTTPException(status_code=400, detail="Estado de reporte no válido.")
    reporte = db.query(Reportes).filter(Reportes.id == rid).first()
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado.")
    reporte.estado = estado
    if estado == "mantenimiento":
        propia = db.query(EstacionPropia).filter(EstacionPropia.id == reporte.estacion_ocm_id).first()
        if propia:
            propia.estado = "mantenimiento"
            propia.activa = False
        else:
            estado_estacion = db.query(EstadoEstacion).filter(EstadoEstacion.estacion_ocm_id == reporte.estacion_ocm_id).first()
            if not estado_estacion:
                estado_estacion = EstadoEstacion(estacion_ocm_id=reporte.estacion_ocm_id)
                db.add(estado_estacion)
            estado_estacion.estado = "mantenimiento"
    elif estado == "fuera_servicio":
        propia = db.query(EstacionPropia).filter(EstacionPropia.id == reporte.estacion_ocm_id).first()
        if propia:
            propia.estado = "inactiva"
            propia.activa = False
        else:
            estado_estacion = db.query(EstadoEstacion).filter(EstadoEstacion.estacion_ocm_id == reporte.estacion_ocm_id).first()
            if not estado_estacion:
                estado_estacion = EstadoEstacion(estacion_ocm_id=reporte.estacion_ocm_id)
                db.add(estado_estacion)
            estado_estacion.estado = "inactiva"
    elif estado == "resuelto":
        propia = db.query(EstacionPropia).filter(EstacionPropia.id == reporte.estacion_ocm_id).first()
        if propia:
            propia.estado = "activa"
            propia.activa = True
        else:
            estado_estacion = db.query(EstadoEstacion).filter(EstadoEstacion.estacion_ocm_id == reporte.estacion_ocm_id).first()
            if estado_estacion:
                estado_estacion.estado = "activa"
    crear_notificacion(db, reporte.usuario_id, "Estado de reporte actualizado", f"Tu reporte de {reporte.estacion_nombre or reporte.estacion_ocm_id} ahora está {estado}.", "reporte")
    db.commit()
    db.refresh(reporte)
    return reporte


def listar_estaciones(db: Session, busqueda: str | None = None, estado: str | None = None):
    consulta = db.query(EstacionPropia).filter(EstacionPropia.eliminada.is_(False))
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
    datos = data.model_dump(exclude={"cargadores"})
    nueva = EstacionPropia(**datos)
    nueva.activa = data.estado == "activa"
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    cargadores = data.cargadores or [{
        "tipo_conector": data.tipo_conector,
        "potencia_kw": data.potencia_kw,
        "corriente": "No especificada",
        "bahias": 1,
    }]
    for numero, cargador in enumerate(cargadores, start=1):
        datos_cargador = cargador.model_dump(exclude={"id"}) if hasattr(cargador, "model_dump") else dict(cargador)
        datos_cargador["numero"] = datos_cargador.get("numero") or numero
        db.add(EstacionCargador(estacion_id=nueva.id, **datos_cargador))
    db.commit()
    return nueva


def actualizar_estacion(eid: str, data: EstacionPropiaUpdate, db: Session):
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == eid).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    if estacion.empresa_id:
        # Los datos y cargadores de una estación de empresa los mantiene la empresa
        # (con su historial); el admin puede cambiar su estado o retirarla.
        raise HTTPException(
            status_code=400,
            detail="Las estaciones de empresa las edita la propia empresa. Puedes cambiar su estado o retirarla.",
        )
    datos = data.model_dump(exclude_unset=True)
    cargadores = datos.pop("cargadores", None)
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
    if cargadores is not None:
        existentes = db.query(EstacionCargador).filter(EstacionCargador.estacion_id == estacion.id).all()
        for cargador in existentes:
            db.delete(cargador)
        db.flush()
        for numero, cargador in enumerate(cargadores, start=1):
            datos_cargador = {key: value for key, value in cargador.items() if key != "id" and value is not None}
            datos_cargador["numero"] = datos_cargador.get("numero") or numero
            db.add(EstacionCargador(estacion_id=estacion.id, **datos_cargador))
    db.commit()
    db.refresh(estacion)
    return estacion


def cambiar_estado_estacion(eid: str, data: EstadoUpdate, db: Session, admin=None):
    if data.estado not in {"activa", "mantenimiento", "inactiva"}:
        raise HTTPException(status_code=400, detail="Estado de estación no válido.")
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == eid).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    if estacion.empresa_id:
        # Las estaciones de empresa pasan por la misma regla que usa la empresa:
        # motivo, historial y cancelación de reservas futuras.
        from app.controllers.estacion_estado_controller import cambiar_estado
        from app.controllers.empresa_controller import notificar_empresa

        motivo = (data.motivo or "").strip() or "Cambio realizado por el administrador de EV Charge"
        cambiar_estado(
            db,
            estacion,
            data.estado,
            motivo,
            actor_id=admin.id if admin else None,
            actor_nombre="Administrador EV Charge",
        )
        notificar_empresa(
            db,
            estacion.id,
            "Estado de estación actualizado",
            f"El administrador cambió {estacion.nombre} a {data.estado}. Motivo: {motivo}",
        )
        db.commit()
        db.refresh(estacion)
        return estacion
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
    url = "https://api.openchargemap.io/v3/poi/"
    api_key = os.getenv("OCM_API_KEY", "").strip()
    if api_key.startswith("OCM_API_KEY="):
        api_key = api_key.split("=", 1)[1].strip()
    global _ESTACIONES_OCM_CACHE
    ahora = time.monotonic()
    if _ESTACIONES_OCM_CACHE and ahora - _ESTACIONES_OCM_CACHE[0] < _ESTACIONES_OCM_CACHE_TTL:
        externas = _ESTACIONES_OCM_CACHE[1]
    else:
        def consultar_centro(centro):
            ciudad, latitud, longitud = centro
            try:
                respuesta = requests.get(
                    url,
                    params={
                        "output": "json", "countrycode": "CO",
                        "latitude": latitud, "longitude": longitud,
                        "distance": 60, "distanceunit": "KM",
                        "compact": "false", "verbose": "false",
                        "maxresults": 100, "key": api_key,
                    },
                    timeout=15,
                )
                respuesta.raise_for_status()
                datos = respuesta.json()
                return [(estacion, ciudad) for estacion in datos] if isinstance(datos, list) else []
            except (requests.RequestException, ValueError, TypeError) as error:
                print(f"[MAPA] No se pudieron cargar estaciones de {ciudad}: {type(error).__name__}")
                return []

        externas = []
        with ThreadPoolExecutor(max_workers=6) as executor:
            tareas = [executor.submit(consultar_centro, centro) for centro in CENTROS_COLOMBIA]
            for tarea in as_completed(tareas):
                externas.extend(tarea.result())
        _ESTACIONES_OCM_CACHE = (ahora, externas)
    overrides = {item.estacion_ocm_id: item for item in db.query(EstadoEstacion).all()}
    # Estaciones de la API que pasan a una empresa por sus palabras clave ("enel x", "terpel").
    empresas_con_palabras = [
        (empresa, lista_palabras(empresa.palabras_clave))
        for empresa in db.query(Empresa).filter(Empresa.palabras_clave.isnot(None)).all()
    ]
    resultado = []
    ids_procesados = set()
    for estacion, ciudad in externas:
        eid = str(estacion.get("ID", ""))
        if not eid or eid in ids_procesados:
            continue
        ids_procesados.add(eid)
        info = estacion.get("AddressInfo") or {}
        override = overrides.get(eid)
        if override and override.eliminada:
            continue
        ciudad_real = info.get("Town") or info.get("City") or ciudad
        duena = empresa_por_texto(
            " ".join(filter(None, [
                info.get("Title"),
                override.nombre if override else None,
                (estacion.get("OperatorInfo") or {}).get("Title"),
                override.operador if override else None,
            ])),
            empresas_con_palabras,
        )
        resultado.append({
            "id": eid,
            "nombre": (override.nombre if override and override.nombre else info.get("Title", "Estación")),
            "direccion": (override.direccion if override and override.direccion else info.get("AddressLine1", "")),
            "operador": operador_visible(
                override.operador if override and override.operador else (estacion.get("OperatorInfo") or {}).get("Title"),
                f"{info.get('Title', '')} {info.get('AddressLine1', '')}",
            ),
            "lat": override.lat if override and override.lat is not None else info.get("Latitude"),
            "lon": override.lon if override and override.lon is not None else info.get("Longitude"),
            "estado": override.estado if override else "activa",
            "ciudad": ciudad_real,
            "departamento": info.get("StateOrProvince", ""),
            "origen": "OpenChargeMap",
            "empresa": marca_empresa(duena),
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
    centros_ciudad = {nombre: (latitud, longitud) for nombre, latitud, longitud in CENTROS_COLOMBIA}
    empresas = {empresa.id: empresa for empresa in db.query(Empresa).all()}
    propias = db.query(EstacionPropia).filter(EstacionPropia.eliminada.is_(False)).all()
    fotos_por_estacion = urls_fotos_por_estacion(db, [estacion.id for estacion in propias])
    for estacion in propias:
        if estacion.id in ids_externos:
            continue
        ciudad_propia = min(
            centros_ciudad,
            key=lambda nombre: (
                (estacion.lat - centros_ciudad[nombre][0]) ** 2
                + (estacion.lon - centros_ciudad[nombre][1]) ** 2
            ),
        )
        cargadores = (
            db.query(EstacionCargador)
            .filter(EstacionCargador.estacion_id == estacion.id)
            .order_by(EstacionCargador.numero.asc().nullslast(), EstacionCargador.id.asc())
            .all()
        )
        conectores = [{
            "id": cargador.id,
            "numero": cargador.numero,
            "tipo": cargador.tipo_conector,
            "potencia_kw": cargador.potencia_kw,
            "corriente": cargador.corriente or "No especificada",
            "bahias": cargador.bahias,
            "estado": cargador.estado or "disponible",
        } for cargador in cargadores]
        if not conectores:
            conectores = [{
                "tipo": estacion.tipo_conector,
                "potencia_kw": estacion.potencia_kw,
                "corriente": "No especificada",
                "bahias": 1,
            }]
        resultado.append({
            "id": estacion.id,
            "nombre": estacion.nombre,
            "direccion": estacion.direccion or "",
            "operador": operador_visible(estacion.operador, estacion.nombre),
            "lat": estacion.lat,
            "lon": estacion.lon,
            "estado": estacion.estado or ("activa" if estacion.activa else "inactiva"),
            "ciudad": ciudad_propia,
            "departamento": DEPARTAMENTO_POR_CIUDAD.get(ciudad_propia, ""),
            "origen": "Empresa" if estacion.empresa_id else "EV Charge",
            "empresa": marca_empresa(empresas.get(estacion.empresa_id)),
            "fotos": fotos_por_estacion.get(estacion.id, []),
            "conectores": conectores,
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
    estaciones = []
    for estacion in listar_estaciones_ocm_admin(db):
        empresa = estacion.get("empresa")
        if empresa and empresa["estado"] != EMPRESA_APROBADA:
            # RN-E11: una empresa pendiente o suspendida no publica sus estaciones en el mapa.
            # Las de la API sí siguen visibles (existen de verdad), solo sin la marca de la empresa.
            if estacion.get("origen") != "OpenChargeMap":
                continue
            estacion = {**estacion, "empresa": None}
        estaciones.append(estacion)
    return [{
        "ID": estacion["id"],
        "AddressInfo": {
            "Title": estacion["nombre"],
            "AddressLine1": estacion["direccion"],
            "Latitude": estacion["lat"],
            "Longitude": estacion["lon"],
            "Town": estacion.get("ciudad", ""),
            "StateOrProvince": estacion.get("departamento", ""),
        },
        "OperatorInfo": {"Title": estacion["operador"]},
        # RN-E10: nombre, color y logo de la empresa para pintar su marcador.
        "Empresa": estacion.get("empresa"),
        # Fotos que subió la empresa dueña (rutas relativas al backend, servidas en /media).
        "Fotos": estacion.get("fotos") or [],
        "City": estacion.get("ciudad", ""),
        "StateOrProvince": estacion.get("departamento", ""),
        "Connections": [{
            "ID": conector.get("id"),
            "ConnectionType": {"Title": conector["tipo"]},
            "PowerKW": conector["potencia_kw"],
            "CurrentType": {"Title": conector["corriente"]},
            "Quantity": conector["bahias"],
            # Los cargadores de empresa pueden quedar fuera de servicio individualmente.
            "Estado": conector.get("estado") or "disponible",
        } for conector in estacion["conectores"]],
    } for estacion in estaciones]


def listar_estaciones_mapa_cercanas(db: Session, latitud: float, longitud: float, radio_km: float = 25):
    if not (-90 <= latitud <= 90 and -180 <= longitud <= 180):
        raise HTTPException(status_code=400, detail="Coordenadas de ubicación no válidas.")
    radio_km = min(max(radio_km, 1), 25)
    estaciones = listar_estaciones_mapa(db)

    def distancia_km(estacion):
        info = estacion.get("AddressInfo") or {}
        lat = info.get("Latitude")
        lon = info.get("Longitude")
        if lat is None or lon is None:
            return math.inf
        d_lat = math.radians(lat - latitud)
        d_lon = math.radians(lon - longitud)
        lat1 = math.radians(latitud)
        lat2 = math.radians(lat)
        valor = math.sin(d_lat / 2) ** 2 + math.sin(d_lon / 2) ** 2 * math.cos(lat1) * math.cos(lat2)
        return 6371 * 2 * math.atan2(math.sqrt(valor), math.sqrt(1 - valor))

    return [estacion for estacion in estaciones if distancia_km(estacion) <= radio_km]


def listar_estaciones_mapa_bogota(db: Session):
    estaciones = listar_estaciones_mapa(db)
    nombres_bogota = {"bogota", "bogota dc", "bogota distrito capital", "d c"}
    resultado = []
    for estacion in estaciones:
        info = estacion.get("AddressInfo") or {}
        ciudad = str(info.get("Town") or info.get("City") or estacion.get("City") or "")
        clave = unicodedata.normalize("NFD", ciudad).encode("ascii", "ignore").decode("ascii").lower().replace(",", "").replace(".", "").strip()
        if clave in nombres_bogota:
            resultado.append(estacion)
    return resultado


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
    return {"id": eid, "nombre": estado.nombre, "direccion": estado.direccion, "operador": operador_visible(estado.operador, estado.nombre or ""), "lat": estado.lat, "lon": estado.lon, "estado": estado.estado}


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
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == eid, EstacionPropia.eliminada.is_(False)).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    if estacion.empresa_id:
        # Las estaciones de empresa se borran de forma lógica: su historial y
        # sus estadísticas siguen perteneciendo a la empresa.
        from app.controllers.empresa_estaciones_controller import cancelar_reservas_futuras_por_estacion
        from app.controllers.historial_controller import registrar_historial
        from app.controllers.empresa_controller import notificar_empresa

        motivo = "Estación retirada por el administrador de EV Charge"
        canceladas = cancelar_reservas_futuras_por_estacion(db, estacion, motivo)
        estacion.eliminada = True
        estacion.estado = "inactiva"
        estacion.activa = False
        registrar_historial(
            db,
            empresa_id=estacion.empresa_id,
            usuario_id=None,
            usuario_nombre="Administrador EV Charge",
            estacion=estacion,
            accion="eliminar",
            motivo=motivo,
            detalle={"reservas_canceladas": canceladas},
        )
        notificar_empresa(db, estacion.id, "Estación eliminada", f"El administrador retiró {estacion.nombre}.")
        db.commit()
        return {"ok": True}
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

    estado = data.estado
    if estado not in {"activa", "rechazada", "realizada"}:
        raise HTTPException(status_code=400, detail="Estado de reserva no válido.")
    if reserva.estado == "realizada":
        return reserva

    if estado == "activa":
        solapada = db.query(Reservas).filter(
            Reservas.id != rid,
            Reservas.estacion_ocm_id == reserva.estacion_ocm_id,
            Reservas.cargador_id == (reserva.cargador_id or f"{reserva.estacion_ocm_id}-general"),
            Reservas.estado == "activa",
            Reservas.fecha_hora_inicio < reserva.fecha_hora_fin,
            Reservas.fecha_hora_fin > reserva.fecha_hora_inicio,
        ).first()
        if solapada:
            raise HTTPException(status_code=400, detail="No se puede aceptar: la estación ya tiene una reserva activa en ese horario.")

    reserva.estado = estado
    if estado == "realizada":
        referencia = f"Carga generada desde la reserva {reserva.id}"
        carga_existente = db.query(Cargas).filter(Cargas.notas == referencia).first()
        if not carga_existente:
            duracion_horas = max(
                0,
                (reserva.fecha_hora_fin - reserva.fecha_hora_inicio).total_seconds() / 3600,
            )
            kwh_simulados = round(duracion_horas * 7.4, 2)
            db.add(Cargas(
                usuario_id=reserva.usuario_id,
                estacion_ocm_id=reserva.estacion_ocm_id,
                cargador_id=reserva.cargador_id,
                estacion_nombre=reserva.estacion_nombre or "",
                kwh_cargados=kwh_simulados,
                # Conserva el valor que el usuario aprobó al pagar su reserva.
                costo_estimado=reserva.costo_pagado or max(1, round(duracion_horas)) * 5000,
                notas=referencia,
                estado="validada",
            ))
            crear_notificacion(
                db,
                reserva.usuario_id,
                "Carga validada",
                f"La carga realizada en {reserva.estacion_nombre or reserva.estacion_ocm_id} ya fue validada por el administrador.",
                "carga",
            )
    titulo = "Reserva aceptada" if estado == "activa" else "Reserva rechazada" if estado == "rechazada" else "Reserva realizada"
    mensaje = (
        f"Tu reserva de {reserva.estacion_nombre or reserva.estacion_ocm_id} fue aceptada por el administrador."
        if estado == "activa" else
        f"Tu reserva de {reserva.estacion_nombre or reserva.estacion_ocm_id} fue rechazada por el administrador."
        if estado == "rechazada" else
        f"La reserva de {reserva.estacion_nombre or reserva.estacion_ocm_id} fue marcada como realizada."
    )
    crear_notificacion(
        db,
        reserva.usuario_id,
        titulo,
        mensaje,
        "reserva",
    )
    db.commit()
    db.refresh(reserva)
    return reserva


def eliminar_reserva(rid: str, db: Session):
    reserva = db.query(Reservas).filter(Reservas.id == rid).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    if reserva.estado != "realizada":
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar reservas realizadas.")
    db.delete(reserva)
    db.commit()
    return {"ok": True}


def listar_cargas_admin(db: Session):
    cargas = (
        db.query(Cargas)
        .options(joinedload(Cargas.usuario))
        .order_by(Cargas.fecha.desc())
        .all()
    )
    return [
        {
            "id": carga.id,
            "usuario_id": carga.usuario_id,
            "usuario_nombre": (
                f"{carga.usuario.nombre} {carga.usuario.apellido or ''}".strip()
                if carga.usuario else "Usuario eliminado"
            ),
            "usuario_email": carga.usuario.email if carga.usuario else "",
            "estacion_ocm_id": carga.estacion_ocm_id,
            "cargador_id": carga.cargador_id,
            "estacion_nombre": carga.estacion_nombre or "",
            "kwh_cargados": carga.kwh_cargados,
            "costo_estimado": carga.costo_estimado,
            "notas": carga.notas or "",
            "estado": carga.estado or "pendiente",
            "fecha": carga.fecha,
        }
        for carga in cargas
    ]


def listar_notificaciones_admin(db: Session):
    filas = (
        db.query(Notificacion, usuarios)
        .join(usuarios, usuarios.id == Notificacion.usuario_id)
        .order_by(Notificacion.created_at.desc())
        .all()
    )
    return [
        {
            "id": notificacion.id,
            "usuario_id": notificacion.usuario_id,
            "usuario_nombre": f"{usuario.nombre} {usuario.apellido or ''}".strip(),
            "usuario_email": usuario.email,
            "titulo": notificacion.titulo,
            "mensaje": notificacion.mensaje,
            "tipo": notificacion.tipo,
            "leida": notificacion.leida,
            "created_at": notificacion.created_at,
        }
        for notificacion, usuario in filas
    ]


def actualizar_carga_admin(cid: str, estado: str, db: Session):
    if estado not in {"pendiente", "validada", "rechazada"}:
        raise HTTPException(status_code=400, detail="Estado de carga no válido.")
    carga = db.query(Cargas).filter(Cargas.id == cid).first()
    if not carga:
        raise HTTPException(status_code=404, detail="Carga no encontrada.")
    carga.estado = estado
    db.commit()
    db.refresh(carga)
    return carga


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
