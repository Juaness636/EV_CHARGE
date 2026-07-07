from models import metodo_pago

def get_metodos(db):
    return db.query(metodo_pago).all()

def get_metodo(id, db):
    return db.query(metodo_pago).filter(metodo_pago.id == id).first()

def create_metodo(data, db):
    new = metodo_pago(**data.dict())
    db.add(new)
    db.commit()
    return new

def update_metodo(id, data, db):
    item = db.query(metodo_pago).filter(metodo_pago.id == id).first()
    for key, value in data.dict().items():
        setattr(item, key, value)
    db.commit()
    return item

def delete_metodo(id, db):
    item = db.query(metodo_pago).filter(metodo_pago.id == id).first()
    db.delete(item)
    db.commit()