# Backend/routes/empresa_routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db

from controllers.empresa_controller import (
    get_companies,
    get_company,
    create_company,
    update_company,
    delete_company
)
from schemas.empresa_schema import EmpresaSchema

router = APIRouter(
    prefix="/companies",
    tags=["Empresas"]
)

@router.get("")
def companies(db: Session = Depends(get_db)):
    return get_companies(db)

@router.get("/{id}")
def company(id: str, db: Session = Depends(get_db)):
    return get_company(id, db)

@router.post("")
def store_company(company: EmpresaSchema, db: Session = Depends(get_db)):
    return create_company(company, db)

@router.put("/{id}")
def edit_company(id: str, company: EmpresaSchema, db: Session = Depends(get_db)):
    return update_company(id, company, db)

@router.delete("/{id}")
def destroy_company(id: str, db: Session = Depends(get_db)):
    return delete_company(id, db)