from models.models import MetodosPago

def get_metodos(db):
    return db.query(MetodosPago).all()

def get_metodo(id, db):
    return db.query(MetodosPago).filter(MetodosPago.id == id).first()

def create_metodo(data, db):
    new = MetodosPago(**data.dict())
    db.add(new)
    db.commit()
    return new

def update_metodo(id, data, db):
    item = db.query(MetodosPago).filter(MetodosPago.id == id).first()
    for key, value in data.dict().items():
        setattr(item, key, value)
    db.commit()
    return item

def delete_metodo(id, db):
    item = db.query(MetodosPago).filter(MetodosPago.id == id).first()
    db.delete(item)
    db.commit()