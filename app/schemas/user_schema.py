# Backend/schemas/user_schema.py
from pydantic import BaseModel, EmailStr
from typing import Optional

class UserSchema(BaseModel):
    nombre: str
    email: EmailStr  # Cambiado de correo -> email según el nuevo script SQL
    password: str    # Se recibe para transformarse en password_hash
    is_admin: Optional[bool] = False

    class Config:
        from_attributes = True