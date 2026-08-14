# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configuración e intermedios con prefijo app.
from app.config.database import Base, engine
from app.middleware.error_handler import ErrorHandler
import app.models

# ==========================================
# IMPORTACIÓN DE ROUTERS
# ==========================================
from app.routes.auth_routes import router as auth_router
from app.routes.vehiculos_routes import router as vehicle_router
from app.routes.admin_routes import router as admin_router
from app.routes import mapa_routes

from app.routes.metodos_pago_routes import router as metodo_pago_router
from app.routes.reservas_routes import router as reservas_router
from app.routes.reportes_routes import router as reportes_router
from app.routes.favoritos_routes import router as favoritos_router
from app.routes.cargas_routes import router as cargas_router
from app.routes.calificaciones_routes import router as calificaciones_router
from app.routes.estado_routes import router as estado_router


# ==========================================
# CREACIÓN AUTOMÁTICA DE TABLAS
# ==========================================
Base.metadata.create_all(bind=engine)


# ==========================================
# INSTANCIA FASTAPI
# ==========================================
app = FastAPI(
    title="API Estaciones de Carga - ADSO SENA",
    version="1.0.0"
)


# ==========================================
# CONFIGURACIÓN CORS Y MIDDLEWARE
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(ErrorHandler)


# ==========================================
# REGISTRO DE RUTAS
# ==========================================
app.include_router(mapa_routes.router)
app.include_router(auth_router)
app.include_router(vehicle_router)
app.include_router(admin_router)

app.include_router(metodo_pago_router)
app.include_router(reservas_router)
app.include_router(reportes_router)
app.include_router(favoritos_router)
app.include_router(cargas_router)
app.include_router(calificaciones_router)
app.include_router(estado_router)


# ==========================================
# RUTA RAÍZ
# ==========================================
@app.get("/")
def home():
    return {
        "success": True,
        "message": "API de Monitoreo de Carga funcionando correctamente ⚡"
    }