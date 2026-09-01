# Integración de Waze en EV Charge

Este documento explica cómo se ha integrado la API de Waze para mejorar la planificación de rutas considerando tráfico en tiempo real.

## 📋 Características Implementadas

✅ **Optimizar rutas considerando tráfico**
- Calcula ETA realista considerando congestiones y atascos
- Ajusta automáticamente el tiempo estimado de llegada

✅ **Sugerir rutas más rápidas**
- Analiza alternativas de rutas basadas en condiciones de tráfico
- Adapta la sugerencia de paradas de recarga según el tráfico

✅ **Advertir sobre atascos**
- Notifica al usuario sobre congestiones críticas
- Muestra retraso estimado en cada zona de tráfico

✅ **Mostrar alertas en el mapa**
- Marca atascos críticos en el mapa con círculos rojos
- Muestra información detallada al hacer clic

✅ **Mostrar tiempo de llegada mejorado**
- Tiempo base (sin tráfico)
- Tiempo con tráfico (ETA ajustado)
- Diferencia estimada en minutos

## 🔧 Configuración

### 1. Obtener API Key de Waze

1. Ir a: https://rapidapi.com/openwebninja-openwebninja-default/api/waze-live-data
2. Registrarse o iniciar sesión en RapidAPI
3. Copiar tu API Key del panel de RapidAPI
4. Esta API proporciona acceso a datos de Waze (alertas, atascos, tráfico)

### 2. Configurar Variables de Entorno

En la carpeta raíz del proyecto (`EV_CHARGE/`), crear o actualizar el archivo `.env`:

```bash
# OpenChargeMap API (ya existente)
OCM_API_KEY=tu_ocm_api_key_aqui

# Waze API Key (NUEVO)
WAZE_API_KEY=tu_waze_api_key_de_rapidapi_aqui
```

**Importante**: Nunca hacer commit del archivo `.env` real. Usar `.env.example` como referencia.

### 3. Instalar dependencias (si es necesario)

El servicio de Waze ya incluye la biblioteca `requests`, que debería estar en `requirements.txt`.

```bash
pip install -r requirements.txt
```

## 📡 Nuevos Endpoints

### GET `/planificar-viaje-waze`

Planifica un viaje considerando tráfico y alertas de Waze.

**Parámetros:**
- `origen_lat`: Latitud de origen (float)
- `origen_lon`: Longitud de origen (float)
- `destino_lat`: Latitud de destino (float)
- `destino_lon`: Longitud de destino (float)
- `autonomia_km`: Autonomía del vehículo en km (default: 300)

**Respuesta:**
```json
{
  "distancia_total_km": 150.5,
  "duracion_base_min": 120,
  "duracion_con_trafico_min": 145,
  "paradas_sugeridas": 2,
  "geometry": { /* GeoJSON */ },
  "estaciones_en_ruta": [
    {
      "id": "123",
      "nombre": "Estación Central",
      "lat": 4.7110,
      "lon": -74.0721,
      "parada_numero": 1
    }
  ],
  "evaluacion_waze": {
    "disponible": true,
    "eta_ajustada_min": 145,
    "retraso_estimado_min": 25,
    "advertencias": [],
    "recomendaciones": [
      {
        "tipo": "retraso",
        "mensaje": "⏱️ ETA ajustado: 145 minutos (retraso estimado: +25 min)",
        "severidad": "media"
      }
    ],
    "resumen": {
      "total_atascos": 3,
      "atascos_criticos": 1,
      "total_alertas": 2,
      "alertas_graves": 0
    }
  }
}
```

### GET `/alertas-waze`

Obtiene alertas y atascos de Waze en un área específica.

**Parámetros:**
- `lat_min`: Latitud mínima del área (float)
- `lon_min`: Longitud mínima del área (float)
- `lat_max`: Latitud máxima del área (float)
- `lon_max`: Longitud máxima del área (float)

**Respuesta:**
```json
{
  "disponible": true,
  "alertas": [
    {
      "tipo": "accident",
      "ubicacion": { "x": -74.0721, "y": 4.7110 },
      "descripcion": "Accidente en Carrera 7",
      "severidad": "high",
      "latitud": 4.7110,
      "longitud": -74.0721
    }
  ],
  "atascos": [
    {
      "id": "123",
      "velocidad_actual_kmh": 15,
      "velocidad_limite_kmh": 60,
      "nivel_congestion": "crítico",
      "longitud_km": 2.5,
      "latitud": 4.7110,
      "longitud": -74.0721,
      "tiempo_retraso_min": 12
    }
  ]
}
```

