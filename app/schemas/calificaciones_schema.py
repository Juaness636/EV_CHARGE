from pydantic import BaseModel

class CalificacionSchema(BaseModel):
    usuario_id: str
    estacion_id: str
    puntuacion: int
    comentario: str