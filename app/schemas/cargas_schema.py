from pydantic import BaseModel

class CargaSchema(BaseModel):
    usuario_id: str
    estacion_id: str
    energia: str
    fecha: str