from pydantic import BaseModel, EmailStr, model_validator
from typing import Optional, Any, Union, List
from uuid import UUID

# ESQUEMA DE ENTRADA (POST / PUT)
class UserSchema(BaseModel):
    nombre: str
    email: EmailStr  
    password: str    
    is_admin: Optional[bool] = False

    class Config:
        from_attributes = True

# ESQUEMA DE DATOS SEGUROS (Oculta password_hash)
class UserDataResponse(BaseModel):
    id: Optional[UUID] = None
    nombre: str
    email: EmailStr
    is_admin: bool

    class Config:
        from_attributes = True

# ESQUEMA DE RESPUESTA PERSONALIZADA FLEXIBLE
class UserResponse(BaseModel):
    status: Optional[str] = "success"
    mensaje: Optional[str] = None
    message: Optional[str] = None  
    usuario: Optional[Union[UserDataResponse, List[UserDataResponse]]] = None
    data: Optional[Any] = None 

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def normalizar_datos_crudos(cls, data: Any) -> Any:
        # Si el controlador te devuelve un objeto de base de datos directo (como en el GET por ID)
        if hasattr(data, 'id') and not isinstance(data, dict):
            return {
                "mensaje": "Usuario obtenido correctamente",
                "usuario": data
            }
        return data