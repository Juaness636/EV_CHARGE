# Backend/controllers/auth_controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.usuario_model import usuarios
from app.utils.security import hash_password, verify_password
from app.utils.jwt import create_access_token


def register_user(db: Session, nombre: str, apellido: str, email: str, password: str):
    existe = db.query(usuarios).filter(usuarios.email == email).first()
    if existe:
        raise HTTPException(status_code=400, detail="El correo ya está registrado.")

    nuevo_usuario = usuarios(
        nombre=nombre.strip(),
        apellido=(apellido or "").strip(),
        email=email.strip(),
        password_hash=hash_password(password),
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    token = create_access_token({"sub": nuevo_usuario.id})
    return {"access_token": token, "token_type": "bearer", "usuario": nuevo_usuario}


def login_user(db: Session, email: str, password: str):
    usuario = db.query(usuarios).filter(usuarios.email == email).first()
    if not usuario or not verify_password(password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    token = create_access_token({"sub": usuario.id})
    return {"access_token": token, "token_type": "bearer", "usuario": usuario}


def obtener_perfil(current_user, db: Session):
    from app.models.vehiculo_model import vehiculos

    db.refresh(current_user)
    vehiculo_activo = (
        db.query(vehiculos)
        .filter(vehiculos.usuario_id == current_user.id, vehiculos.activo == True)
        .first()
    )
    return {"usuario": current_user, "vehiculo_activo": vehiculo_activo}


def actualizar_perfil(current_user, data, db: Session):
    if data.nombre and data.nombre.strip():
        current_user.nombre = data.nombre.strip()
    if data.apellido is not None:
        current_user.apellido = data.apellido.strip()
    if data.email and str(data.email).strip():
        ocupado = (
            db.query(usuarios)
            .filter(usuarios.email == data.email, usuarios.id != current_user.id)
            .first()
        )
        if ocupado:
            raise HTTPException(status_code=400, detail="El correo ya está registrado por otro usuario.")
        current_user.email = data.email

    db.commit()
    db.refresh(current_user)
    return {"usuario": current_user}


def cambiar_password(current_user, data, db: Session):
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"ok": True}