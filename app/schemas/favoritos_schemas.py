from pydantic import BaseModel

class FavoritoSchema(BaseModel):
    usuario_id: str
    estacion_id: str