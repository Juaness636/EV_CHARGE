from fastapi import APIRouter, Depends, Query  # <-- Importamos Query
from sqlalchemy.orm import Session
from config.database import get_db
from typing import List
from controllers.user_controller import (
    get_users,
    get_user,
    create_user,
    update_user,
    delete_user,
    search_user_by_name
)
from schemas.user_schema import UserSchema, UserResponse

router = APIRouter()

@router.get("/error")
def test_error():
    raise Exception("Error de prueba")

@router.get("/users")
def users(db: Session = Depends(get_db)):
    return get_users(db)

# 1. Ajustado para recibir múltiples nombres en la URL y estructurar la respuesta segura
@router.get("/users/search", response_model=UserResponse)
def search_user(nombre: List[str] = Query(...), db: Session = Depends(get_db)):
    return search_user_by_name(nombre, db)

# 2. Obtener un usuario por ID
@router.get("/users/{id}", response_model=UserResponse)
def user(id: str, db: Session = Depends(get_db)):
    return get_user(id, db)

# 3. Crear usuario
@router.post("/users", response_model=UserResponse)
def store_user(user: UserSchema, db: Session = Depends(get_db)):
    return create_user(user, db)

# 4. Editar usuario
@router.put("/users/{id}", response_model=UserResponse)
def edit_user(id: str, user: UserSchema, db: Session = Depends(get_db)):
    return update_user(id, user, db)

# 5. Eliminar usuario
@router.delete("/users/{id}")
def destroy_user(id: str, db: Session = Depends(get_db)):
    return delete_user(id, db)