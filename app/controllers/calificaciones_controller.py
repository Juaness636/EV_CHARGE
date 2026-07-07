from models import calificacion

def get_calificaciones(db):
    return db.query(calificacion).all()

def create_calificacion(data, db):
    try:
        new = calificacion(**data.model_dump())  # 🔥 cambio clave
        db.add(new)
        db.commit()
        db.refresh(new)
        return new
    except Exception as e:
        return {"error": str(e)}