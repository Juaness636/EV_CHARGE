from app.models import reservas

def get_reservas(db):
    return db.query(reservas).all()

def get_reserva(id, db):
    return db.query(reservas).filter(reservas.id == id).first()

def create_reserva(data, db):
    try:
        new = reservas(**data.model_dump())
        db.add(new)
        db.commit()
        db.refresh(new)
        return new
    except Exception as e:
        return {"error": str(e)}

def update_reserva(id, data, db):
    reserva = db.query(reservas).filter(reservas.id == id).first()
    if not reserva:
        return {"error": "No encontrado"}

    for key, value in data.model_dump().items():
        setattr(reserva, key, value)

    db.commit()
    db.refresh(reserva)
    return reserva

def delete_reserva(id, db):
    reserva = db.query(reservas).filter(reservas.id == id).first()
    if not reserva:
        return {"error": "No encontrado"}

    db.delete(reserva)
    db.commit()
    return {"message": "Eliminado"}