# Backend/routes/auth_routes.py
from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

from app.config.database import get_db
from app.utils.jwt import get_current_user
from app.utils.rate_limit import ip_cliente
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
    PerfilOut,
    PerfilActualizadoOut,
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/registro", response_model=TokenOut)
def registro(
    data: UsuarioRegistro,
    tareas: BackgroundTasks,
    db: Session = Depends(get_db)
):
    return register_user(db, data.nombre, data.apellido, data.email, data.password, tareas)


@router.post("/login", response_model=TokenOut)
def login(request: Request, tareas: BackgroundTasks, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    return login_user(
        db,
        form.username,
        form.password,
        ip=ip_cliente(request),
        user_agent=request.headers.get("user-agent", ""),
        tareas=tareas,
    )


# response_model filtra el objeto ORM: nunca salen password_hash ni datos del PIN.
@router.get("/perfil", response_model=PerfilOut)
def perfil(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return obtener_perfil(current_user, db)


@router.put("/perfil", response_model=PerfilActualizadoOut)
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
