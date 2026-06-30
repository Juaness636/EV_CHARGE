from pydantic import BaseModel

class MetodoPagoSchema(BaseModel):
    usuario_id: str
    tipo: str
    numero: str