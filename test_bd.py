# test_bd.py
from app.config.database import SessionLocal, engine
from sqlalchemy import text

def probar_conexion():
    try:
        # Probamos una sesión real abriendo la conexión
        db = SessionLocal()
        resultado = db.execute(text("SELECT current_database(), current_user;"))
        db_nombre, usuario = resultado.fetchone()
        
        print("\n--------------------------------------------------")
        print("✅ ¡CONEXIÓN EXITOSA A POSTGRESQL!")
        print(f"📌 Base de Datos conectada: {db_nombre}")
        print(f"👤 Usuario conectado: {usuario}")
        print("--------------------------------------------------\n")
        
        db.close()
    except Exception as e:
        print("\n--------------------------------------------------")
        print("❌ ERROR DE CONEXIÓN A LA BASE DE DATOS:")
        print(e)
        print("--------------------------------------------------\n")

if __name__ == "__main__":
    probar_conexion()