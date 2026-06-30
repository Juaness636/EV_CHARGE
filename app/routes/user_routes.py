# Backend/routes/user_routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db


from controllers.user_controller import (
    get_users,
    get_user,
    create_user,
    update_user,
    delete_user,
    search_user_by_name
)
from schemas.user_schema import UserSchema

router = APIRouter()

@router.get("/error")
def test_error():
    raise Exception("Error de prueba")

@router.get("/users")
def users(db: Session = Depends(get_db)):
    return get_users(db)

@router.get("/users/search/")
def search_user(nombre: str, db: Session = Depends(get_db)):
    return search_user_by_name(nombre, db)

@router.get("/users/{id}")
def user(id: str, db: Session = Depends(get_db)):
    return get_user(id, db)



@router.post("/users")
def store_user(user: UserSchema, db: Session = Depends(get_db)):
    return create_user(user, db)

@router.put("/users/{id}")
def edit_user(id: str, user: UserSchema, db: Session = Depends(get_db)):
    return update_user(id, user, db)

@router.delete("/users/{id}")
def destroy_user(id: str, db: Session = Depends(get_db)):
    return delete_user(id, db)