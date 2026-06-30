from models.models import Reservas

def get_reservas(db):
    return db.query(Reservas).all()

def get_reserva(id, db):
    return db.query(Reservas).filter(Reservas.id == id).first()

def create_reserva(data, db):
    try:
        new = Reservas(**data.model_dump())
        db.add(new)
        db.commit()
        db.refresh(new)
        return new
    except Exception as e:
        return {"error": str(e)}

def update_reserva(id, data, db):
    reserva = db.query(Reservas).filter(Reservas.id == id).first()
    if not reserva:
        return {"error": "No encontrado"}

    for key, value in data.model_dump().items():
        setattr(reserva, key, value)

    db.commit()
    db.refresh(reserva)
    return reserva

def delete_reserva(id, db):
    reserva = db.query(Reservas).filter(Reservas.id == id).first()
    if not reserva:
        return {"error": "No encontrado"}

    db.delete(reserva)
    db.commit()
    return {"message": "Eliminado"}