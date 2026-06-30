from models.models import Calificaciones

def get_calificaciones(db):
    return db.query(Calificaciones).all()

def create_calificacion(data, db):
    try:
        new = Calificaciones(**data.model_dump())  # 🔥 cambio clave
        db.add(new)
        db.commit()
        db.refresh(new)
        return new
    except Exception as e:
        return {"error": str(e)}