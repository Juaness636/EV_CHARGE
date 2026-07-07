# Backend/controllers/user_controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException
from sqlalchemy import or_  # <-- Necesario para buscar múltiples nombres a la vez
from app.models import usuarios
from schemas.user_schema import UserSchema
import uuid
from utils.response import success_response, error_response  

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
    existe = db.query(usuarios).filter(usuarios.email == user.email).first()
    if existe:
        raise HTTPException(status_code=400, detail="Este correo electrónico ya está registrado.")
    
    nuevo_usuario = usuarios(
        nombre=user.nombre, 
        email=user.email, 
        password_hash=user.password,  
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

# Esta versión maneja múltiples nombres limpiamente
def search_user_by_name(nombre: list[str], db: Session):
    filtros = [usuarios.nombre.ilike(f"%{n}%") for n in nombre]
    usuarios_encontrados = db.query(usuarios).filter(or_(*filtros)).all()

    if not usuarios_encontrados:
        return error_response(
            message="Búsqueda sin resultados",
            error_details="No se encontraron usuarios con los nombres suministrados.",
            status_code=404
        )

    data_resultados = [
        {
            "id": u.id, 
            "nombre": u.nombre, 
            "email": u.email,
            "is_admin": u.is_admin
        } 
        for u in usuarios_encontrados
    ]
    
    return success_response(
        message="Usuarios encontrados correctamente 🔍",
        data=data_resultados,
        status_code=200
    )