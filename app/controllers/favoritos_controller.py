from models.models import Favoritos

def get_favoritos(db):
    return db.query(Favoritos).all()

def get_favorito(id, db):
    return db.query(Favoritos).filter(Favoritos.id == id).first()

def create_favorito(data, db):
    try:
        new = Favoritos(**data.model_dump())  # 🔥 cambio clave
        db.add(new)
        db.commit()
        db.refresh(new)
        return new
    except Exception as e:
        return {"error": str(e)}

def delete_favorito(id, db):
    try:
        item = db.query(Favoritos).filter(Favoritos.id == id).first()

        if not item:
            return {"error": "No encontrado"}

        db.delete(item)
        db.commit()
        return {"message": "Eliminado"}

    except Exception as e:
        return {"error": str(e)}