# Precios oficiales del catálogo de productos (COP).
# El servidor cobra siempre este valor: el monto que envía el cliente solo se usa
# para detectar que su catálogo está desactualizado, nunca para decidir el cobro.
# Debe mantenerse igual a features/productos/productos.data.ts (web y móvil).

PRECIOS_PRODUCTOS: dict[str, int] = {
    "Cargador Rápido DC 150 kW": 165_000_000,
    "Wallbox Inteligente 22 kW": 7_800_000,
    "Cargador Portátil 7,4 kW": 2_400_000,
    'Llanta Michelin Pilot Sport EV 20"': 2_650_000,
    'Llanta Hankook iON evo 22"': 3_200_000,
    "Módulo de Batería 48V": 6_800_000,
    "Batería Auxiliar 12V EV": 1_150_000,
    "Cable Tipo 2 a Tipo 2 (5 m)": 1_350_000,
    "Adaptador CCS2 a GB/T": 2_400_000,
}


def precio_producto(nombre: str) -> int | None:
    return PRECIOS_PRODUCTOS.get((nombre or "").strip())
