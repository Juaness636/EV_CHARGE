# Backend/controllers/empresa_controller.py
from fastapi import Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.notificaciones_controller import crear_notificacion
from app.models.empresa_model import Empresa
from app.models.estacion_propia_model import EstacionPropia
from app.models.usuario_model import usuarios
from app.schemas.empresa_schema import EmpresaCrear, EmpresaEstadoUpdate, EmpresaPalabrasUpdate, EmpresaUpdate
from app.utils.constantes import EMPRESA_APROBADA, ESTADOS_EMPRESA, ROL_ADMIN, ROL_EMPRESA
from app.utils.jwt import get_current_user, require_empresa
from app.utils.estaciones_empresa import lista_palabras
from app.utils.security import hash_password, verify_password


# ---------------------------------------------------------------------------
# Dependencias
# ---------------------------------------------------------------------------

def obtener_empresa_por_usuario(db: Session, usuario_id: str) -> Empresa | None:
    return db.query(Empresa).filter(Empresa.usuario_id == usuario_id).first()


def get_current_empresa(current_user=Depends(require_empresa), db: Session = Depends(get_db)) -> Empresa:
    """Único punto donde se verifica rol + existencia de la fila `empresas`.

    Todas las rutas de empresa dependen de esto, así el aislamiento entre empresas
    no depende de que cada endpoint recuerde hacerlo.
    """
    empresa = obtener_empresa_por_usuario(db, current_user.id)
    if not empresa:
        raise HTTPException(
            status_code=403,
            detail="Tu cuenta tiene el rol de empresa pero no tiene perfil asociado. Contacta al administrador.",
        )
    return empresa


def asegurar_empresa_operativa(empresa: Empresa) -> Empresa:
    """RN-E11: pendiente o suspendida puede entrar y consultar, pero no publicar ni modificar."""
    if empresa.estado != EMPRESA_APROBADA:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Tu empresa está en estado '{empresa.estado}'. "
                "Debe estar aprobada por el administrador para gestionar estaciones."
            ),
        )
    return empresa


def get_current_user_empresa(
    current_user=Depends(get_current_user),
    empresa: Empresa = Depends(get_current_empresa),
) -> dict:
    """Contexto (empresa, usuario) para las rutas de empresa.

    `Empresa.id` y `usuarios.id` son UUIDs distintos: confundirlos rompería en
    silencio el historial y la propiedad, así que se resuelven ambos en un solo lugar.
    """
    return {
        "empresa": empresa,
        "empresa_id": empresa.id,
        "usuario_id": current_user.id,
        "usuario_email": current_user.email,
        "usuario_nombre": f"{current_user.nombre} {current_user.apellido or ''}".strip(),
    }


def operar(ctx: dict = Depends(get_current_user_empresa)) -> dict:
    """Rutas de escritura: exigen la empresa aprobada (RN-E11)."""
    asegurar_empresa_operativa(ctx["empresa"])
    return ctx


# ---------------------------------------------------------------------------
# Serialización
# ---------------------------------------------------------------------------

def _con_totales(db: Session, empresas: list[Empresa]) -> list[dict]:
    if not empresas:
        return []
    ids = [e.id for e in empresas]
    conteos = dict(
        db.query(EstacionPropia.empresa_id, func.count(EstacionPropia.id))
        .filter(EstacionPropia.empresa_id.in_(ids), EstacionPropia.eliminada.is_(False))
        .group_by(EstacionPropia.empresa_id)
        .all()
    )
    correos = dict(
        db.query(usuarios.id, usuarios.email)
        .filter(usuarios.id.in_([e.usuario_id for e in empresas]))
        .all()
    )
    return [
        {
            "id": e.id,
            "usuario_id": e.usuario_id,
            "nombre_comercial": e.nombre_comercial,
            "razon_social": e.razon_social,
            "nit": e.nit,
            "telefono": e.telefono,
            "email_contacto": e.email_contacto,
            "direccion_sede": e.direccion_sede,
            "descripcion": e.descripcion,
            "color_hex": e.color_hex,
            "logo_url": e.logo_url,
            "estado": e.estado,
            "palabras_clave": e.palabras_clave,
            "created_at": e.created_at,
            "total_estaciones": conteos.get(e.id, 0),
            "usuario_email": correos.get(e.usuario_id),
        }
        for e in empresas
    ]


