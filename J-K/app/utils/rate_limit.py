"""Límite de intentos en memoria para endpoints sensibles (login, PIN, asistente).

Es una ventana deslizante por clave (por ejemplo "login:ip:1.2.3.4"). Vive en la
memoria del proceso: con varios workers cada uno lleva su propia cuenta, lo que
sigue frenando la fuerza bruta. Si el backend se escala, conviene cambiarlo por
un limitador compartido (Redis).
"""

import threading
from collections import deque
from time import monotonic

from fastapi import HTTPException, Request

# Tope de claves guardadas para que un atacante no llene la memoria con IPs falsas.
_MAX_CLAVES = 50_000


class LimiteIntentos:
    def __init__(self, maximo: int, ventana_segundos: int):
        self.maximo = maximo
        self.ventana = ventana_segundos
        self._eventos: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _vigentes(self, clave: str, ahora: float) -> deque[float]:
        eventos = self._eventos.get(clave)
        if eventos is None:
            return deque()
        while eventos and ahora - eventos[0] > self.ventana:
            eventos.popleft()
        if not eventos:
            self._eventos.pop(clave, None)
        return eventos

    def bloqueado(self, clave: str) -> bool:
        with self._lock:
            return len(self._vigentes(clave, monotonic())) >= self.maximo

    def registrar(self, clave: str) -> None:
        with self._lock:
            ahora = monotonic()
            eventos = self._vigentes(clave, ahora)
            if clave not in self._eventos:
                if len(self._eventos) >= _MAX_CLAVES:
                    self._purgar(ahora)
                self._eventos[clave] = eventos
            eventos.append(ahora)

    def consumir(self, clave: str) -> bool:
        """Registra un intento y dice si todavía estaba dentro del límite."""
        with self._lock:
            ahora = monotonic()
            eventos = self._vigentes(clave, ahora)
            if len(eventos) >= self.maximo:
                return False
            if clave not in self._eventos:
                if len(self._eventos) >= _MAX_CLAVES:
                    self._purgar(ahora)
                self._eventos[clave] = eventos
            eventos.append(ahora)
            return True

    def limpiar(self, clave: str) -> None:
        with self._lock:
            self._eventos.pop(clave, None)

    def _purgar(self, ahora: float) -> None:
        for clave in list(self._eventos):
            self._vigentes(clave, ahora)
        # Si siguen sin caber, se descartan las más antiguas.
        while len(self._eventos) >= _MAX_CLAVES:
            self._eventos.pop(next(iter(self._eventos)))


def ip_cliente(request: Request) -> str:
    return request.client.host if request.client else "desconocida"


def error_demasiados_intentos(mensaje: str) -> HTTPException:
    return HTTPException(status_code=429, detail=mensaje)
