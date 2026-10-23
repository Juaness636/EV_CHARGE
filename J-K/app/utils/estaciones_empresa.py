# Backend/utils/estaciones_empresa.py
"""Asignación de estaciones de OpenChargeMap a empresas por palabras clave.

Las estaciones del mapa vienen de una API externa y no traen un dueño en Avanze. El admin
le pone a cada empresa palabras como "enel x" o "terpel"; toda estación cuyo nombre u
operador contenga una de ellas pasa a esa empresa (se pinta con su color, aparece en su
panel y la empresa puede cambiarle el estado).
"""

import re
import unicodedata

LONGITUD_MINIMA_PALABRA = 3


def normalizar(texto: str | None) -> str:
    """Minúsculas, sin tildes y con un solo espacio: "Enel X" y "ENEL  x" son lo mismo."""
    sin_tildes = unicodedata.normalize("NFD", texto or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", sin_tildes).strip().lower()


def lista_palabras(valor: str | None) -> list[str]:
    """Convierte "Enel X, enelx ,  " en ["enel x", "enelx"] sin repetidas."""
    vistas: list[str] = []
    for parte in (valor or "").split(","):
        palabra = normalizar(parte)
        if palabra and palabra not in vistas:
            vistas.append(palabra)
    return vistas


def empresa_por_texto(texto: str, empresas_con_palabras: list[tuple[object, list[str]]]):
    """Primera empresa con una palabra contenida en el texto, o None."""
    contenido = normalizar(texto)
    if not contenido:
        return None
    for empresa, palabras in empresas_con_palabras:
        if any(palabra in contenido for palabra in palabras):
            return empresa
    return None