def marca_empresa(empresa: Empresa | None) -> dict | None:
    """Nombre, color y logo de la empresa para pintar el marcador en el mapa (RN-E10)."""
    if not empresa:
        return None
    return {
        "id": empresa.id,
        "nombre": empresa.nombre_comercial,
        "color_hex": empresa.color_hex,
        "logo_url": empresa.logo_url,
        "estado": empresa.estado,
    }


def notificar_empresa(db: Session, estacion_id: str, titulo: str, mensaje: str, tipo: str = "empresa"):
    """Notifica a la empresa dueña de la estación. No hace nada para estaciones sin empresa.

    No commitea: se usa dentro de la transacción de quien crea el evento.
    """
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == estacion_id).first()
    if not estacion or not estacion.empresa_id:
        return None
    empresa = db.query(Empresa).filter(Empresa.id == estacion.empresa_id).first()
    if not empresa:
        return None
    return crear_notificacion(db, empresa.usuario_id, titulo, mensaje, tipo)


# ---------------------------------------------------------------------------
# Administración de empresas (solo admin)
# ---------------------------------------------------------------------------

def listar_empresas_admin(db: Session, busqueda: str | None = None, estado: str | None = None):
    if estado and estado not in ESTADOS_EMPRESA:
        raise HTTPException(
            status_code=400,
            detail=f"Estado de empresa no válido. Use uno de: {', '.join(ESTADOS_EMPRESA)}.",
        )
    consulta = db.query(Empresa)
    if busqueda:
        termino = f"%{busqueda.strip()}%"
        consulta = consulta.filter(
            Empresa.nombre_comercial.ilike(termino)
            | Empresa.razon_social.ilike(termino)
            | Empresa.nit.ilike(termino)
            | Empresa.email_contacto.ilike(termino)
        )
    if estado:
        consulta = consulta.filter(Empresa.estado == estado)
    return _con_totales(db, consulta.order_by(Empresa.created_at.desc()).all())


def obtener_empresa_admin(eid: str, db: Session):
    empresa = db.query(Empresa).filter(Empresa.id == eid).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")
    return _con_totales(db, [empresa])[0]


def _vincular_usuario_existente(db: Session, correo: str) -> usuarios:
    """Convierte un usuario ya registrado en la cuenta de acceso de la empresa."""
    usuario = db.query(usuarios).filter(usuarios.email == correo).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="No hay ningún usuario registrado con ese correo.")
    if usuario.rol == ROL_ADMIN:
        raise HTTPException(status_code=400, detail="Un administrador no puede ser la cuenta de una empresa.")
    if usuario.rol == ROL_EMPRESA or obtener_empresa_por_usuario(db, usuario.id):
        raise HTTPException(status_code=400, detail="Ese usuario ya es la cuenta de otra empresa.")
    usuario.rol = ROL_EMPRESA
    return usuario


def _validar_palabras_libres(db: Session, palabras_clave: str | None, empresa_id: str | None = None):
    """Una palabra clave no puede ser de dos empresas: cada estación tendría dos dueños."""
    nuevas = lista_palabras(palabras_clave)
    if not nuevas:
        return
    otras = db.query(Empresa).filter(Empresa.palabras_clave.isnot(None))
    if empresa_id:
        otras = otras.filter(Empresa.id != empresa_id)
    for otra in otras.all():
        repetidas = [p for p in nuevas if any(p in suya or suya in p for suya in lista_palabras(otra.palabras_clave))]
        if repetidas:
            raise HTTPException(
                status_code=400,
                detail=f"La palabra clave \"{repetidas[0]}\" choca con la empresa {otra.nombre_comercial}. Usa una más específica.",
            )


def actualizar_palabras_empresa(eid: str, data: EmpresaPalabrasUpdate, db: Session):
    empresa = db.query(Empresa).filter(Empresa.id == eid).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")
    _validar_palabras_libres(db, data.palabras_clave, empresa.id)
    empresa.palabras_clave = data.palabras_clave
    db.commit()
    db.refresh(empresa)
    return _con_totales(db, [empresa])[0]


