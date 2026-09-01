import os
import requests
from fastapi import HTTPException
from app.utils.waze_service import waze_service


class MapaController:
    """Clase orientada a objetos para consumir APIs externas de mapas (OSRM y OCM)."""

    def __init__(self):
        self.osrm_url = "http://router.project-osrm.org/route/v1/driving"
        self.ocm_api_key = os.getenv("OCM_API_KEY", "")

    def obtener_ruta_vial(self, user_lat: float, user_lon: float, dest_lat: float, dest_lon: float) -> dict:
        """Pide a OSRM la trazabilidad de la ruta entre dos coordenadas."""
        url = f"{self.osrm_url}/{user_lon},{user_lat};{dest_lon},{dest_lat}?overview=full&geometries=geojson"
        try:
            res = requests.get(url, timeout=10)
            data = res.json()
            if "routes" not in data or not data["routes"]:
                raise HTTPException(500, "No se pudo calcular la ruta vial")
            return data["routes"][0]["geometry"]
        except Exception:
            raise HTTPException(503, "Error conectando con el servicio de rutas (OSRM)")

    def planificar_viaje(self, origen_lat: float, origen_lon: float, destino_lat: float, destino_lon: float, autonomia_km: float = 300) -> dict:
        """Calcula la ruta y busca estaciones en la API de OpenChargeMap para sugerir paradas."""
        url = f"{self.osrm_url}/{origen_lon},{origen_lat};{destino_lon},{destino_lat}?overview=full&geometries=geojson&steps=true"
        try:
            ruta = requests.get(url, timeout=10).json()["routes"][0]
            distancia_total_km = ruta["distance"] / 1000
            paradas_necesarias = max(1, int(distancia_total_km / (autonomia_km * 0.8)))
            coords = ruta["geometry"]["coordinates"]
            sugerencias = []

            for i in range(1, paradas_necesarias + 1):
                idx = int((i / (paradas_necesarias + 1)) * len(coords))
                punto = coords[min(idx, len(coords) - 1)]

                ocm_url = (
                    f"https://api.openchargemap.io/v3/poi/?output=json&countrycode=CO"
                    f"&latitude={punto[1]}&longitude={punto[0]}"
                    f"&distance=5&distanceunit=KM&compact=true&verbose=false&maxresults=3"
                    f"&key={self.ocm_api_key}"
                )

                ocm_resp = requests.get(ocm_url, timeout=8).json()
                for st in ocm_resp[:2]:
                    sugerencias.append({
                        "id": str(st.get("ID", "")),
                        "nombre": st.get("AddressInfo", {}).get("Title", "Estación"),
                        "lat": st.get("AddressInfo", {}).get("Latitude"),
                        "lon": st.get("AddressInfo", {}).get("Longitude"),
                        "parada_numero": i
                    })

            return {
                "distancia_total_km": round(distancia_total_km, 1),
                "duracion_min": round(ruta["duration"] / 60, 0),
                "paradas_sugeridas": paradas_necesarias,
                "geometry": ruta["geometry"],
                "estaciones_en_ruta": sugerencias
            } 
        except Exception as e:
            print(f"[MAPA DEBUG - RUTAS] {type(e).__name__}: {e}")
            raise HTTPException(503, "Error conectando con OSRM u OCM")

    def obtener_estaciones_cercanas(self, lat: float, lon: float, distancia_km: float = 20) -> list:
        """Busca estaciones de carga en un radio específico para la vista inicial del mapa."""
        url = (
            f"https://api.openchargemap.io/v3/poi/?output=json&countrycode=CO"
            f"&latitude={lat}&longitude={lon}"
            f"&distance={distancia_km}&distanceunit=KM&compact=true&verbose=false&maxresults=50"
            f"&key={self.ocm_api_key}"
        )
        try:
            res = requests.get(url, timeout=10)
            data = res.json()
            estaciones = []
            for st in data:
                estaciones.append({
                    "id": str(st.get("ID", "")),
                    "nombre": st.get("AddressInfo", {}).get("Title", "Estación Desconocida"),
                    "lat": st.get("AddressInfo", {}).get("Latitude"),
                    "lon": st.get("AddressInfo", {}).get("Longitude")
                })
            return estaciones
        except Exception as e:
            print(f"[MAPA DEBUG - INICIAL] {type(e).__name__}: {e}")
            raise HTTPException(503, "Error obteniendo estaciones base de OCM")

    def planificar_viaje_con_waze(self, origen_lat: float, origen_lon: float, destino_lat: float, destino_lon: float, autonomia_km: float = 300) -> dict:
        """Planifica viaje considerando tráfico y alertas de Waze."""
        url = f"{self.osrm_url}/{origen_lon},{origen_lat};{destino_lon},{destino_lat}?overview=full&geometries=geojson&steps=true"
        try:
            # Obtener ruta desde OSRM
            osrm_response = requests.get(url, timeout=10)
            osrm_response.raise_for_status()  # Lanzar excepción si status code es error
            osrm_data = osrm_response.json()
            
            # Validar que OSRM devolvió una ruta válida
            if "routes" not in osrm_data or not osrm_data["routes"]:
                print(f"[MAPA DEBUG - WAZE] OSRM sin rutas. Respuesta: {osrm_data}")
                raise HTTPException(503, "OSRM no encontró una ruta válida")
            
            ruta = osrm_data["routes"][0]
            distancia_total_km = ruta["distance"] / 1000
            duracion_base_min = int(ruta["duration"] / 60)
            paradas_necesarias = max(1, int(distancia_total_km / (autonomia_km * 0.8)))
            coords = ruta["geometry"]["coordinates"]
            sugerencias = []

            # Buscar estaciones en la ruta
            for i in range(1, paradas_necesarias + 1):
                idx = int((i / (paradas_necesarias + 1)) * len(coords))
                punto = coords[min(idx, len(coords) - 1)]

                ocm_url = (
                    f"https://api.openchargemap.io/v3/poi/?output=json&countrycode=CO"
                    f"&latitude={punto[1]}&longitude={punto[0]}"
                    f"&distance=5&distanceunit=KM&compact=true&verbose=false&maxresults=3"
                    f"&key={self.ocm_api_key}"
                )

                try:
                    ocm_resp = requests.get(ocm_url, timeout=8).json()
                    for st in ocm_resp[:2]:
                        sugerencias.append({
                            "id": str(st.get("ID", "")),
                            "nombre": st.get("AddressInfo", {}).get("Title", "Estación"),
                            "lat": st.get("AddressInfo", {}).get("Latitude"),
                            "lon": st.get("AddressInfo", {}).get("Longitude"),
                            "parada_numero": i
                        })
                except Exception as e:
                    print(f"[MAPA DEBUG - OCM en WAZE] {type(e).__name__}: {e}")
                    # Continuar aunque OCM falle, no es crítico

            # Evaluar ruta con Waze
            evaluacion_waze = waze_service.evaluar_ruta_con_waze(
                origen_lat, origen_lon, destino_lat, destino_lon, duracion_base_min
            )

            return {
                "distancia_total_km": round(distancia_total_km, 1),
                "duracion_base_min": duracion_base_min,
                "duracion_con_trafico_min": evaluacion_waze["eta_ajustada_min"],
                "paradas_sugeridas": paradas_necesarias,
                "geometry": ruta["geometry"],
                "estaciones_en_ruta": sugerencias,
                "evaluacion_waze": evaluacion_waze
            }
        except HTTPException:
            raise
        except Exception as e:
            print(f"[MAPA DEBUG - WAZE COMPLETO] {type(e).__name__}: {e}")
            raise HTTPException(503, "Error en planificación con Waze")

    def obtener_alertas_area(self, lat_min: float, lon_min: float, lat_max: float, lon_max: float) -> dict:
        """Obtiene todas las alertas y atascos de Waze en un área específica."""
        return waze_service.obtener_alertas_en_area(lat_min, lon_min, lat_max, lon_max)