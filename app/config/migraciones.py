# Backend/config/migraciones.py
"""Migraciones manuales del proyecto.

Aquí vive el `ALTER TABLE ... IF NOT EXISTS` que acompaña a `Base.metadata.create_all()`:
las tablas nuevas las crea `create_all`, pero las columnas nuevas de tablas que ya existen
necesitan un ALTER explícito (el proyecto no usa Alembic).
"""

from sqlalchemy import text

from app.config.database import engine

# Cada migración es (nombre, sentencias). Se ejecutan en orden y son idempotentes.
MIGRACIONES = [
    (
        "estaciones y estados",
        [
            "ALTER TABLE estaciones_propias ADD COLUMN IF NOT EXISTS estado VARCHAR DEFAULT 'activa'",
            "UPDATE estaciones_propias SET estado = CASE WHEN activa = TRUE THEN 'activa' ELSE 'inactiva' END WHERE estado IS NULL",
            "ALTER TABLE estados_estaciones ADD COLUMN IF NOT EXISTS nombre VARCHAR",
            "ALTER TABLE estados_estaciones ADD COLUMN IF NOT EXISTS direccion VARCHAR",
            "ALTER TABLE estados_estaciones ADD COLUMN IF NOT EXISTS operador VARCHAR",
            "ALTER TABLE estaciones_propias ADD COLUMN IF NOT EXISTS operador VARCHAR DEFAULT 'EV Charge'",
            "ALTER TABLE estados_estaciones ADD COLUMN IF NOT EXISTS lat FLOAT",
            "ALTER TABLE estados_estaciones ADD COLUMN IF NOT EXISTS lon FLOAT",
            "ALTER TABLE estados_estaciones ADD COLUMN IF NOT EXISTS eliminada BOOLEAN NOT NULL DEFAULT FALSE",
        ],
    ),
    (
        "usuarios.rol",
        [
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR NOT NULL DEFAULT 'usuario'",
            # Backfill: quien tenía is_admin=True conserva el privilegio bajo el modelo de roles.
            "UPDATE usuarios SET rol = 'admin' WHERE is_admin = TRUE AND rol = 'usuario'",
        ],
    ),
    (
        "empresas en estaciones_propias",
        [
            "ALTER TABLE estaciones_propias ADD COLUMN IF NOT EXISTS empresa_id VARCHAR REFERENCES empresas(id) ON DELETE CASCADE",
            "ALTER TABLE estaciones_propias ADD COLUMN IF NOT EXISTS eliminada BOOLEAN NOT NULL DEFAULT FALSE",
            # Sin cargadores todavía, los campos legacy dejan de ser obligatorios.
            "ALTER TABLE estaciones_propias ALTER COLUMN tipo_conector DROP NOT NULL",
            "ALTER TABLE estaciones_propias ALTER COLUMN potencia_kw DROP NOT NULL",
            "CREATE INDEX IF NOT EXISTS ix_estaciones_propias_empresa_id ON estaciones_propias (empresa_id)",
        ],
    ),
    (
        "cargas con ciclo de vida",
        [
            "ALTER TABLE cargas ADD COLUMN IF NOT EXISTS cargador_id VARCHAR REFERENCES cargadores(id) ON DELETE SET NULL",
            "ALTER TABLE cargas ADD COLUMN IF NOT EXISTS reserva_id VARCHAR",
            "ALTER TABLE cargas ADD COLUMN IF NOT EXISTS duracion_min INTEGER",
            "ALTER TABLE cargas ADD COLUMN IF NOT EXISTS estado VARCHAR NOT NULL DEFAULT 'completada'",
            "ALTER TABLE cargas ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMP",
            "ALTER TABLE cargas ADD COLUMN IF NOT EXISTS fecha_fin TIMESTAMP",
            "ALTER TABLE cargas ALTER COLUMN kwh_cargados DROP NOT NULL",
            "ALTER TABLE cargas ALTER COLUMN costo_estimado DROP NOT NULL",
            "UPDATE cargas SET estado = 'completada', fecha_fin = fecha WHERE estado IS NULL OR estado = ''",
            "CREATE INDEX IF NOT EXISTS ix_cargas_estacion_fecha ON cargas (estacion_ocm_id, fecha)",
            "CREATE INDEX IF NOT EXISTS ix_cargas_estado_fecha_fin ON cargas (estado, fecha_fin)",
        ],
    ),
]


def aplicar_migraciones_manuales():
    with engine.begin() as connection:
        for nombre, sentencias in MIGRACIONES:
            for sentencia in sentencias:
                try:
                    connection.execute(text(sentencia))
                except Exception as error:  # noqa: BLE001 - una migración no debe tumbar el arranque
                    print(f"[migraciones] Falló '{nombre}': {sentencia.split()[0:6]} -> {error}")
                    raise
