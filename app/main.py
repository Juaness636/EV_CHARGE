# main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.database import Base, engine
from middleware.error_handler import ErrorHandler

# Cambiamos el import viejo por el nuevo paquete de modelos separado
import models 

# ==========================================
# IMPORTACIÓN DE ROUTERS
# ==========================================
from routes.user_routes import router as user_router
from routes.vehiculos_routes import router as vehicle_router
from routes.empresa_routes import router as company_router
from routes.estaciones_propias_routes import router as own_station_router
from routes.auth_routes import router as auth_router

from routes.metodos_pago_routes import router as metodo_pago_router
from routes.reservas_routes import router as reservas_router
from routes.reportes_routes import router as reportes_router
from routes.favoritos_routes import router as favoritos_router
from routes.cargas_routes import router as cargas_router
from routes.calificaciones_routes import router as calificaciones_router

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
# CONFIGURACIÓN CORS
# ==========================================
# Leemos los orígenes desde el .env y los separamos por comas
cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
    origins = [origin.strip() for origin in cors_origins_env.split(",")]
else:
    # Lista de respaldo por si acaso no encuentra la variable en el entorno
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         # Aplica la lista de dominios autorizados de forma segura
    allow_credentials=True,
    allow_methods=["*"],           # Permite todos los métodos HTTP (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],           # Permite todos los headers
)

app.add_middleware(ErrorHandler)

# ==========================================
# REGISTRO DE RUTAS
# ==========================================
app.include_router(user_router)
app.include_router(vehicle_router)
app.include_router(company_router)
app.include_router(own_station_router)
app.include_router(auth_router)
app.include_router(metodo_pago_router)
app.include_router(reservas_router)
app.include_router(reportes_router)
app.include_router(favoritos_router)
app.include_router(cargas_router)
app.include_router(calificaciones_router)

# ==========================================
# RUTA RAÍZ
# ==========================================
@app.get("/")
def home():
    return {
        "success": True,
        "message": "API de Monitoreo de Carga funcionando correctamente ⚡"
    }