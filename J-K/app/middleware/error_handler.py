import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Todas las respuestas de error tienen la misma forma:
#   {"success": false, "codigo": "...", "mensaje": "...", "detail": ...}
# `detail` se conserva porque la app móvil y la web ya lo leen.

CODIGOS = {
    400: "validacion",
    401: "no_autenticado",
    403: "sin_permisos",
    404: "no_encontrado",
    405: "metodo_no_permitido",
    409: "conflicto",
    413: "archivo_muy_grande",
    422: "validacion",
    429: "demasiados_intentos",
}

# Textos por defecto de Starlette (en inglés) traducidos para el usuario.
MENSAJES_POR_DEFECTO = {
    400: "La solicitud no es válida.",
    401: "Tu sesión venció. Inicia sesión de nuevo.",
    403: "No tienes permiso para realizar esta acción.",
    404: "No encontramos lo que buscas.",
    405: "Esta acción no está permitida.",
    409: "La operación entra en conflicto con información existente.",
    413: "El archivo es demasiado grande.",
    422: "Revisa los datos enviados.",
    429: "Hiciste demasiados intentos. Espera un momento e inténtalo de nuevo.",
}

MENSAJE_INESPERADO = "Ocurrió un error inesperado. Intenta nuevamente."


def respuesta_error(status_code: int, mensaje: str, detail=None, headers=None) -> JSONResponse:
    codigo = CODIGOS.get(status_code, "error_servidor" if status_code >= 500 else "error")
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "codigo": codigo,
            "mensaje": mensaje,
            "detail": mensaje if detail is None else detail,
        },
        headers=headers,
    )


async def manejar_http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detalle = exc.detail
    por_defecto = MENSAJES_POR_DEFECTO.get(exc.status_code, MENSAJE_INESPERADO)
    # "Not Found", "Method Not Allowed"... son los textos genéricos de Starlette.
    if not isinstance(detalle, str) or not detalle.strip() or detalle in {
        "Not Found", "Method Not Allowed", "Unauthorized", "Forbidden", "Not authenticated",
        "Internal Server Error", "Bad Request", "Too Many Requests",
    }:
        mensaje = por_defecto
    else:
        mensaje = detalle
    if exc.status_code >= 500:
        logger.error("HTTP %s en %s %s: %s", exc.status_code, request.method, request.url.path, detalle)
    return respuesta_error(
        exc.status_code,
        mensaje,
        detail=detalle if isinstance(detalle, (dict, list)) else None,
        headers=getattr(exc, "headers", None),
    )


async def manejar_validacion(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Se quitan `input` y `ctx`: podrían devolver al cliente lo que escribió (por ejemplo una contraseña).
    errores = [
        {"loc": list(error.get("loc", [])), "msg": error.get("msg", ""), "type": error.get("type", "")}
        for error in exc.errors()
    ]
    propio = next((e["msg"] for e in errores if e["msg"].lower().startswith("value error, ")), None)
    mensaje = propio[len("Value error, "):] if propio else MENSAJES_POR_DEFECTO[422]
    return respuesta_error(422, mensaje, detail=errores)


def registrar_manejadores(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, manejar_http)
    app.add_exception_handler(RequestValidationError, manejar_validacion)


class ErrorHandler(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response

        except Exception:
            # El detalle (SQL, rutas, nombres de tablas) queda en el log del servidor,
            # nunca en la respuesta al cliente.
            logger.exception("Error no controlado en %s %s", request.method, request.url.path)
            return respuesta_error(500, MENSAJE_INESPERADO)
