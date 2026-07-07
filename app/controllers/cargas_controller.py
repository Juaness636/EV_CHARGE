from models import carga

def get_cargas(db):
    return db.query(carga).all()

def create_carga(data, db):
    try:
        new = carga(**data.model_dump())  # 🔥 cambio clave
        db.add(new)
        db.commit()
        db.refresh(new)
        return new
    except Exception as e:
        return {"error": str(e)}