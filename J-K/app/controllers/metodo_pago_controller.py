# Backend/controllers/metodo_pago_controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.metodo_pago_model import MetodosPago
from app.schemas.metodos_pago_schema import MetodoPagoCreate, MetodoPagoUpdate
from app.controllers.notificaciones_controller import crear_notificacion

TIPOS_METODO = {"Tarjeta crédito", "Tarjeta débito", "Nequi", "Daviplata", "PSE"}


def _numero_seguro(tipo: str, numero: str) -> str:
    tipo = tipo.strip()
    if tipo not in TIPOS_METODO:
        raise HTTPException(status_code=400, detail="Selecciona un método de pago válido.")
    digitos = "".join(char for char in (numero or "") if char.isdigit())
    if "*" in (numero or "") and len(digitos) == 4:
        return f"**** {digitos[-4:]}"
    if tipo.startswith("Tarjeta"):
        if not 13 <= len(digitos) <= 19:
            raise HTTPException(status_code=400, detail="El número de tarjeta no es válido.")
    elif tipo in {"Nequi", "Daviplata"}:
        if len(digitos) != 10:
            raise HTTPException(status_code=400, detail="El número de celular debe tener 10 dígitos.")
    elif len(digitos) < 6:
        raise HTTPException(status_code=400, detail="El documento de PSE no es válido.")
    return f"**** {digitos[-4:]}"


def listar_pagos(db: Session, usuario_id: str):
    return db.query(MetodosPago).filter(MetodosPago.usuario_id == usuario_id).all()


def obtener_pago(db: Session, usuario_id: str, pid: str):
    pago = db.query(MetodosPago).filter(
        MetodosPago.id == pid, MetodosPago.usuario_id == usuario_id
    ).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Método de pago no encontrado.")
    return pago


def crear_pago(db: Session, usuario_id: str, data: MetodoPagoCreate):
    numero_seguro = _numero_seguro(data.tipo, data.numero)
    existente = db.query(MetodosPago).filter(
        MetodosPago.usuario_id == usuario_id, MetodosPago.numero == numero_seguro
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya tienes registrado ese método de pago.")

    nuevo = MetodosPago(usuario_id=usuario_id, tipo=data.tipo.strip(), numero=numero_seguro, estado=data.estado)
    db.add(nuevo)
    crear_notificacion(db, usuario_id, "Método de pago agregado", f"Agregaste un método de pago terminado en {data.numero[-4:]}.", "pago")
    db.commit()
    db.refresh(nuevo)
    return nuevo


def actualizar_pago(db: Session, usuario_id: str, pid: str, data: MetodoPagoUpdate):
    pago = obtener_pago(db, usuario_id, pid)
    cambios = data.model_dump(exclude_unset=True)
    if "tipo" in cambios:
        pago.tipo = cambios["tipo"].strip()
    if "numero" in cambios:
        pago.numero = _numero_seguro(pago.tipo, cambios["numero"])
    if "estado" in cambios:
        pago.estado = cambios["estado"]
    crear_notificacion(db, usuario_id, "Método de pago actualizado", f"Actualizaste tu método de pago terminado en {pago.numero[-4:]}.", "pago")
    db.commit()
    db.refresh(pago)
    return pago


def eliminar_pago(db: Session, usuario_id: str, pid: str):
    pago = obtener_pago(db, usuario_id, pid)
    db.delete(pago)
    crear_notificacion(db, usuario_id, "Método de pago eliminado", f"Eliminaste tu método de pago terminado en {pago.numero[-4:]}.", "pago")
    db.commit()
    return {"ok": True}
