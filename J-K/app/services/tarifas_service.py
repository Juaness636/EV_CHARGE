"""Reglas de tarifa para reservas de cargadores EV Charge."""


def calcular_precio_reserva(
    estacion_nombre: str,
    operador: str,
    tipo_cargador: str,
    potencia_kw: float | None,
    duracion_horas: float,
) -> dict[str, int | float]:
    horas = max(1, round(float(duracion_horas)))
    potencia = float(potencia_kw or 22)
    texto_estacion = f"{estacion_nombre} {operador}".lower()
    if "enel" in texto_estacion:
        factor_estacion = 1.15
    elif "terpel" in texto_estacion:
        factor_estacion = 1.08
    elif "primax" in texto_estacion:
        factor_estacion = 1.1
    else:
        factor_estacion = 1.0

    tipo = (tipo_cargador or "").lower()
    if potencia > 100 or "dc" in tipo or "gb/t" in tipo:
        tarifa_hora = 8000
    elif potencia >= 50 or "ccs" in tipo:
        tarifa_hora = 6500
    elif potencia >= 20 or "type 2" in tipo:
        tarifa_hora = 5000
    else:
        tarifa_hora = 3500

    subtotal = (2500 + tarifa_hora * horas) * factor_estacion
    total = int(round(subtotal / 1000) * 1000)
    return {
        "horas": horas,
        "tarifa_hora": tarifa_hora,
        "factor_estacion": factor_estacion,
        "total": max(1000, total),
    }


# Duración máxima de una reserva, en horas.
MAX_HORAS_RESERVA = 24


def _datos_cargador(db, estacion_id: str, cargador_id: str | None) -> dict:
    """Nombre, operador, conector y potencia del cargador, leídos del servidor.

    Las estaciones propias salen de la base de datos y las demás de OpenChargeMap.
    Nunca se usan los datos que envía la app, que podrían manipularse para pagar menos.
    """
    from fastapi import HTTPException

    from app.controllers.admin_controller import buscar_estacion_ocm, operador_visible
    from app.controllers.empresa_estaciones_controller import cargador_por_referencia
    from app.models.estacion_propia_model import EstacionPropia
    from app.models.estado_estacion_model import EstadoEstacion

    propia = db.query(EstacionPropia).filter(EstacionPropia.id == estacion_id).first()
    if propia:
        if propia.eliminada:
            raise HTTPException(status_code=404, detail="La estación ya no está disponible.")
        cargador = cargador_por_referencia(db, propia.id, cargador_id)
        return {
            "estacion_nombre": propia.nombre,
            "operador": operador_visible(propia.operador, propia.nombre),
            "tipo_cargador": cargador.tipo_conector if cargador else (propia.tipo_conector or ""),
            "potencia_kw": cargador.potencia_kw if cargador else propia.potencia_kw,
        }

    estacion = buscar_estacion_ocm(estacion_id)
    override = db.query(EstadoEstacion).filter(EstadoEstacion.estacion_ocm_id == str(estacion_id)).first()
    if not estacion or (override and override.eliminada):
        raise HTTPException(status_code=404, detail="No encontramos la estación seleccionada.")
    info = estacion.get("AddressInfo") or {}
    conexiones = estacion.get("Connections") or []
    conexion = None
    # El mapa nombra cada conector por su posición: "<estacion>-<n>" (n empieza en 1).
    sufijo = str(cargador_id or "").rsplit("-", 1)[-1]
    if sufijo.isdigit() and 1 <= int(sufijo) <= len(conexiones):
        conexion = conexiones[int(sufijo) - 1]
    elif conexiones:
        # Sin un conector concreto se cobra el de mayor potencia: nunca se cobra de menos.
        conexion = max(conexiones, key=lambda c: c.get("PowerKW") or 0)
    nombre = (override.nombre if override and override.nombre else info.get("Title")) or "Estación"
    operador = override.operador if override and override.operador else (estacion.get("OperatorInfo") or {}).get("Title")
    return {
        "estacion_nombre": nombre,
        "operador": operador_visible(operador, nombre),
        "tipo_cargador": ((conexion or {}).get("ConnectionType") or {}).get("Title", ""),
        "potencia_kw": (conexion or {}).get("PowerKW"),
    }


def cotizar_reserva_servidor(db, estacion_id: str, cargador_id: str | None, duracion_horas: float) -> dict:
    """Precio oficial de una reserva, calculado solo con datos del servidor."""
    from fastapi import HTTPException

    if not 0 < float(duracion_horas) <= MAX_HORAS_RESERVA:
        raise HTTPException(status_code=400, detail=f"La reserva debe durar entre 1 y {MAX_HORAS_RESERVA} horas.")
    datos = _datos_cargador(db, estacion_id, cargador_id)
    return calcular_precio_reserva(
        datos["estacion_nombre"],
        datos["operador"],
        datos["tipo_cargador"],
        datos["potencia_kw"],
        duracion_horas,
    )
