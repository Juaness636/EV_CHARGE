from models.models import Cargas

def get_cargas(db):
    return db.query(Cargas).all()

def create_carga(data, db):
    try:
        new = Cargas(**data.model_dump())  # 🔥 cambio clave
        db.add(new)
        db.commit()
        db.refresh(new)
        return new
    except Exception as e:
        return {"error": str(e)}