## 🎨 Cambios en el Frontend

### MapaPage.tsx Mejorado

1. **Importaciones adicionales**:
   ```typescript
   import { planificarViajeConWaze, obtenerAlertasWaze } from '../../api/mapa.api';
   ```

2. **Nuevos estados**:
   ```typescript
   const [planViajeWaze, setPlanViajeWaze] = useState<PlanViajeConWaze | null>(null);
   const [alertasWaze, setAlertasWaze] = useState<AlertasAreaWaze | null>(null);
   const [cargandoRuta, setCargandoRuta] = useState(false);
   ```

3. **Función `calcularRuta()` mejorada**:
   - Ahora llama a `planificarViajeConWaze()` en lugar de `obtenerRutaVial()`
   - Obtiene y muestra alertas de Waze
   - Marca atascos críticos en el mapa
   - Muestra recomendaciones basadas en tráfico

4. **Nuevos paneles de información**:
   - Panel de "Información de Tráfico" con recomendaciones
   - Panel de "Atascos en la Ruta" con detalles de congestiones
   - Indicador de carga mientras se calcula

## 🏗️ Estructura de Archivos

### Nuevos archivos:
```
app/
  utils/
    waze_service.py          # Servicio de integración con Waze
  schemas/
    mapa_schema.py          # Schemas para respuestas de Waze
  routes/
    mapa_routes.py          # Nuevos endpoints agregados

frontend/
  src/
    api/
      mapa.api.ts          # Nuevos interfaces y funciones
    features/
      mapa/
        MapaPage.tsx        # Actualizado con Waze
```

### Archivos modificados:
```
app/
  controllers/
    mapa_controller.py      # Nuevos métodos planificar_viaje_con_waze()
  routes/
    mapa_routes.py          # Nuevos endpoints

frontend/
  src/
    api/
      mapa.api.ts          # Nuevos interfaces y funciones
    features/
      mapa/
        MapaPage.tsx        # Lógica mejorada con Waze
```

## 🔐 Seguridad

- **IMPORTANTE**: La API Key de Waze debe estar en variables de entorno (`.env`)
- Nunca usar las keys directamente en el código
- Las llamadas a Waze se hacen desde el backend para mantener seguridad

## 📊 Cómo Funciona

1. **Usuario selecciona una estación**
2. **Sistema obtiene ubicación GPS del usuario**
3. **Backend llama a OSRM para calcular ruta base**
4. **Backend consulta Waze API para alertas y atascos**
5. **Backend calcula:
   - ETA realista considerando tráfico
   - Retrasos estimados
   - Recomendaciones (partir más temprano, rutas alternativas, etc.)
6. **Frontend muestra:**
   - Ruta con color dinámico (verde sin tráfico, rojo con congestión)
   - Marcadores de atascos críticos
   - Recomendaciones de Waze
   - ETA base vs ETA con tráfico

## 🐛 Solución de Problemas

### "Las alertas de Waze no se muestran"
- Verificar que `WAZE_API_KEY` esté configurado en `.env`
- Revisar en logs del backend (`[WAZE]` messages)
- Confirmar que la API Key de RapidAPI sea válida

### "Error conectando con la API de Waze"
- Verificar conexión a internet
- Comprobar que la API Key sea válida
- Revisar límite de llamadas de RapidAPI (plan gratuito tiene límite)

### "ETA muy diferente del tiempo real"
- Waze proporciona datos en tiempo real
- El cálculo considera la geometría de la ruta y congestiones actuales
- Es una estimación, no una predicción exacta

## 🚀 Futuras Mejoras

- [ ] Caché de alertas para reducir llamadas a API
- [ ] Predicción de tráfico a futuro
- [ ] Sugerencia automática de rutas alternativas
- [ ] Integración con Google Maps o Mapbox para más datos
- [ ] Notificaciones push si hay cambios críticos en la ruta

## 📞 Soporte

Para problemas con la integración de Waze:
1. Verificar que la API Key sea válida en RapidAPI
2. Revisar los logs del backend
3. Probar el endpoint `/alertas-waze` directamente en Postman
4. Verificar que el área de búsqueda contenga datos de Waze

## 📚 Referencias

- [RapidAPI - Waze Live Data](https://rapidapi.com/openwebninja-openwebninja-default/api/waze-live-data)
- [OpenStreetMap Routing (OSRM)](http://router.project-osrm.org/)
- [OpenChargeMap API](https://api.openchargemap.io/)
