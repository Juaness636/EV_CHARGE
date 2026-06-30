from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db

from controllers.favoritos_controller import *
from schemas.favoritos_schemas import FavoritoSchema

router = APIRouter(prefix="/favoritos", tags=["Favoritos"])

@router.get("")
def get_all(db: Session = Depends(get_db)):
    return get_favoritos(db)

@router.get("/{id}")
def get_one(id: str, db: Session = Depends(get_db)):
    return get_favorito(id, db)

@router.post("")
def create(data: FavoritoSchema, db: Session = Depends(get_db)):
    return create_favorito(data, db)

@router.delete("/{id}")
def delete(id: str, db: Session = Depends(get_db)):
    return delete_favorito(id, db)