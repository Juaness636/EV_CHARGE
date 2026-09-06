# Backend/routes/auth_routes.py
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

from app.config.database import get_db
from app.utils.jwt import get_current_user
from app.controllers.auth_controller import (
    register_user,
    login_user,
    obtener_perfil,
    actualizar_perfil,
    cambiar_password,
)
from app.schemas.auth_schemas import (
    UsuarioRegistro,
    TokenOut,
    PerfilUpdate,
    PasswordUpdate,
)
from app.utils.email_service import enviar_correo_bienvenida_smtp 

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/registro", response_model=TokenOut)
def registro(
    data: UsuarioRegistro, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # 1. Guardamos el usuario en la base de datos
    resultado = register_user(db, data.nombre, data.apellido, data.email, data.password)
    
    # 2. Programamos el correo para que se envíe en segundo plano
    background_tasks.add_task(
        enviar_correo_bienvenida_smtp,
        data.email,
        data.nombre,
        resultado.get("email_verificacion_token"),
    )
    
    # 3. Retornamos la respuesta (el token) al frontend inmediatamente
    return resultado


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    return login_user(db, form.username, form.password)


@router.get("/perfil")
def perfil(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return obtener_perfil(current_user, db)


@router.put("/perfil")
def perfil_actualizar(
    data: PerfilUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return actualizar_perfil(current_user, data, db)


@router.put("/password")
def password_actualizar(
    data: PasswordUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return cambiar_password(current_user, data, db)