def crear_empresa(data: EmpresaCrear, db: Session):
    """Crea la empresa con una cuenta nueva (rol=empresa) o vinculando un usuario existente."""
    from app.controllers.auth_controller import validar_password_fuerte

    if data.nit and db.query(Empresa).filter(Empresa.nit == data.nit).first():
        raise HTTPException(status_code=400, detail="Ya existe una empresa registrada con ese NIT.")
    _validar_palabras_libres(db, data.palabras_clave)

    # Mismo criterio que registro y login de Avanze: el correo se guarda en minúsculas.
    if data.usuario_existente_email:
        usuario = _vincular_usuario_existente(db, str(data.usuario_existente_email).strip().lower())
    else:
        email = str(data.usuario_email).strip().lower()
        if db.query(usuarios).filter(usuarios.email == email).first():
            raise HTTPException(
                status_code=400,
                detail="Ya existe un usuario con ese correo. Usa la opción de vincular un usuario existente.",
            )
        validar_password_fuerte(data.usuario_password)
        usuario = usuarios(
            nombre=data.usuario_nombre.strip(),
            apellido=(data.usuario_apellido or "").strip(),
            email=email,
            password_hash=hash_password(data.usuario_password),
            rol=ROL_EMPRESA,
        )
        db.add(usuario)
    db.flush()  # se necesita usuario.id antes de crear la empresa

    empresa = Empresa(
        usuario_id=usuario.id,
        nombre_comercial=data.nombre_comercial.strip(),
        razon_social=data.razon_social,
        nit=data.nit,
        telefono=data.telefono,
        email_contacto=str(data.email_contacto) if data.email_contacto else None,
        direccion_sede=data.direccion_sede,
        descripcion=data.descripcion,
        color_hex=data.color_hex,
        logo_url=data.logo_url,
        estado=data.estado,
        palabras_clave=data.palabras_clave,
        creada_por_admin=True,
    )
    db.add(empresa)
    crear_notificacion(
        db,
        usuario.id,
        "Cuenta de empresa creada",
        (
            f"El administrador vinculó tu cuenta a la empresa {empresa.nombre_comercial} (estado: {empresa.estado}). "
            "Desde ahora entras al panel de empresa."
            if data.usuario_existente_email
            else f"El administrador registró la cuenta de {empresa.nombre_comercial} (estado: {empresa.estado})."
        ),
        "empresa",
    )
    db.commit()
    db.refresh(empresa)
    return _con_totales(db, [empresa])[0]


def cambiar_estado_empresa(eid: str, data: EmpresaEstadoUpdate, db: Session):
    empresa = db.query(Empresa).filter(Empresa.id == eid).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")
    if empresa.estado == data.estado:
        return _con_totales(db, [empresa])[0]

    empresa.estado = data.estado
    motivo = (data.motivo or "").strip()
    mensaje = f"Tu empresa {empresa.nombre_comercial} ahora está en estado {data.estado}."
    if motivo:
        mensaje = f"{mensaje} Motivo: {motivo}"
    crear_notificacion(db, empresa.usuario_id, "Estado de empresa actualizado", mensaje, "empresa")
    db.commit()
    db.refresh(empresa)
    return _con_totales(db, [empresa])[0]


# ---------------------------------------------------------------------------
# Perfil de la propia empresa
# ---------------------------------------------------------------------------

def obtener_perfil_empresa(empresa: Empresa, db: Session):
    return _con_totales(db, [empresa])[0]


def actualizar_perfil_empresa(data: EmpresaUpdate, empresa: Empresa, db: Session):
    datos = data.model_dump(exclude_unset=True)
    for campo, valor in datos.items():
        if campo == "email_contacto" and valor is not None:
            valor = str(valor)
        setattr(empresa, campo, valor.strip() if isinstance(valor, str) else valor)
    crear_notificacion(
        db,
        empresa.usuario_id,
        "Perfil de empresa actualizado",
        "Actualizaste los datos de tu empresa.",
        "empresa",
    )
    db.commit()
    db.refresh(empresa)
    return _con_totales(db, [empresa])[0]


def cambiar_password_por_empresa(*, old_password: str, new_password: str, empresa: Empresa, db: Session):
    """La empresa cambia la contraseña de su propia cuenta."""
    from app.controllers.auth_controller import validar_password_fuerte

    usuario = db.query(usuarios).filter(usuarios.id == empresa.usuario_id).first()
    if not usuario or not verify_password(old_password, usuario.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")
    validar_password_fuerte(new_password)
    usuario.password_hash = hash_password(new_password)
    crear_notificacion(
        db,
        usuario.id,
        "Contraseña actualizada",
        "Cambiaste la contraseña de la cuenta de empresa.",
        "sistema",
    )
    db.commit()
    return {"ok": True}
