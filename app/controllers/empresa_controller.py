# Backend/controllers/empresa_controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException
from models import  estacion_propia # Asegúrate de que se llame así en models.py
from schemas.empresa_schema import EmpresaSchema
import uuid

def get_companies(db: Session):
    # Trae todas las estaciones propias registradas
    return db.query(estacion_propia).all()

def get_company(id: str, db: Session):
    # Validación de formato UUID para evitar errores de sintaxis en Postgres
    try:
        uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="El formato del ID (UUID) no es válido.")

    empresa = db.query(estacion_propia).filter(estacion_propia.id == id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Estación/Empresa no encontrada.")
    return empresa

def create_company(company: EmpresaSchema, db: Session):
    nueva_empresa = estacion_propia(
        nombre=company.nombre,
        direccion=company.direccion,
        lat=company.lat,
        lon=company.lon,
        tipo_conector=company.tipo_conector,
        potencia_kw=company.potencia_kw,
        descripcion=company.descripcion,
        activa=company.activa
    )
    db.add(nueva_empresa)
    db.commit()
    db.refresh(nueva_empresa)
    return {"mensaje": "Estación/Empresa registrada con éxito ✅", "empresa": nueva_empresa}

def update_company(id: str, company: EmpresaSchema, db: Session):
    empresa = get_company(id, db)  # Reutiliza la lógica de búsqueda y validación de UUID
    
    empresa.nombre = company.nombre
    empresa.direccion = company.direccion
    empresa.lat = company.lat
    empresa.lon = company.lon
    empresa.tipo_conector = company.tipo_conector
    empresa.potencia_kw = company.potencia_kw
    empresa.descripcion = company.descripcion
    empresa.activa = company.activa
    
    db.commit()
    db.refresh(empresa)
    return {"mensaje": "Estación/Empresa actualizada correctamente ✅", "empresa": empresa}

def delete_company(id: str, db: Session):
    empresa = get_company(id, db)
    
    db.delete(empresa)
    db.commit()
    return {"mensaje": f"Estación con ID {id} eliminada permanentemente ❌"}