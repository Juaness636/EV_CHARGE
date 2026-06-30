# Backend/controllers/user_controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException
from models.models import usuarios 
from schemas.user_schema import UserSchema
import uuid

def validar_uuid(id_string: str):
    try:
        uuid.UUID(id_string)
    except ValueError:
        raise HTTPException(status_code=400, detail="El formato del ID (UUID) suministrado no es válido.")

def get_users(db: Session):
    return db.query(usuarios).all()

def get_user(id: str, db: Session):
    validar_uuid(id)
    usuario = db.query(usuarios).filter(usuarios.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return usuario

def create_user(user: UserSchema, db: Session):
    # Comprobar si el email ya existe en la base de datos
    existe = db.query(usuarios).filter(usuarios.email == user.email).first()
    if existe:
        raise HTTPException(status_code=400, detail="Este correo electrónico ya está registrado.")
    
    # Creamos el registro mapeando los nuevos campos del script SQL
    # Nota: Aquí puedes usar librerías como passlib/bcrypt para hashear 'user.password' en producción
    nuevo_usuario = usuarios(
        nombre=user.nombre, 
        email=user.email, 
        password_hash=user.password,  # Mapeado a password_hash
        is_admin=user.is_admin
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return {"mensaje": "Usuario registrado ✅", "usuario": nuevo_usuario}

def update_user(id: str, user: UserSchema, db: Session):
    validar_uuid(id)
    usuario = db.query(usuarios).filter(usuarios.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    
    # Verificar que el nuevo email no le pertenezca a otro ID diferente
    correo_ocupado = db.query(usuarios).filter(usuarios.email == user.email, usuarios.id != id).first()
    if correo_ocupado:
        raise HTTPException(status_code=400, detail="Este correo ya está en uso por otro usuario.")
    
    usuario.nombre = user.nombre
    usuario.email = user.email
    usuario.password_hash = user.password
    usuario.is_admin = user.is_admin
    
    db.commit()
    db.refresh(usuario)
    return {"mensaje": "Usuario actualizado correctamente ✅", "usuario": usuario}

def delete_user(id: str, db: Session):
    validar_uuid(id)
    usuario = db.query(usuarios).filter(usuarios.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    
    db.delete(usuario)
    db.commit()
    return {"mensaje": f"Usuario con ID {id} eliminado permanentemente ❌"}

def search_user_by_name(nombre: str, db: Session):
    usuarios_encontrados = db.query(usuarios).filter(
    usuarios.nombre.ilike(f"%{nombre}%")
    ).all()

    if not usuarios_encontrados:
        raise HTTPException(status_code=404, detail="No se encontraron usuarios con ese nombre.")

    return usuarios_encontrados

