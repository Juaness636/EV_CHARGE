from pydantic import BaseModel

class ReporteSchema(BaseModel):
    usuario_id: str
    descripcion: str
    fecha: str