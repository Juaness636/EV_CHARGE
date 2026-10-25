# Backend/routes/qr_routes.py
"""QR de los cargadores: el admin y cada empresa los generan y los imprimen.

La empresa solo puede generar los QR de sus estaciones (propias o asignadas por palabras
clave); para las demás responde 404, igual que el resto del namespace /empresa.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.empresa_controller import get_current_user_empresa
from app.controllers.empresa_estaciones_api_controller import listar_estaciones_api_empresa
from app.models.estacion_propia_model import EstacionPropia
from app.services.qr_service import hoja_imprimible, qr_de_estacion, validar_ticket_hoja
from app.utils.jwt import require_admin

router = APIRouter(tags=["QR de cargadores"])


@router.get("/admin/estaciones/{estacion_id}/qr")
def qr_admin(estacion_id: str, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return qr_de_estacion(db, estacion_id)


@router.get("/empresa/estaciones/{estacion_id}/qr")
def qr_empresa(estacion_id: str, ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    propia = (
        db.query(EstacionPropia.id)
        .filter(
            EstacionPropia.id == estacion_id,
            EstacionPropia.empresa_id == ctx["empresa_id"],
            EstacionPropia.eliminada.is_(False),
        )
        .first()
    )
    if not propia and estacion_id not in {e["id"] for e in listar_estaciones_api_empresa(ctx, db)}:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    return qr_de_estacion(db, estacion_id)


@router.get("/qr/hoja/{estacion_id}", response_class=HTMLResponse)
def qr_hoja(estacion_id: str, ticket: str, db: Session = Depends(get_db)):
    """Hoja imprimible. Se abre en el navegador con un ticket corto en vez de la sesión."""
    validar_ticket_hoja(ticket, estacion_id)
    return HTMLResponse(hoja_imprimible(db, estacion_id))
