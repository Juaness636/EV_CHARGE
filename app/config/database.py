# EV_CHARGE/config/database.py

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# ==========================================
# CARGAR VARIABLES .env
# ==========================================
load_dotenv()

# ==========================================
# VARIABLES DE ENTORNO (SIN DEFAULTS PELIGROSOS)
# ==========================================
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

# Validación básica
if not all([DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME]):
    raise ValueError("❌ Faltan variables de entorno en el .env")

# ==========================================
# URL CONEXIÓN
# ==========================================
SQLALCHEMY_DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# ==========================================
# ENGINE
# ==========================================
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# ==========================================
# SESIONES
# ==========================================
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# ==========================================
# BASE ORM
# ==========================================
Base = declarative_base()

# ==========================================
# DEPENDENCIA DB
# ==========================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()