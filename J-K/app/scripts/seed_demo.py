# Backend/scripts/seed_demo.py
"""Datos de demostración para que la app se vea con vida.

Llena la base con usuarios, vehículos, empresas (Terpel, Celsia y EPM), estaciones propias,
reservas con pago, cargas, reseñas, pedidos de la tienda con su chat, reportes, incidentes,
notificaciones y favoritos repartidos en las últimas semanas, para que el reporte semanal y
las estadísticas muestren tendencias.

Uso (desde la carpeta J-K, con el entorno virtual activo):

    python -m app.scripts.seed_demo            # crea los datos demo (o los recrea si ya estaban)
    python -m app.scripts.seed_demo --borrar   # quita solo los datos demo
    python -m app.scripts.seed_demo --actualizar-cuentas  # cambia correos y clave sin borrar nada

Cómo se reconocen los datos demo:
- Todo registro creado aquí tiene un id que empieza por "demo-" (el id no se muestra en la app).
- Los nombres y correos se ven reales (sin la palabra "demo") para presentar la app en la feria:
  las empresas usan un correo de su dominio (por ejemplo voltex@terpel.com para el panel de empresa)
  y los conductores correos de gmail, hotmail u outlook. Todos usan la contraseña Avanze2026*.

El script nunca modifica ni borra registros que no sean demo: correrlo dos veces deja la base
igual que correrlo una vez (borra lo demo anterior y lo vuelve a crear con fechas relativas a hoy).
Lo que un usuario real cree después sobre un dato demo (por ejemplo una respuesta del admin en el
chat de un pedido demo) se borra junto con ese dato demo.

Solo inserta en las columnas y tablas que existan en la base, así funciona aunque la rama
local tenga un esquema un poco más viejo o más nuevo.
"""

import argparse
import hashlib
import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import MetaData, inspect, text

from app.config.database import engine
from app.utils.security import hash_password

try:
    from app.utils.catalogo_productos import PRECIOS_PRODUCTOS
except ImportError:  # ramas donde el catálogo aún vive en constantes
    from app.utils.constantes import PRECIOS_PRODUCTOS

PREFIJO = "demo-"
CLAVE_DEMO = "Avanze2026*"
DOMINIOS_CONDUCTORES = ["gmail.com", "hotmail.com", "outlook.com", "gmail.com", "yahoo.com"]
SEMILLA = 2026
SEMANAS = 8

# Hijos primero: así el borrado no depende de los ON DELETE de cada llave foránea.
TABLAS_DEMO = [
    "mensajes_compra",
    "pagos_reserva",
    "historial_estaciones",
    "incidentes",
    "estacion_cargadores",
    "compras",
    "notificaciones",
    "favoritos",
    "calificaciones",
    "reportes",
    "cargas",
    "reservas",
    "metodos_pago",
    "vehiculos",
    "contactos",
    "estaciones_propias",
    "empresas",
    "usuarios",
]

NOMBRES = [
    "Santiago", "Valentina", "Sebastián", "Camila", "Mateo", "Mariana", "Nicolás", "Daniela",
    "Samuel", "Isabella", "Alejandro", "Laura", "Andrés", "Sofía", "Felipe", "Natalia",
    "Juan Pablo", "Paula", "David", "Manuela", "Carlos", "Juliana", "Diego", "Carolina",
    "Esteban", "Luisa", "Miguel", "Andrea", "Julián", "Catalina", "Tomás", "María José",
    "Simón", "Gabriela", "Óscar", "Ana María", "Ricardo", "Lorena", "Hernán", "Diana",
]
APELLIDOS = [
    "Gómez", "Rodríguez", "Martínez", "López", "García", "Hernández", "Ramírez", "Torres",
    "Restrepo", "Ospina", "Castaño", "Vargas", "Moreno", "Jaramillo", "Rojas", "Cárdenas",
    "Mejía", "Salazar", "Quintero", "Zapata", "Arango", "Valencia", "Henao", "Giraldo",
]
VEHICULOS = [
    ("BYD", "Dolphin", 2024, 405, "CCS"),
    ("BYD", "Yuan Plus", 2024, 480, "CCS"),
    ("BYD", "Seal", 2025, 570, "CCS"),
    ("Renault", "Zoe", 2022, 390, "Type 2"),
    ("Renault", "Kwid E-Tech", 2024, 298, "CCS"),
    ("Tesla", "Model 3", 2024, 513, "CCS"),
    ("Tesla", "Model Y", 2025, 533, "CCS"),
    ("Kia", "EV6", 2023, 528, "CCS"),
    ("Kia", "Niro EV", 2023, 463, "CCS"),
    ("Hyundai", "Kona Eléctrico", 2023, 454, "CCS"),
    ("MG", "ZS EV", 2024, 440, "CCS"),
    ("Chevrolet", "Bolt EUV", 2023, 397, "CCS"),
    ("Nissan", "Leaf", 2022, 270, "CHAdeMO"),
    ("JAC", "E-JS4", 2024, 402, "GB/T"),
    ("Volvo", "EX30", 2025, 476, "CCS"),
]

EMPRESAS = [
    {
        "clave": "terpel",
        "correo": "voltex@terpel.com",
        "nombre": "Terpel Voltex",
        "razon_social": "Organización Terpel S.A.",
        "nit": "900.555.101-1",
        "telefono": "601 555 0101",
        "direccion": "Cra. 7 #75-51, Bogotá",
        "descripcion": "Red de carga rápida Voltex en estaciones de servicio Terpel de todo el país.",
        "color": "#E2231A",
        "palabras": "terpel, voltex",
        "estaciones": [
            ("Terpel Voltex Autopista Sur", "Autopista Sur #66-78, Bogotá", 4.5925, -74.1610, "activa"),
            ("Terpel Voltex Calle 170", "Calle 170 #54-10, Bogotá", 4.7530, -74.0560, "activa"),
            ("Terpel Voltex Av. Roosevelt", "Av. Roosevelt #34-20, Cali", 3.4240, -76.5430, "mantenimiento"),
        ],
    },
    {
        "clave": "celsia",
        "correo": "movilidad@celsia.com",
        "nombre": "Celsia",
        "razon_social": "Celsia Colombia S.A. E.S.P.",
        "nit": "900.555.102-2",
        "telefono": "602 555 0102",
        "direccion": "Calle 15 #29B-30, Yumbo",
        "descripcion": "Electrolineras Celsia en centros comerciales y vías del Valle y el Tolima.",
        "color": "#F7941D",
        "palabras": "celsia",
        "estaciones": [
            ("Celsia Centro Comercial Jardín Plaza", "Cra. 98 #16-200, Cali", 3.3690, -76.5280, "activa"),
            ("Celsia Multicentro Ibagué", "Cra. 5 #60-123, Ibagué", 4.4440, -75.1990, "activa"),
        ],
    },
    {
        "clave": "epm",
        "correo": "ecoestaciones@epm.com.co",
        "nombre": "EPM",
        "razon_social": "Empresas Públicas de Medellín E.S.P.",
        "nit": "900.555.103-3",
        "telefono": "604 555 0103",
        "direccion": "Cra. 58 #42-125, Medellín",
        "descripcion": "Ecoestaciones de carga de EPM en el Valle de Aburrá y el Oriente antioqueño.",
        "color": "#00843D",
        "palabras": "epm, ecoestacion",
        "estaciones": [
            ("EPM Ecoestación El Poblado", "Calle 10 #43A-30, Medellín", 6.2100, -75.5700, "activa"),
            ("EPM Ecoestación Envigado", "Cra. 43A #38 Sur-35, Envigado", 6.1720, -75.5850, "activa"),
            ("EPM Ecoestación Aeropuerto JMC", "Vía Aeropuerto JMC, Rionegro", 6.1660, -75.4270, "activa"),
        ],
    },
]
CARGADORES_TIPO = [
    ("CCS", 150.0, "DC"),
    ("CCS", 60.0, "DC"),
    ("Type 2", 22.0, "AC"),
    ("CHAdeMO", 50.0, "DC"),
]

# Estaciones reales del mapa (OpenChargeMap, Colombia). Solo se usan sus ids como referencia.
ESTACIONES_MAPA = [
    ("302193", "EnelX Nicolas de Federman", "Bogotá"),
    ("302195", "EnelX Alhambra", "Bogotá"),
    ("302196", "EnelX Chico", "Bogotá"),
    ("470939", "EnelX Terminal Salitre", "Bogotá"),
    ("475122", "Terpel av Boyacá", "Bogotá"),
    ("302435", "Terpel Voltex - La Juana", "Bogotá"),
    ("311396", "Terpel Voltex Autopista Norte", "Medellín"),
    ("96408", "Celsia Universidad EAFIT", "Medellín"),
    ("485435", "Centro Comercial Los Molinos EPM", "Medellín"),
    ("212401", "Ecoestacion EPM McDonalds Vegas", "Envigado"),
]

RESENAS = {
    5: [
        "Carga rapidísima, en 30 minutos tenía el 80 %.",
        "Excelente ubicación y el personal muy amable.",
        "Todo funcionó perfecto, la reserva se respetó a la hora.",
        "Muy limpia y segura, volveré.",
        "Mientras cargaba tomé un café, súper cómodo.",
    ],
    4: [
        "Buena estación, aunque el parqueadero es algo estrecho.",
        "Cargó bien, solo tuve que esperar un poco a que se liberara.",
        "Precio justo y buena potencia.",
        "Me gustó, faltaría techo para los días de lluvia.",
    ],
    3: [
        "Funciona, pero uno de los cargadores estaba lento.",
        "La señalización para llegar no es clara.",
        "Cumple, aunque esperaba más potencia.",
    ],
    2: [
        "El conector CCS se desconectaba a cada rato.",
        "Tuve que esperar 40 minutos porque un carro de gasolina ocupaba el puesto.",
    ],
    1: ["El cargador estaba apagado y nadie supo darme razón."],
}
REPORTES = [
    ("averia", "El conector CCS no inicia la sesión de carga."),
    ("averia", "La pantalla del cargador está apagada."),
    ("fuera_servicio", "La estación aparece activa pero está cerrada por obras."),
    ("otro", "Un vehículo de combustión ocupa el puesto de carga."),
    ("averia", "La carga se corta a los pocos minutos."),
    ("otro", "No hay iluminación en la zona de carga por la noche."),
]
INCIDENTES = [
    ("falla", "Conector CCS dañado", "El pin de comunicación está doblado y no permite iniciar sesión.", "alta", True),
    ("falla", "Pantalla sin respuesta", "El módulo de la pantalla táctil se reinicia en bucle.", "media", False),
    ("reparacion", "Cambio de cable Tipo 2", "Se reemplaza el cable por desgaste en la funda.", "baja", False),
    ("actualizacion", "Actualización de firmware", "Actualización del firmware del cargador a la versión 4.2.", "baja", False),
]
DIRECCIONES = [
    ("Bogotá", "Calle 93 #11-27, apto 502"),
    ("Bogotá", "Cra. 15 #127-40, casa 3"),
    ("Medellín", "Calle 10 Sur #50-12"),
    ("Medellín", "Cra. 70 #44-15, Laureles"),
    ("Cali", "Av. 6N #28-14"),
    ("Barranquilla", "Calle 84 #51B-20"),
    ("Bucaramanga", "Cra. 27 #36-50"),
    ("Pereira", "Av. Circunvalar #8-30"),
]
CHAT_PEDIDO = [
    (False, "Hola, ¿para cuándo estaría llegando mi pedido?"),
    (True, "¡Hola! Ya lo confirmamos con la transportadora, sale mañana a primera hora."),
    (False, "Perfecto, muchas gracias."),
    (True, "Te dejamos la guía de envío en cuanto la tengamos."),
]


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def _id(tipo: str, n: int) -> str:
    return f"{PREFIJO}{tipo}-{n:04d}"


def correo_conductor(nombre: str, apellido: str, n: int, usados: set[str]) -> str:
    """Correo con aspecto real (nombre.apellido@gmail.com); agrega un número solo si ya está usado."""
    base = f"{nombre}.{apellido}".lower().replace(" ", "").translate(str.maketrans("áéíóúñ", "aeioun"))
    dominio = DOMINIOS_CONDUCTORES[n % len(DOMINIOS_CONDUCTORES)]
    correo = f"{base}@{dominio}"
    if correo in usados:
        correo = f"{base}{n + 1}@{dominio}"
    usados.add(correo)
    return correo


def transaccion(etiqueta: str) -> str:
    """Id de transacción con el mismo formato que genera la pasarela (TX-EV- + 10 caracteres)."""
    return "TX-EV-" + hashlib.md5(etiqueta.encode()).hexdigest()[:10].upper()


class Sembrador:
    def __init__(self, conn):
        self.conn = conn
        self.rng = random.Random(SEMILLA)
        self.meta = MetaData()
        nombres = set(inspect(conn).get_table_names())
        self.meta.reflect(bind=conn, only=[t for t in TABLAS_DEMO if t in nombres])
        self.contadores: dict[str, int] = {}
        self.filas: dict[str, list[dict]] = {t: [] for t in TABLAS_DEMO}
        self.hoy = ahora()
        self.inicio = self.hoy - timedelta(weeks=SEMANAS)

    def nuevo_id(self, tipo: str) -> str:
        self.contadores[tipo] = self.contadores.get(tipo, 0) + 1
        return _id(tipo, self.contadores[tipo])

    def agregar(self, tabla: str, fila: dict) -> dict:
        self.filas[tabla].append(fila)
        return fila

    def guardar(self) -> dict[str, int]:
        resumen = {}
        for tabla in reversed(TABLAS_DEMO):  # padres primero
            filas = self.filas[tabla]
            if not filas or tabla not in self.meta.tables:
                continue
            t = self.meta.tables[tabla]
            columnas = set(t.columns.keys())
            self.conn.execute(t.insert(), [{k: v for k, v in f.items() if k in columnas} for f in filas])
            resumen[tabla] = len(filas)
        return resumen

    # Momento al azar del día, entre las 6 a. m. y las 10 p. m. de Colombia.
    def momento(self, dia: datetime) -> datetime:
        base = dia.replace(hour=11, minute=0, second=0, microsecond=0)
        valor = base + timedelta(minutes=self.rng.randint(0, 16 * 60))
        return min(valor, self.hoy - timedelta(minutes=self.rng.randint(5, 90)))

    def sembrar(self):
        rng = self.rng
        clave = hash_password(CLAVE_DEMO)
        admin = self.conn.execute(
            text("SELECT id FROM usuarios WHERE rol = 'admin' AND id NOT LIKE :p ORDER BY created_at LIMIT 1"),
            {"p": PREFIJO + "%"},
        ).scalar()

        # Empresas con su usuario, estaciones, cargadores e historial de creación.
        estaciones = []  # (id, nombre, empresa_id, cargadores, estado)
        for datos in EMPRESAS:
            creada = self.inicio - timedelta(days=rng.randint(5, 30))
            usuario_id = self.nuevo_id("usr")
            self.agregar("usuarios", {
                "id": usuario_id, "nombre": datos["nombre"], "apellido": "",
                "email": datos["correo"], "password_hash": clave, "rol": "empresa",
                "compartir_nombre_reserva": False, "created_at": creada,
            })
            empresa_id = self.nuevo_id("emp")
            self.agregar("empresas", {
                "id": empresa_id, "usuario_id": usuario_id, "nombre_comercial": datos["nombre"],
                "razon_social": datos["razon_social"], "nit": datos["nit"], "telefono": datos["telefono"],
                "email_contacto": datos["correo"], "direccion_sede": datos["direccion"],
                "descripcion": datos["descripcion"], "color_hex": datos["color"], "logo_url": None,
                "palabras_clave": datos["palabras"], "estado": "aprobada", "creada_por_admin": True,
                "created_at": creada,
            })
            for nombre, direccion, lat, lon, estado in datos["estaciones"]:
                est_id = self.nuevo_id("est")
                creada_est = creada + timedelta(days=rng.randint(1, 4))
                tipos = rng.sample(CARGADORES_TIPO, rng.randint(2, 4))
                self.agregar("estaciones_propias", {
                    "id": est_id, "nombre": nombre, "direccion": direccion, "lat": lat, "lon": lon,
                    "tipo_conector": tipos[0][0], "potencia_kw": max(t[1] for t in tipos),
                    "descripcion": f"Estación {datos['nombre']} con {len(tipos)} puntos de carga.",
                    "operador": datos["nombre"], "activa": estado == "activa", "estado": estado,
                    "empresa_id": empresa_id, "eliminada": False, "created_at": creada_est,
                })
                self.historial(est_id, nombre, direccion, empresa_id, usuario_id, datos["nombre"],
                               "crear", "Alta de la estación en Avanze.", creada_est)
                cargadores = []
                for numero, (tipo, potencia, corriente) in enumerate(tipos, start=1):
                    car_id = self.nuevo_id("car")
                    self.agregar("estacion_cargadores", {
                        "id": car_id, "estacion_id": est_id, "numero": numero, "tipo_conector": tipo,
                        "potencia_kw": potencia, "corriente": corriente, "bahias": rng.choice([1, 2]),
                        "estado": "disponible",
                    })
                    cargadores.append((car_id, tipo, potencia))
                    self.historial(est_id, nombre, direccion, empresa_id, usuario_id, datos["nombre"],
                                   "agregar_cargador", f"Cargador {numero} {tipo} de {potencia:.0f} kW.",
                                   creada_est + timedelta(minutes=10 * numero),
                                   {"tipo_conector": tipo, "potencia_kw": potencia})
                estaciones.append({
                    "id": est_id, "nombre": nombre, "direccion": direccion, "empresa_id": empresa_id,
                    "empresa_usuario": usuario_id, "empresa_nombre": datos["nombre"],
                    "cargadores": cargadores, "estado": estado,
                })

        lugares = [{"id": e["id"], "nombre": e["nombre"], "propia": e} for e in estaciones] + [
            {"id": i, "nombre": n, "propia": None} for i, n, _ in ESTACIONES_MAPA
        ]

        # Usuarios: unos pocos de antes y luego más registros en las semanas recientes.
        usuarios = []
        usados = correos_reales(self.conn)
        for n in range(40):
            if n < 8:
                creado = self.inicio - timedelta(days=rng.randint(3, 40), hours=rng.randint(0, 12))
            else:
                progreso = rng.random() ** 0.6  # sesgo hacia fechas recientes
                creado = self.momento(self.inicio + timedelta(days=progreso * SEMANAS * 7))
            nombre, apellido = rng.choice(NOMBRES), rng.choice(APELLIDOS)
            correo = correo_conductor(nombre, apellido, n, usados)
            uid = self.nuevo_id("usr")
            self.agregar("usuarios", {
                "id": uid, "nombre": nombre, "apellido": apellido, "email": correo,
                "password_hash": clave, "rol": "usuario", "compartir_nombre_reserva": rng.random() < 0.4,
                "created_at": creado,
            })
            u = {"id": uid, "nombre": f"{nombre} {apellido}", "email": correo, "creado": creado, "metodo": None}
            usuarios.append(u)
            for _ in range(1 if rng.random() < 0.85 else 2):
                marca, modelo, anio, autonomia, conector = rng.choice(VEHICULOS)
                self.agregar("vehiculos", {
                    "id": self.nuevo_id("veh"), "usuario_id": uid, "marca": marca, "modelo": modelo,
                    "anio": anio, "autonomia_km": float(autonomia), "tipo_conector": conector, "activo": True,
                    "created_at": creado + timedelta(minutes=rng.randint(5, 600)),
                })
            if rng.random() < 0.7:
                tipo = rng.choice(["Tarjeta crédito", "Tarjeta débito", "Nequi", "PSE"])
                numero = f"**** {rng.randint(1000, 9999)}" if tipo.startswith("Tarjeta") else f"3{rng.randint(10, 23)} *** {rng.randint(1000, 9999)}"
                mid = self.nuevo_id("mpg")
                self.agregar("metodos_pago", {
                    "id": mid, "usuario_id": uid, "tipo": tipo, "numero": numero, "estado": True,
                    "created_at": creado + timedelta(minutes=30),
                })
                u["metodo"] = (mid, tipo)
            self.notificar(uid, "Bienvenido a Avanze", f"Hola {nombre}, ya puedes buscar estaciones y reservar tu carga.", "sistema", creado)

        def usuario_activo(cuando):
            vigentes = [u for u in usuarios if u["creado"] <= cuando]
            return rng.choice(vigentes) if vigentes else None

        # Actividad diaria con tendencia al alza y más movimiento los fines de semana.
        total_dias = SEMANAS * 7
        for d in range(total_dias + 1):
            dia = self.inicio + timedelta(days=d)
            progreso = d / total_dias
            factor_dia = 1.3 if (dia - timedelta(hours=5)).weekday() >= 5 else 1.0
            cargas_hoy = max(0, round((1.5 + 5 * progreso) * factor_dia + rng.uniform(-1, 1.5)))
            reservas_hoy = max(0, round((1 + 3.5 * progreso) * factor_dia + rng.uniform(-1, 1)))
            for _ in range(reservas_hoy):
                cuando = self.momento(dia)
                u = usuario_activo(cuando)
                if u:
                    self.reserva(u, rng.choice(lugares), cuando)
            for _ in range(cargas_hoy):
                cuando = self.momento(dia)
                u = usuario_activo(cuando)
                if u:
                    self.carga(u, rng.choice(lugares), cuando)
            if rng.random() < 0.25 + 0.35 * progreso:
                cuando = self.momento(dia)
                u = usuario_activo(cuando)
                if u:
                    self.compra(u, cuando, admin)
            if rng.random() < 0.22:
                cuando = self.momento(dia)
                u = usuario_activo(cuando)
                if u:
                    self.reporte(u, rng.choice(lugares), cuando)

        # Algunas reservas futuras para que el mapa muestre ocupación.
        for _ in range(8):
            u = rng.choice(usuarios)
            cuando = self.hoy - timedelta(hours=rng.randint(1, 30))
            self.reserva(u, rng.choice(lugares), cuando, futura=True)

        # Favoritos.
        for u in rng.sample(usuarios, 18):
            for lugar in rng.sample(lugares, rng.randint(1, 3)):
                cuando = u["creado"] + timedelta(days=rng.uniform(0, 5))
                self.agregar("favoritos", {
                    "id": self.nuevo_id("fav"), "usuario_id": u["id"], "estacion_ocm_id": lugar["id"],
                    "estacion_nombre": lugar["nombre"], "fecha": min(cuando, self.hoy),
                })

        self.incidentes(estaciones)

        # Mensajes del formulario de contacto.
        for u, mensaje, respondido in [
            (usuarios[3], "¿Van a agregar estaciones en la vía Bogotá–Girardot?", True),
            (usuarios[11], "Quisiera registrar mi parqueadero como punto de carga.", False),
            (usuarios[20], "No me llegó el correo de confirmación de la reserva.", True),
        ]:
            enviado = max(u["creado"], self.hoy - timedelta(days=rng.randint(1, 20)))
            nombre, _, apellido = u["nombre"].partition(" ")
            self.agregar("contactos", {
                "id": self.nuevo_id("con"), "usuario_id": u["id"], "nombre": nombre, "apellido": apellido,
                "correo": u["email"], "mensaje": mensaje,
                "respuesta": "¡Gracias por escribirnos! Ya lo estamos revisando." if respondido else None,
                "estado": "respondido" if respondido else "pendiente", "fecha_envio": enviado,
                "fecha_respuesta": enviado + timedelta(hours=6) if respondido else None,
            })

    def historial(self, est_id, nombre, direccion, empresa_id, usuario_id, usuario_nombre, accion, motivo, fecha, detalle=None):
        self.agregar("historial_estaciones", {
            "id": self.nuevo_id("his"), "estacion_id": est_id, "estacion_nombre": nombre, "direccion": direccion,
            "empresa_id": empresa_id, "usuario_id": usuario_id, "usuario_nombre": usuario_nombre,
            "accion": accion, "motivo": motivo, "detalle": detalle, "fecha": fecha,
        })

    def notificar(self, usuario_id, titulo, mensaje, tipo, cuando, leida=None):
        antigua = (self.hoy - cuando) > timedelta(days=2)
        self.agregar("notificaciones", {
            "id": self.nuevo_id("not"), "usuario_id": usuario_id, "titulo": titulo, "mensaje": mensaje,
            "tipo": tipo, "leida": antigua if leida is None else leida, "admin_leida": antigua,
            "created_at": cuando,
        })

    def reserva(self, u, lugar, creada, futura=False):
        rng = self.rng
        propia = lugar["propia"]
        cargador = rng.choice(propia["cargadores"]) if propia else None
        if propia and propia["estado"] != "activa":
            return
        if futura:
            inicio = self.hoy + timedelta(hours=rng.randint(2, 72))
            estado = rng.choice(["activa", "activa", "pendiente"])
        else:
            inicio = creada + timedelta(hours=rng.randint(1, 48))
            if inicio > self.hoy:
                estado = "activa"
            else:
                estado = rng.choices(["realizada", "cancelada", "rechazada"], [85, 11, 4])[0]
        horas = rng.choice([1, 1, 2, 2, 3])
        potencia = cargador[2] if cargador else rng.choice([22, 50, 60, 120])
        tarifa = 8000 if potencia >= 100 else 6500 if potencia >= 50 else 5000
        costo = int(round((2500 + tarifa * horas) / 1000) * 1000)
        rid = self.nuevo_id("res")
        self.agregar("reservas", {
            "id": rid, "usuario_id": u["id"], "estacion_ocm_id": lugar["id"],
            "cargador_id": cargador[0] if cargador else None, "estacion_nombre": lugar["nombre"],
            "reservante_nombre": u["nombre"], "fecha_hora_inicio": inicio,
            "fecha_hora_fin": inicio + timedelta(hours=horas),
            "costo_pagado": costo if estado != "pendiente" else 0, "estado": estado, "created_at": creada,
        })
        if estado != "pendiente":
            metodo = u["metodo"] or (None, rng.choice(["Tarjeta crédito", "Nequi", "PSE"]))
            self.agregar("pagos_reserva", {
                "id": self.nuevo_id("pag"), "usuario_id": u["id"],
                "transaccion_id": transaccion(f"res{self.contadores['res']:05d}"), "monto": float(costo),
                "metodo": metodo[1], "metodo_id": metodo[0], "estado": "aprobado", "reserva_id": rid,
                "created_at": creada,
            })
            self.notificar(u["id"], "Pago realizado", f"Se aprobó el pago de ${costo:,.0f} COP por la reserva en {lugar['nombre']}.", "pago", creada)
        self.notificar(u["id"], "Reserva registrada", f"Tu reserva en {lugar['nombre']} quedó {estado}.", "reserva", creada)

    def carga(self, u, lugar, cuando):
        rng = self.rng
        propia = lugar["propia"]
        if propia and propia["estado"] != "activa" and rng.random() < 0.8:
            return
        cargador = rng.choice(propia["cargadores"]) if propia else None
        kwh = round(rng.uniform(8, 62), 1)
        recientes = (self.hoy - cuando) < timedelta(days=3)
        estado = "pendiente" if recientes and rng.random() < 0.6 else rng.choices(["validada", "rechazada"], [93, 7])[0]
        self.agregar("cargas", {
            "id": self.nuevo_id("crg"), "usuario_id": u["id"], "estacion_ocm_id": lugar["id"],
            "cargador_id": cargador[0] if cargador else None, "estacion_nombre": lugar["nombre"],
            "kwh_cargados": kwh, "costo_estimado": float(round(kwh * rng.uniform(1100, 1400), -1)),
            "notas": rng.choice(["", "", "Carga completa sin problemas.", "Llegué con 15 % de batería.", "Viaje a la finca."]),
            "estado": estado, "fecha": cuando,
        })
        if estado != "pendiente":
            self.notificar(u["id"], f"Carga {estado}", f"Tu carga de {kwh} kWh en {lugar['nombre']} fue {estado}.", "sistema", cuando + timedelta(hours=3))
        if estado == "validada" and rng.random() < 0.45:
            puntaje = rng.choices([5, 4, 3, 2, 1], [48, 32, 12, 5, 3])[0]
            fecha = min(cuando + timedelta(hours=rng.randint(1, 20)), self.hoy)
            self.agregar("calificaciones", {
                "id": self.nuevo_id("cal"), "usuario_id": u["id"], "estacion_ocm_id": lugar["id"],
                "estacion_nombre": lugar["nombre"], "puntaje": puntaje,
                "comentario": rng.choice(RESENAS[puntaje]), "fecha": fecha,
            })
            self.notificar(u["id"], "Gracias por tu reseña", f"Calificaste {lugar['nombre']} con {puntaje} estrellas.", "calificacion", fecha)

    def compra(self, u, cuando, admin):
        rng = self.rng
        productos = list(PRECIOS_PRODUCTOS.items())
        pesos = [1 if precio > 50_000_000 else 6 if precio < 3_000_000 else 4 for _, precio in productos]
        producto, precio = rng.choices(productos, pesos)[0]
        cantidad = rng.choice([2, 4]) if producto.startswith("Llanta") else 1
        dias = (self.hoy - cuando).days
        if rng.random() < 0.05:
            estado_pedido = "cancelado"
        elif dias > 12:
            estado_pedido = "entregado"
        elif dias > 6:
            estado_pedido = rng.choice(["enviado", "entregado"])
        elif dias > 2:
            estado_pedido = rng.choice(["confirmado", "enviado"])
        else:
            estado_pedido = rng.choice(["pendiente", "confirmado"])
        ciudad, direccion = rng.choice(DIRECCIONES)
        metodo = u["metodo"] or (None, rng.choice(["Tarjeta crédito", "PSE"]))
        cid = self.nuevo_id("cmp")
        monto = float(precio * cantidad)
        self.agregar("compras", {
            "id": cid, "usuario_id": u["id"], "producto": producto, "cantidad": cantidad, "monto": monto,
            "metodo": metodo[1], "metodo_id": metodo[0], "transaccion_id": transaccion(f"cmp{self.contadores['cmp']:04d}"),
            "estado": "aprobada", "estado_pedido": estado_pedido, "contacto_nombre": u["nombre"],
            "contacto_telefono": f"3{rng.randint(0, 2)}{rng.randint(0, 9)} {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
            "direccion_envio": direccion, "ciudad": ciudad,
            "notas_cliente": rng.choice([None, None, "Entregar en portería.", "Llamar antes de llegar."]),
            "created_at": cuando, "updated_at": min(cuando + timedelta(days=min(dias, 3)), self.hoy),
        })
        self.notificar(u["id"], "Compra completada", f"Se aprobó el pago de ${monto:,.0f} COP por {producto}.", "compra", cuando)
        if rng.random() < 0.6:
            for i, (es_admin, texto) in enumerate(CHAT_PEDIDO[: rng.randint(1, len(CHAT_PEDIDO))]):
                momento = cuando + timedelta(hours=2 + i * 3)
                if momento > self.hoy:
                    break
                self.agregar("mensajes_compra", {
                    "id": self.nuevo_id("msg"), "compra_id": cid, "autor_id": admin if es_admin else u["id"],
                    "es_admin": es_admin, "texto": texto, "leido": (self.hoy - momento) > timedelta(hours=12),
                    "created_at": momento,
                })

    def reporte(self, u, lugar, cuando):
        rng = self.rng
        tipo, descripcion = rng.choice(REPORTES)
        antiguo = (self.hoy - cuando) > timedelta(days=7)
        estado = rng.choice(["resuelto", "resuelto", "descartado"]) if antiguo else rng.choice(["abierto", "abierto", "resuelto"])
        rid = self.nuevo_id("rep")
        self.agregar("reportes", {
            "id": rid, "usuario_id": u["id"], "estacion_ocm_id": lugar["id"], "estacion_nombre": lugar["nombre"],
            "tipo": tipo, "descripcion": descripcion, "estado": estado, "fecha": cuando,
        })
        self.notificar(u["id"], "Reporte recibido", f"Recibimos tu reporte sobre {lugar['nombre']}.", "reporte", cuando)
        if lugar["propia"] is not None:
            lugar["propia"].setdefault("reportes", []).append((rid, cuando, descripcion))

    def incidentes(self, estaciones):
        rng = self.rng
        for est in estaciones:
            mantenimiento = est["estado"] == "mantenimiento"
            cantidad = 2 if mantenimiento else rng.choice([0, 1, 1, 2])
            for k in range(cantidad):
                tipo, titulo, descripcion, prioridad, bloquea = rng.choice(INCIDENTES)
                abierto_ahora = mantenimiento and k == 0
                if abierto_ahora:
                    tipo, titulo, descripcion, prioridad, bloquea = INCIDENTES[0]
                inicio = self.hoy - timedelta(days=rng.randint(1, 4) if abierto_ahora else rng.randint(5, 50))
                estado = rng.choice(["abierto", "en_progreso"]) if abierto_ahora else rng.choice(["resuelto", "cerrado", "cerrado"])
                fin = None if estado in ("abierto", "en_progreso") else inicio + timedelta(hours=rng.randint(4, 72))
                reporte = (est.get("reportes") or [None])[0]
                cargador = rng.choice(est["cargadores"])
                self.agregar("incidentes", {
                    "id": self.nuevo_id("inc"), "estacion_id": est["id"], "cargador_id": cargador[0],
                    "reporte_id": reporte[0] if reporte and k == 0 else None, "empresa_id": est["empresa_id"],
                    "usuario_id": est["empresa_usuario"], "tipo": tipo, "titulo": titulo, "descripcion": descripcion,
                    "prioridad": prioridad, "bloquea_estacion": bloquea and abierto_ahora, "estado": estado,
                    "fecha_inicio": inicio, "fecha_fin": fin,
                    "solucion": None if fin is None else "Se reemplazó la pieza y se probó una carga completa.",
                    "created_at": inicio,
                })
                self.historial(est["id"], est["nombre"], est["direccion"], est["empresa_id"], est["empresa_usuario"],
                               est["empresa_nombre"], "abrir_incidente", titulo, inicio)
                if fin:
                    self.historial(est["id"], est["nombre"], est["direccion"], est["empresa_id"], est["empresa_usuario"],
                                   est["empresa_nombre"], "cerrar_incidente", "Incidente solucionado.", fin)
            if mantenimiento:
                self.historial(est["id"], est["nombre"], est["direccion"], est["empresa_id"], est["empresa_usuario"],
                               est["empresa_nombre"], "cambiar_estado", "Cargador principal fuera de servicio por daño en el conector.",
                               self.hoy - timedelta(days=1), {"antes": "activa", "despues": "mantenimiento"})


def correos_reales(conn) -> set[str]:
    """Correos de cuentas que no son demo, para no chocar con ellas."""
    filas = conn.execute(text("SELECT email FROM usuarios WHERE id NOT LIKE :p"), {"p": PREFIJO + "%"})
    return {f[0].lower() for f in filas if f[0]}


def actualizar_cuentas(conn) -> dict[str, int]:
    """Pone los correos, la contraseña y los ids de transacción nuevos en los datos demo que ya
    existen, sin borrar nada (así se conservan fotos, reservas y demás cosas hechas a mano)."""
    clave = hash_password(CLAVE_DEMO)
    existentes = set(inspect(conn).get_table_names())
    resumen = {"empresas": 0, "conductores": 0, "transacciones": 0}
    for datos in EMPRESAS:
        fila = conn.execute(
            text("SELECT id, usuario_id FROM empresas WHERE id LIKE :p AND nombre_comercial = :n"),
            {"p": PREFIJO + "%", "n": datos["nombre"]},
        ).first()
        if not fila:
            continue
        conn.execute(text("UPDATE usuarios SET email = :e, password_hash = :c WHERE id = :u"),
                     {"e": datos["correo"], "c": clave, "u": fila.usuario_id})
        conn.execute(text("UPDATE empresas SET email_contacto = :e, razon_social = :r WHERE id = :i"),
                     {"e": datos["correo"], "r": datos["razon_social"], "i": fila.id})
        resumen["empresas"] += 1

    usados = correos_reales(conn)
    conductores = conn.execute(
        text("SELECT id, nombre, apellido FROM usuarios WHERE id LIKE :p AND rol = 'usuario' ORDER BY id"),
        {"p": PREFIJO + "%"},
    ).all()
    for n, fila in enumerate(conductores):
        correo = correo_conductor(fila.nombre, fila.apellido, n, usados)
        conn.execute(text("UPDATE usuarios SET email = :e, password_hash = :c WHERE id = :u"),
                     {"e": correo, "c": clave, "u": fila.id})
        if "contactos" in existentes:
            conn.execute(text("UPDATE contactos SET correo = :e WHERE usuario_id = :u AND id LIKE :p"),
                         {"e": correo, "u": fila.id, "p": PREFIJO + "%"})
        resumen["conductores"] += 1

    for tabla in ("pagos_reserva", "compras", "reservas"):
        if tabla not in existentes or "transaccion_id" not in {c["name"] for c in inspect(conn).get_columns(tabla)}:
            continue
        filas = conn.execute(
            text(f'SELECT id, transaccion_id FROM "{tabla}" WHERE transaccion_id LIKE :t'), {"t": "TX-EV-DEMO%"}
        ).all()
        for fila in filas:
            resto = fila.transaccion_id[len("TX-EV-DEMO"):]
            etiqueta = "cmp" + resto[1:] if resto.startswith("C") else "res" + resto
            conn.execute(text(f'UPDATE "{tabla}" SET transaccion_id = :t WHERE id = :i'),
                         {"t": transaccion(etiqueta), "i": fila.id})
            resumen["transacciones"] += 1
    return resumen


def borrar_demo(conn) -> dict[str, int]:
    existentes = set(inspect(conn).get_table_names())
    resumen = {}
    for tabla in TABLAS_DEMO:
        if tabla not in existentes:
            continue
        borradas = conn.execute(text(f'DELETE FROM "{tabla}" WHERE id LIKE :p'), {"p": PREFIJO + "%"}).rowcount
        if borradas:
            resumen[tabla] = borradas
    return resumen


def main(argv=None):
    parser = argparse.ArgumentParser(description="Crea o borra los datos de demostración de Avanze.")
    parser.add_argument("--borrar", action="store_true", help="solo borra los datos demo")
    parser.add_argument("--actualizar-cuentas", action="store_true",
                        help="cambia correos y contraseña de las cuentas demo existentes sin borrar nada")
    args = parser.parse_args(argv)

    if args.actualizar_cuentas:
        with engine.begin() as conn:
            resumen = actualizar_cuentas(conn)
        print("Cuentas actualizadas:", resumen)
        print(f"Todas usan la contraseña {CLAVE_DEMO}")
        return

    with engine.begin() as conn:
        borrados = borrar_demo(conn)
        if args.borrar:
            print("Datos demo borrados:", borrados or "no había")
            return
        sembrador = Sembrador(conn)
        sembrador.sembrar()
        creados = sembrador.guardar()
    if borrados:
        print("Se reemplazaron los datos demo anteriores.")
    print("Datos demo creados:")
    for tabla, n in creados.items():
        print(f"  {tabla}: {n}")
    print(f"Todas las cuentas creadas usan la contraseña {CLAVE_DEMO}")


if __name__ == "__main__":
    sys.exit(main())
