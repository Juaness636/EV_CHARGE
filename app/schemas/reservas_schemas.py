from pydantic import BaseModel

class ReservaSchema(BaseModel):
    usuario_id: str
    espacio_id: str
    fecha: str