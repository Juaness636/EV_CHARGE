# Backend/controllers/auth_controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException
from models import usuarios as User  # Asegúrate de que apunte bien a tu modelo
from utils.security import hash_password, verify_password
from utils.jwt import create_access_token

def register_user(db: Session, nombre: str, email: str, password: str):
    user_exist = db.query(User).filter(User.email == email).first()

    if user_exist:
        raise HTTPException(status_code=400, detail="El correo ya está registrado.")
    
    new_user = User(
        nombre=nombre,
        email=email,
        password_hash=hash_password(password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"msg": "Usuario creado correctamente"}

def login_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Guardamos el ID y el email dentro del pase (Token)
    token = create_access_token({
        "sub": str(user.id),
        "email": user.email
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }