# EV Charge

Sistema web para la gestión, localización y reserva de estaciones de carga para vehículos eléctricos.

---

# Descripción del proyecto

**EV Charge** es una aplicación web orientada a la movilidad eléctrica que permite a los usuarios localizar estaciones de carga, gestionar vehículos eléctricos, realizar reservas, registrar métodos de pago y participar en la comunidad mediante calificaciones y reportes.

El proyecto surge como una solución para centralizar la información relacionada con la infraestructura de carga eléctrica, facilitando la planificación de recargas y mejorando la experiencia de los conductores de vehículos eléctricos.

Además de proporcionar herramientas para los usuarios finales, el sistema incorpora un panel administrativo que permite supervisar la operación general de la plataforma, gestionar estaciones, monitorear reservas y atender reportes generados por la comunidad.

## Problema que resuelve

Los usuarios de vehículos eléctricos suelen enfrentar dificultades para:

* Encontrar estaciones compatibles con su vehículo.
* Conocer la disponibilidad de los puntos de carga.
* Planificar recorridos considerando necesidades de recarga.
* Gestionar reservas de forma centralizada.
* Reportar incidencias relacionadas con estaciones de carga.

EV Charge busca solucionar estas necesidades mediante una plataforma integrada accesible desde navegador web.

## Objetivo del sistema

Proporcionar una herramienta digital que permita administrar y consultar información relacionada con estaciones de carga eléctrica, optimizando la experiencia de movilidad sostenible mediante funcionalidades de localización, reservas, seguimiento y administración.

---

# Objetivos

## Objetivo general

Desarrollar una plataforma web para la gestión de estaciones de carga de vehículos eléctricos que facilite la localización, reserva y administración de servicios asociados a la movilidad eléctrica.

## Objetivos específicos

* Permitir el registro e inicio de sesión de usuarios.
* Gestionar información de vehículos eléctricos.
* Visualizar estaciones de carga en un mapa interactivo.
* Realizar reservas de estaciones de carga.
* Administrar métodos de pago asociados al usuario.
* Permitir la creación de reportes sobre incidencias.
* Implementar un sistema de calificación de estaciones.
* Gestionar estaciones desde un panel administrativo.
* Centralizar la información del sistema mediante persistencia local.
* Mejorar la experiencia de navegación mediante dashboards especializados por rol.

---

# Tecnologías utilizadas

| Tecnología              | Propósito                                                                 |
| ----------------------- | ------------------------------------------------------------------------- |
| HTML5                   | Estructuración de las interfaces del sistema.                             |
| CSS3                    | Diseño visual, estilos responsivos y componentes gráficos.                |
| JavaScript ES6          | Lógica de negocio, manipulación del DOM y control de funcionalidades.     |
| LocalStorage            | Persistencia local de información sin necesidad de base de datos externa. |
| Leaflet                 | Visualización e interacción con mapas geográficos.                        |
| OpenStreetMap           | Fuente cartográfica utilizada por Leaflet.                                |
| Font Awesome            | Incorporación de iconografía en la interfaz.                              |
| Google Fonts            | Gestión tipográfica del proyecto.                                         |
| Python (Servidor local) | Ejecución local del proyecto para pruebas y despliegue académico.         |

---

# Arquitectura del proyecto

La aplicación está estructurada en módulos funcionales independientes que interactúan mediante almacenamiento local y componentes de interfaz compartidos.

## Landing Page

Módulo de presentación institucional.

Responsabilidades:

* Presentación del proyecto.
* Información de servicios.
* Información del equipo.
* Estadísticas visuales.
* Formulario de contacto.
* Acceso al sistema.

## Mapa Interactivo

Componente principal de localización.

Responsabilidades:

* Mostrar estaciones de carga.
* Consultar información de estaciones.
* Visualizar disponibilidad.
* Calificaciones y reportes.
* Navegación hacia estaciones.

## Dashboard Usuario

Panel destinado a usuarios registrados.

Responsabilidades:

* Gestión de vehículos.
* Gestión de reservas.
* Gestión de pagos.
* Historial de cargas.
* Perfil del usuario.
* Favoritos.
* Calificaciones.

## Dashboard Administrador

Panel de gestión del sistema.

Responsabilidades:

* Administración de usuarios.
* Administración de estaciones.
* Gestión de reportes.
* Supervisión de reservas.
* Estadísticas generales.

## Sistema de Autenticación

Controla:

* Registro de usuarios.
* Inicio de sesión.
* Recuperación de contraseña.
* Persistencia de sesión.
* Asignación de roles.

## Persistencia mediante LocalStorage

Toda la información del sistema se almacena localmente en el navegador mediante LocalStorage.

---

# Estructura del proyecto

```text
EVCHARGEHTML-feture-animacion/
│
├── index.html
├── mapa.html
├── dashboard_usuario.html
├── admin.html
│
├── estilos.css
├── estilos_mapa.css
├── dashboard.css
├── dashboard_usuario.css
├── admin.css
│
├── main.py
├── requirements.txt
├── README.md
│
└── img/
    ├── logo.png
    ├── banner.png
    ├── seccion1.png
    ├── seccion2.png
    ├── seccion3.png
    ├── seccion4.png
    ├── seccion5.png
    └── seccion6.png
```

---

# Roles del sistema

## Usuario

El usuario registrado puede:

* Iniciar sesión.
* Recuperar contraseña.
* Gestionar vehículos.
* Gestionar métodos de pago.
* Realizar reservas.
* Cancelar reservas.
* Consultar estaciones.
* Calificar estaciones.
* Reportar problemas.
* Visualizar historial de cargas.
* Administrar favoritos.
* Consultar estadísticas personales.

## Administrador

El administrador puede:

* Visualizar usuarios registrados.
* Consultar reportes generados.
* Gestionar estaciones.
* Modificar estados de estaciones.
* Consultar reservas globales.
* Cancelar reservas.
* Resolver reportes.
* Supervisar indicadores generales del sistema.

---

# Funcionalidades implementadas

## Registro de usuarios

Permite crear nuevas cuentas dentro del sistema mediante formularios de validación.

### Características

* Registro persistente.
* Validación de duplicados.
* Almacenamiento local.

---

## Inicio de sesión

Sistema de autenticación basado en credenciales almacenadas localmente.

### Características

* Validación de usuario.
* Control de sesión activa.
* Redirección según rol.

---

## Recuperación de contraseña

Permite recuperar el acceso a la cuenta mediante el flujo implementado en la interfaz.

---

## Gestión de vehículos

Los usuarios pueden registrar vehículos eléctricos asociados a su perfil.

### Operaciones

* Crear vehículo.
* Consultar vehículos.
* Actualizar información.
* Eliminar vehículo.

### Datos gestionados

* Marca.
* Modelo.
* Autonomía.
* Tipo de conector.

---

## Gestión de reservas

Permite reservar estaciones de carga.

### Operaciones

* Crear reserva.
* Consultar reservas.
* Cancelar reserva.

### Datos asociados

* Estación.
* Fecha de inicio.
* Fecha de finalización.
* Estado.

---

## Gestión de estaciones

Administración de estaciones disponibles.

### Operaciones

* Crear estación.
* Consultar estaciones.
* Modificar estado.
* Gestionar disponibilidad.

---

## Métodos de pago

Permite registrar métodos de pago asociados al usuario.

### Operaciones

* Registrar método.
* Consultar métodos.
* Eliminar métodos.

---

## Favoritos

Permite almacenar estaciones de interés para acceso rápido.

---

## Calificaciones

Sistema comunitario de valoración de estaciones.

### Funciones

* Registrar calificación.
* Consultar valoraciones.
* Mostrar puntuaciones acumuladas.

---

## Reportes

Permite informar problemas relacionados con estaciones.

### Funciones

* Registrar reporte.
* Consultar estado.
* Resolver incidencias desde administración.

---

## Mapa interactivo

Implementado mediante Leaflet y OpenStreetMap.

### Funciones

* Visualización geográfica.
* Marcadores de estaciones.
* Información contextual.
* Navegación entre ubicaciones.

---

## Dashboard Usuario

Concentra todas las funcionalidades del usuario en una sola interfaz.

### Módulos

* Perfil.
* Vehículos.
* Reservas.
* Pagos.
* Historial.
* Estadísticas.

---

## Dashboard Administrador

Panel de supervisión y control.

### Módulos

* Resumen.
* Usuarios.
* Reportes.
* Estaciones.
* Reservas.

---

## Filtros

El sistema permite filtrar estaciones según compatibilidad y criterios disponibles dentro de la interfaz.

---

## Persistencia

Toda la información se mantiene disponible incluso después de cerrar la página gracias a LocalStorage.

---

## Footer dinámico

El pie de página actualiza información de manera automática según el contexto de navegación del sistema.

---

# Flujo del sistema

```text
Landing Page
      │
      ▼
Inicio de Sesión
      │
      ▼
Validación de Credenciales
      │
      ▼
Validación de Rol
      │
 ┌────┴────┐
 │         │
 ▼         ▼
Usuario   Administrador
 │         │
 ▼         ▼
Dashboard Dashboard
Usuario    Admin
 │         │
 ▼         ▼
Operaciones CRUD
 │
 ▼
Actualización de Datos
 │
 ▼
Persistencia en LocalStorage
```

---

# Persistencia de datos

El sistema utiliza **LocalStorage** como mecanismo principal de almacenamiento.

## Información almacenada

| Entidad             | Persistencia |
| ------------------- | ------------ |
| Usuarios            | Sí           |
| Vehículos           | Sí           |
| Reservas            | Sí           |
| Métodos de pago     | Sí           |
| Reportes            | Sí           |
| Calificaciones      | Sí           |
| Favoritos           | Sí           |
| Estaciones          | Sí           |
| Historial de cargas | Sí           |
| Sesión activa       | Sí           |

## Ventajas

* No requiere servidor de base de datos.
* Persistencia entre sesiones.
* Fácil despliegue académico.
* Menor complejidad de infraestructura.

---

# Validaciones implementadas

## Gestión de usuarios

* No permite registrar usuarios duplicados.
* Validación de credenciales de acceso.
* Persistencia de sesión.

## Gestión de vehículos

* Prevención de registros duplicados.
* Asociación automática con usuario propietario.

## Métodos de pago

* Prevención de duplicados.
* Asociación automática con el usuario autenticado.

## Reservas

* Asociación automática entre usuario y reserva.
* Asociación automática entre reserva y estación.

## Reportes

* Asociación automática entre usuario y reporte.
* Seguimiento desde panel administrativo.

## Calificaciones

* Asociación automática entre usuario y estación.

## Roles

* Cambio automático de interfaz según rol.
* Redirección a dashboard correspondiente.

## Interfaz

* Actualización dinámica de componentes.
* Actualización automática del footer.
* Persistencia de estado visual.

---

# Navegación del sistema

## Landing Page

Punto inicial de acceso al sistema.

Contiene:

* Inicio.
* Servicios.
* Quiénes somos.
* Estadísticas.
* Contacto.
* Acceso al mapa.
* Registro.
* Inicio de sesión.

---

## Mapa

Centro operativo principal de consulta.

Permite:

* Localizar estaciones.
* Consultar disponibilidad.
* Acceder a funcionalidades relacionadas.

---

## Dashboard Usuario

Área privada para gestión personal.

Incluye:

* Vehículos.
* Reservas.
* Historial.
* Pagos.
* Perfil.

---

## Dashboard Administrador

Área privada para administración global.

Incluye:

* Usuarios.
* Reportes.
* Estaciones.
* Reservas.
* Resumen estadístico.

---

## Sidebar

Menú lateral encargado de:

* Navegación interna.
* Cambio de módulos.
* Acceso rápido a funcionalidades.

---

## Topbar

Barra superior encargada de:

* Identificación del usuario.
* Navegación principal.
* Control de sesión.

---

## Footer

Componente global de información institucional y navegación complementaria.

---

# Instalación

## Requisitos previos

* Navegador web moderno.
* Python instalado.

## Pasos de ejecución

### 1. Clonar o descargar el proyecto

```bash
git clone <repositorio>
```

o descargar el archivo comprimido.

### 2. Ingresar al directorio

```bash
cd EVCHARGEHTML-feture-animacion
```

### 3. Ejecutar el servidor local

```bash
python main.py
```

### 4. Abrir en el navegador

```text
http://127.0.0.1:8000
```

---

# Credenciales de prueba

## Administrador

| Campo      | Valor                                           |
| ---------- | ----------------------------------------------- |
| Correo     | [terpel@evcharge.co](mailto:terpel@evcharge.co) |
| Contraseña | 123456                                          |

---

# Equipo de desarrollo

Proyecto desarrollado por:

* Kevyn Andrés Roa
* Julián Cruz
* Juan Campos
* Stiven Beltrán
* Jhon Muñoz

## Programa de formación

**Análisis y Desarrollo de Software (ADSO)**

## Institución

**Servicio Nacional de Aprendizaje (SENA)**

---

# Licencia

Proyecto académico desarrollado con fines educativos.

Su propósito es apoyar procesos de aprendizaje, análisis, diseño e implementación de soluciones de software dentro del programa ADSO del SENA.

---

## Resumen ejecutivo

EV Charge integra funcionalidades de geolocalización, gestión de estaciones de carga, reservas, pagos, reportes y administración de usuarios en una plataforma web enfocada en movilidad eléctrica. La solución utiliza tecnologías web estándar y almacenamiento mediante LocalStorage, permitiendo un despliegue sencillo para entornos académicos y demostrativos sin dependencia de infraestructura externa.
