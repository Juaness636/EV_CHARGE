# Backend/utils/waze_service.py
import os
import requests
from typing import Optional, Dict, List


class WazeService:
    """Servicio para integración con Waze API"""
    
    def __init__(self):
        self.api_key = os.getenv("WAZE_API_KEY")
        self.api_url = "https://api.openwebninja.com/waze/alerts-and-jams"
        
        if not self.api_key:
            print("[WAZE] Advertencia: WAZE_API_KEY no configurada. Las alertas de Waze no estarán disponibles.")
    
    def obtener_alertas_en_area(
        self,
        lat_min: float,
        lon_min: float,
        lat_max: float,
        lon_max: float
    ) -> Dict:
        """
        Obtiene alertas y atascos de Waze en un área específica.
        
        Args:
            lat_min: Latitud mínima (bottom_left)
            lon_min: Longitud mínima (bottom_left)
            lat_max: Latitud máxima (top_right)
            lon_max: Longitud máxima (top_right)
        
        Returns:
            Dict con alertas, atascos e información de tráfico
        """
        if not self.api_key:
            return {"alertas": [], "atascos": [], "disponible": False}
        
        try:
            headers = {"X-API-Key": self.api_key}
            params = {
                "bottom_left": f"{lat_min},{lon_min}",
                "top_right": f"{lat_max},{lon_max}"
            }
            
            response = requests.get(
                self.api_url,
                params=params,
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "disponible": True,
                    "alertas": self._procesar_alertas(data.get("alerts", [])),
                    "atascos": self._procesar_atascos(data.get("jams", [])),
                    "info": data.get("info", {})
                }
            else:
                print(f"[WAZE ERROR] Status {response.status_code}: {response.text}")
                return {"alertas": [], "atascos": [], "disponible": False}
                
        except requests.exceptions.Timeout:
            print("[WAZE] Timeout conectando a API de Waze")
            return {"alertas": [], "atascos": [], "disponible": False}
        except Exception as e:
            print(f"[WAZE ERROR] {type(e).__name__}: {e}")
            return {"alertas": [], "atascos": [], "disponible": False}
    
    def _procesar_alertas(self, alertas: List) -> List[Dict]:
        """Procesa alertas de Waze"""
        procesadas = []
        for alerta in alertas:
            procesadas.append({
                "tipo": alerta.get("type", "unknown"),
                "ubicacion": alerta.get("location", {}),
                "descripcion": alerta.get("description", ""),
                "severidad": alerta.get("severity", "low"),
                "latitud": alerta.get("location", {}).get("y"),
                "longitud": alerta.get("location", {}).get("x"),
                "reportado_hace": alerta.get("reportedBy", "")
            })
        return procesadas
    
    def _procesar_atascos(self, atascos: List) -> List[Dict]:
        """Procesa atascos/congestiones de Waze"""
        procesados = []
        for atasco in atascos:
            # Calcular severidad según speed y speedLimit
            velocidad_actual = atasco.get("speed", 0)
            velocidad_limite = atasco.get("speedLimit", 60)
            congestion_nivel = self._calcular_congestion(velocidad_actual, velocidad_limite)
            
            procesados.append({
                "id": atasco.get("id"),
                "ubicacion": atasco.get("location", {}),
                "velocidad_actual_kmh": velocidad_actual,
                "velocidad_limite_kmh": velocidad_limite,
                "nivel_congestion": congestion_nivel,  # "bajo", "medio", "alto", "crítico"
                "longitud_km": round(atasco.get("length", 0) / 1000, 2),
                "latitud": atasco.get("location", {}).get("y"),
                "longitud": atasco.get("location", {}).get("x"),
                "tiempo_retraso_min": self._calcular_retraso(
                    atasco.get("length", 0),
                    velocidad_actual if velocidad_actual > 0 else 10
                )
            })
        return procesados
    
    def _calcular_congestion(self, velocidad_actual: float, velocidad_limite: float) -> str:
        """Calcula nivel de congestión en base a velocidades"""
        if velocidad_actual == 0:
            return "crítico"
        
        porcentaje = (velocidad_actual / velocidad_limite) * 100 if velocidad_limite > 0 else 100
        
        if porcentaje > 75:
            return "bajo"
        elif porcentaje > 50:
            return "medio"
        elif porcentaje > 25:
            return "alto"
        else:
            return "crítico"
    
    def _calcular_retraso(self, distancia_m: float, velocidad_kmh: float) -> int:
        """Calcula minutos de retraso estimado"""
        if velocidad_kmh <= 0:
            return 999
        
        distancia_km = distancia_m / 1000
        tiempo_min = (distancia_km / velocidad_kmh) * 60
        return int(tiempo_min)
    
    def evaluar_ruta_con_waze(
        self,
        origen_lat: float,
        origen_lon: float,
        destino_lat: float,
        destino_lon: float,
        duracion_base_min: int
    ) -> Dict:
        """
        Evalúa una ruta considerando alertas y atascos de Waze.
        Devuelve sugerencias de acciones y ETA ajustado.
        """
        # Obtener área de influencia (margen de seguridad)
        margen = 0.05  # Aproximadamente 5 km
        lat_min = min(origen_lat, destino_lat) - margen
        lat_max = max(origen_lat, destino_lat) + margen
        lon_min = min(origen_lon, destino_lon) - margen
        lon_max = max(origen_lon, destino_lon) + margen
        
        datos_waze = self.obtener_alertas_en_area(lat_min, lon_min, lat_max, lon_max)
        
        if not datos_waze["disponible"]:
            return {
                "disponible": False,
                "eta_ajustada_min": duracion_base_min,
                "advertencias": [],
                "recomendaciones": []
            }
        
        alertas = datos_waze["alertas"]
        atascos = datos_waze["atascos"]
        
        # Calcular retraso total por atascos
        retraso_total = sum(a["tiempo_retraso_min"] for a in atascos)
        eta_ajustada = duracion_base_min + retraso_total
        
        # Generar advertencias
        advertencias = []
        for alerta in alertas:
            if alerta["severidad"] in ["high", "critical"]:
                advertencias.append({
                    "tipo": alerta["tipo"],
                    "mensaje": f"⚠️ {alerta['descripcion']}",
                    "ubicacion": alerta["ubicacion"]
                })
        
        # Generar recomendaciones
        recomendaciones = []
        atascos_criticos = [a for a in atascos if a["nivel_congestion"] in ["alto", "crítico"]]
        
        if atascos_criticos:
            recomendaciones.append({
                "tipo": "congestion",
                "mensaje": f"⚠️ Se detectaron {len(atascos_criticos)} zona(s) con congestión crítica. Considera partir más temprano.",
                "severidad": "alta"
            })
        
        if retraso_total > duracion_base_min * 0.3:  # Si hay más de 30% de retraso
            recomendaciones.append({
                "tipo": "retraso",
                "mensaje": f"⏱️ ETA ajustado: {eta_ajustada} minutos (retraso estimado: +{retraso_total} min)",
                "severidad": "media"
            })
        
        return {
            "disponible": True,
            "eta_ajustada_min": eta_ajustada,
            "retraso_estimado_min": retraso_total,
            "advertencias": advertencias,
            "recomendaciones": recomendaciones,
            "resumen": {
                "total_atascos": len(atascos),
                "atascos_criticos": len(atascos_criticos),
                "total_alertas": len(alertas),
                "alertas_graves": len([a for a in alertas if a["severidad"] in ["high", "critical"]])
            }
        }


# Instancia global
waze_service = WazeService()
