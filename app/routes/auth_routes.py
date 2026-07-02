# Backend/routes/auth_routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db
from controllers.auth_controller import register_user, login_user
from fastapi.security import OAuth2PasswordRequestForm
from schemas.user_schema import UserSchema, UserResponse

router = APIRouter()

# Registro usando tus esquemas unificados
@router.post("/auth/registro", response_model=UserResponse)
def register(user: UserSchema, db: Session = Depends(get_db)):
    resultado = register_user(db, user.nombre, user.email, user.password)
    return {
        "status": "success",
        "mensaje": resultado["msg"]
    }

# Login oficial usando el formulario estándar de FastAPI
@router.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    return login_user(db, form_data.username, form_data.password)