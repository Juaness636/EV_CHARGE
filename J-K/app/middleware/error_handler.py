import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class ErrorHandler(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response

        except Exception:
            # El detalle (SQL, rutas, nombres de tablas) queda en el log del servidor,
            # nunca en la respuesta al cliente.
            logger.exception("Error no controlado en %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "Error interno del servidor",
                    "detail": "Ocurrió un error inesperado. Intenta nuevamente.",
                }
            )
