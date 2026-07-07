from models import reporte

def get_reportes(db):
    return db.query(reporte).all()

def get_reporte(id, db):
    return db.query(reporte).filter(reporte.id == id).first()

def create_reporte(data, db):
    try:
        new = reporte(**data.model_dump())  # 🔥 cambio aquí
        db.add(new)
        db.commit()
        db.refresh(new)
        return new
    except Exception as e:
        return {"error": str(e)}

def update_reporte(id, data, db):
    try:
        item = db.query(reporte).filter(reporte.id == id).first()

        if not item:
            return {"error": "No encontrado"}

        for key, value in data.model_dump().items():  # 🔥 cambio aquí
            setattr(item, key, value)

        db.commit()
        db.refresh(item)
        return item

    except Exception as e:
        return {"error": str(e)}

def delete_reporte(id, db):
    try:
        item = db.query(reporte).filter(reporte.id == id).first()

        if not item:
            return {"error": "No encontrado"}

        db.delete(item)
        db.commit()
        return {"message": "Eliminado"}

    except Exception as e:
        return {"error": str(e)}