# Backend/controllers/empresa_estaciones_api_controller.py
"""Estaciones de OpenChargeMap que pertenecen a la empresa por sus palabras clave.

La empresa no las crea ni las borra (vienen de la API): solo las ve en su panel y les
cambia el estado. La pertenencia se recalcula en cada consulta con las palabras que puso
el admin, así una empresa nunca puede tocar una estación que no le corresponde.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.controllers.admin_controller import cambiar_estado_estacion_ocm, listar_estaciones_ocm_admin
from app.schemas.admin_schema import EstadoUpdate


def listar_estaciones_api_empresa(ctx: dict, db: Session) -> list[dict]:
    if not ctx["empresa"].palabras_clave:
        return []
    return [
        {
            "id": estacion["id"],
            "nombre": estacion["nombre"],
            "direccion": estacion["direccion"],
            "operador": estacion["operador"],
            "ciudad": estacion.get("ciudad") or "",
            "departamento": estacion.get("departamento") or "",
            "lat": estacion["lat"],
            "lon": estacion["lon"],
            "estado": estacion["estado"],
            "conectores": len(estacion.get("conectores") or []),
        }
        for estacion in listar_estaciones_ocm_admin(db)
        if estacion.get("origen") == "OpenChargeMap"
        and (estacion.get("empresa") or {}).get("id") == ctx["empresa_id"]
    ]


def cambiar_estado_estacion_api_empresa(estacion_id: str, data: EstadoUpdate, ctx: dict, db: Session) -> dict:
    propias = {estacion["id"] for estacion in listar_estaciones_api_empresa(ctx, db)}
    if estacion_id not in propias:
        # 404 y no 403: no se revela si la estación existe para otra empresa.
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    return cambiar_estado_estacion_ocm(estacion_id, data, db)
