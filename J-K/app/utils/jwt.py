# Backend/utils/jwt.py
import hashlib
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from jose import jwt, JWTError
from fastapi import HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.utils.constantes import ROL_EMPRESA

load_dotenv()

SECRET_KEY = (os.getenv("SECRET_KEY") or "").strip()
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY es obligatoria y debe configurarse en el archivo .env")
# Con una clave corta o de ejemplo cualquiera podría firmar un token de administrador.
if len(SECRET_KEY) < 32 or SECRET_KEY.lower() in {"12345678", "secret", "changeme", "tu_clave_secreta"}:
    raise RuntimeError(
        "SECRET_KEY es demasiado débil: usa al menos 32 caracteres aleatorios. "
        "Genera una con: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


TOKEN_ACCESO = "access"
TOKEN_RESETEO = "reset"
RESET_TOKEN_EXPIRE_MINUTES = 10


def create_access_token(data: dict, token_version: int = 0):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # `ver` permite invalidar todas las sesiones al cambiar la contraseña.
    to_encode.update({"exp": expire, "typ": TOKEN_ACCESO, "ver": token_version})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _huella_password(password_hash: str) -> str:
    return hashlib.sha256(f"{SECRET_KEY}:{password_hash}".encode()).hexdigest()[:24]


def create_reset_token(usuario) -> str:
    """Token de un solo uso para cambiar la contraseña después de verificar el PIN.

    Lleva una huella del hash actual de la contraseña: en cuanto la contraseña cambia,
    el token deja de servir aunque no haya vencido.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": usuario.id, "typ": TOKEN_RESETEO, "pwd": _huella_password(usuario.password_hash), "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def usuario_de_reset_token(token: str, db: Session):
    from app.models.usuario_model import usuarios

    invalido = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="El enlace de recuperación no es válido o ya venció. Solicita un nuevo código.")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise invalido
    if payload.get("typ") != TOKEN_RESETEO or not payload.get("sub"):
        raise invalido
    usuario = db.query(usuarios).filter(usuarios.id == payload["sub"]).first()
    if not usuario or payload.get("pwd") != _huella_password(usuario.password_hash):
        raise invalido
    return usuario


def verify_token(token: str = Depends(oauth2_scheme)):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from app.models.usuario_model import usuarios
 
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id or payload.get("typ", TOKEN_ACCESO) != TOKEN_ACCESO:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    usuario = db.query(usuarios).filter(usuarios.id == user_id).first()
    if not usuario:
        raise credentials_exception
    # Tokens emitidos antes de un cambio de contraseña quedan revocados.
    if int(payload.get("ver", 0)) != int(usuario.token_version or 0):
        raise credentials_exception
    return usuario


def require_admin(current_user=Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acceso solo para administradores")
    return current_user


def require_role(*roles: str):
    """Dependencia que solo acepta usuarios con uno de `roles`.

    El rol se lee siempre de la base de datos (vía `get_current_user`), nunca del token,
    así suspender o cambiar el rol de una cuenta tiene efecto inmediato.
    """

    def dependencia(current_user=Depends(get_current_user)):
        if current_user.rol not in roles:
            permitidos = " o ".join(roles)
            raise HTTPException(
                status_code=403,
                detail=f"Acceso restringido: se requiere rol {permitidos}.",
            )
        return current_user

    return dependencia


require_empresa = require_role(ROL_EMPRESA)
