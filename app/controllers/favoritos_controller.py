from models import favorito

def get_favoritos(db):
    return db.query(favorito).all()

def get_favorito(id, db):
    return db.query(favorito).filter(favorito.id == id).first()

def create_favorito(data, db):
    try:
        new = favorito(**data.model_dump())  # 🔥 cambio clave
        db.add(new)
        db.commit()
        db.refresh(new)
        return new
    except Exception as e:
        return {"error": str(e)}

def delete_favorito(id, db):
    try:
        item = db.query(favorito).filter(favorito.id == id).first()

        if not item:
            return {"error": "No encontrado"}

        db.delete(item)
        db.commit()
        return {"message": "Eliminado"}

    except Exception as e:
        return {"error": str(e)}