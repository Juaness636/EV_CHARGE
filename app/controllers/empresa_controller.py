# Backend/controllers/empresa_controller.py
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException

from app.config.database import get_db
from app.models.empresa_model import Empresa
from app.models.estacion_propia_model import EstacionPropia
from app.models.usuario_model import usuarios
from app.schemas.empresa_schema import EmpresaCrear, EmpresaEstadoUpdate, EmpresaUpdate
from app.utils.constantes import EMPRESA_APROBADA, ESTADOS_EMPRESA, ROL_EMPRESA
from app.utils.jwt import get_current_user, require_empresa
from app.utils.security import hash_password
from app.controllers.notificaciones_controller import crear_notificacion


# ---------------------------------------------------------------------------
# Dependencias
# ---------------------------------------------------------------------------

def obtener_empresa_por_usuario(db: Session, usuario_id: str) -> Empresa | None:
    return db.query(Empresa).filter(Empresa.usuario_id == usuario_id).first()


def get_current_empresa(current_user=Depends(require_empresa), db: Session = Depends(get_db)) -> Empresa:
    """Único punto donde se verifica rol + existencia de la fila `empresas`.

    Todas las rutas de empresa dependen de esto, así el aislamiento multi-tenant
    (D3) no depende de que cada endpoint recuerde hacerlo.
    """
    empresa = obtener_empresa_por_usuario(db, current_user.id)
    if not empresa:
        raise HTTPException(
            status_code=403,
            detail="Tu cuenta tiene el rol de empresa pero no tiene perfil asociado. Contacta al administrador.",
        )
    return empresa


def asegurar_empresa_operativa(empresa: Empresa) -> Empresa:
    """RN-E11: pendiente o suspendida puede loguearse y leer, pero no publicar."""
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
    silencio el historial y el ownership, así que se resuelven ambos en un solo lugar.
    """
    return {
        "empresa": empresa,
        "empresa_id": empresa.id,
        "usuario_id": current_user.id,
        "usuario_nombre": f"{current_user.nombre} {current_user.apellido or ''}".strip(),
    }


def notificar_empresa(db: Session, estacion_id: str, titulo: str, mensaje: str, tipo: str = "empresa"):
    """Notifica al usuario dueño de la estación, si es de una empresa.

    No commitea: se usa dentro de la transacción de quien crea el evento.
    Para estaciones OCM o de EV Charge (empresa_id NULL) simplemente no hace nada.
    """
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == estacion_id).first()
    if not estacion or not estacion.empresa_id:
        return None
    empresa = db.query(Empresa).filter(Empresa.id == estacion.empresa_id).first()
    if not empresa:
        return None
    return crear_notificacion(db, empresa.usuario_id, titulo, mensaje, tipo)


# ---------------------------------------------------------------------------
# Perfil de la empresa
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
            "created_at": e.created_at,
            "total_estaciones": conteos.get(e.id, 0),
        }
        for e in empresas
    ]


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
            (Empresa.nombre_comercial.ilike(termino)) | (Empresa.razon_social.ilike(termino))
        )
    if estado:
        consulta = consulta.filter(Empresa.estado == estado)
    return _con_totales(db, consulta.order_by(Empresa.created_at.desc()).all())


def obtener_empresa_admin(eid: str, db: Session):
    empresa = db.query(Empresa).filter(Empresa.id == eid).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")
    return _con_totales(db, [empresa])[0]


def crear_empresa(data: EmpresaCrear, db: Session):
    """Crea en una sola transacción el usuario (rol=empresa) y su perfil de empresa."""
    # El correo se guarda tal cual: `login_user` lo compara exacto, igual que
    # `register_user`. Normalizarlo aquí (p. ej. a minúsculas) rompería el login.
    email = data.usuario_email.strip()
    if db.query(usuarios).filter(usuarios.email == email).first():
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo.")
    if data.nit and db.query(Empresa).filter(Empresa.nit == data.nit).first():
        raise HTTPException(status_code=400, detail="Ya existe una empresa registrada con ese NIT.")

    usuario = usuarios(
        nombre=data.usuario_nombre.strip(),
        apellido=(data.usuario_apellido or "").strip(),
        email=email,
        password_hash=hash_password(data.usuario_password),
        rol=ROL_EMPRESA,
        is_admin=False,
    )
    db.add(usuario)
    db.flush()  # se necesita usuario.id antes de crear la empresa

    empresa = Empresa(
        usuario_id=usuario.id,
        nombre_comercial=data.nombre_comercial.strip(),
        razon_social=data.razon_social,
        nit=data.nit,
        telefono=data.telefono,
        email_contacto=data.email_contacto,
        direccion_sede=data.direccion_sede,
        descripcion=data.descripcion,
        color_hex=data.color_hex,
        logo_url=data.logo_url,
        estado=data.estado,
        creada_por_admin=True,
    )
    db.add(empresa)
    crear_notificacion(
        db,
        usuario.id,
        "Cuenta de empresa creada",
        f"El administrador registró la cuenta de {empresa.nombre_comercial} (estado: {empresa.estado}).",
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


def obtener_perfil_empresa(empresa: Empresa = Depends(get_current_empresa), db: Session = Depends(get_db)):
    return _con_totales(db, [empresa])[0]


def actualizar_perfil_empresa(
    data: EmpresaUpdate,
    empresa: Empresa = Depends(get_current_empresa),
    db: Session = Depends(get_db),
):
    datos = data.model_dump(exclude_unset=True)
    for campo, valor in datos.items():
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


def cambiar_password_por_empresa(
    *,
    old_password: str,
    new_password: str,
    empresa: Empresa = Depends(get_current_empresa),
    db: Session = Depends(get_db),
):
    """La empresa cambia la contraseña de su propia cuenta, sin exponer /auth."""
    from app.controllers.auth_controller import validar_password_fuerte
    from app.utils.security import verify_password

    usuario = db.query(usuarios).filter(usuarios.id == empresa.usuario_id).first()
    if not usuario or not verify_password(old_password, usuario.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")
    validar_password_fuerte(new_password)
    usuario.password_hash = hash_password(new_password)
    crear_notificacion(
        db,
        usuario.id,
        "Contraseña actualizada",
        "Cambiste la contraseña de la cuenta de empresa.",
        "sistema",
    )
    db.commit()
    return {"ok": True}
