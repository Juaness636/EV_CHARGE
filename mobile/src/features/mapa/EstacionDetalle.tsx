// Detalle de una estación: estado, conectores, calificaciones, incidencias, reserva con
// cotización y pago, favoritos, calificar y reportar. Equivale a EstacionDetalle.tsx del web.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Presionable } from '../../components/ui/Presionable';
import type { Usuario } from '../../api/auth.api';
import { obtenerEstadoEstacion, type EstadoEstacion } from '../../api/estado.api';
import { listarFavoritos, agregarFavorito, quitarFavorito } from '../../api/favoritos.api';
import { calificar, calificacionesDeEstacion, type ResumenCalificaciones } from '../../api/calificaciones.api';
import { crearReporte, reportesDeEstacion, type Reporte } from '../../api/reportes.api';
import { crearReservaConfirmada, MINUTOS_TOLERANCIA_LLEGADA, type ReservaCreate } from '../../api/reservas.api';
import { cambiarEstadoEstacionOcm } from '../../api/admin.api';
import { listarMetodosPago, type MetodoPago } from '../../api/metodosPago.api';
import { cotizarReserva } from '../../api/tarifas.api';
import { mensajeError } from '../../api/httpClient';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import type { Palette } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/spacing';
import { contieneLenguajeOfensivo, mensajeContenidoOfensivo } from '../../utils/contentFilter';
import { emitir, escuchar } from '../../utils/eventos';
import { conectorCoincide, etiquetaEstado } from '../../utils/estaciones';
import { fechaCorta, fechaHora, enUnosMinutos, pesos, proximaHora, sumarHoras } from '../../utils/formato';
import { ModalPago } from '../../components/ModalPago';
import { GaleriaFotos } from './GaleriaFotos';
import { notificar } from '../../components/Notificaciones';
import { Boton, CampoSelect, CampoTexto, Estrellas, Icono, Insignia, SelectorDuracion, SelectorFechaHora, tonoEstado } from '../../components/ui';
import type { EstacionOCM } from './types';

interface Props {
  estacion: EstacionOCM;
  usuario: Usuario | null;
  onLoginRequerido: () => void;
  onRegistroRequerido: () => void;
  onCalcularRuta: (lat: number, lon: number) => void;
  filtroConector?: string;
  tipoConectorVehiculo?: string;
  tieneVehiculo?: boolean;
  onRegistrarVehiculo?: () => void;
}

const TIPOS_REPORTE = [
  { valor: 'averia', etiqueta: 'Avería', icono: 'screwdriver-wrench' },
  { valor: 'fuera_servicio', etiqueta: 'Fuera de servicio', icono: 'circle-xmark' },
  { valor: 'ocupado', etiqueta: 'Ocupado', icono: 'clock' },
  { valor: 'otro', etiqueta: 'Otro', icono: 'circle-question' },
];

type EstadoAdmin = 'activa' | 'mantenimiento' | 'inactiva';
const SEGUNDOS_REFRESCO_DETALLE = 10;

export function EstacionDetalle({
  estacion, usuario, onLoginRequerido, onRegistroRequerido, onCalcularRuta,
  filtroConector = 'TODOS', tipoConectorVehiculo = '', tieneVehiculo = true, onRegistrarVehiculo,
}: Props) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const ocmId = String(estacion.ID);
  const nombre = estacion.AddressInfo?.Title || 'Estación';
  const ciudad = estacion.ciudad || estacion.City || estacion.AddressInfo?.Town || '';
  const direccion = estacion.AddressInfo?.AddressLine1 || '—';
  const operador = estacion.OperatorInfo?.Title || 'Independiente';
  const lat = estacion.AddressInfo?.Latitude;
  const lon = estacion.AddressInfo?.Longitude;
  const conexiones = estacion.Connections || [];

  const esCompatible = useCallback((tipo: string) => {
    const porFiltro = filtroConector === 'TODOS' || tipo.toLowerCase().includes(filtroConector.toLowerCase());
    const porVehiculo = !tipoConectorVehiculo || conectorCoincide(tipo, tipoConectorVehiculo);
    return porFiltro && porVehiculo;
  }, [filtroConector, tipoConectorVehiculo]);

  const [estado, setEstado] = useState<EstadoEstacion | null>(null);
  const [estadoAdmin, setEstadoAdmin] = useState<EstadoAdmin>('activa');
  const [esFavorito, setEsFavorito] = useState(false);

  const [duracion, setDuracion] = useState(2);
  const [inicio, setInicio] = useState<Date>(proximaHora());
  const [reservando, setReservando] = useState(false);
  const [pagoReserva, setPagoReserva] = useState<{ id: string; monto: number } | null>(null);
  const [reservaPendiente, setReservaPendiente] = useState<ReservaCreate | null>(null);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [cargadorSeleccionado, setCargadorSeleccionado] = useState<string | null>(null);
  const [precioEstimado, setPrecioEstimado] = useState<number | null>(null);
  const [cargandoPrecio, setCargandoPrecio] = useState(false);

  const [mostrarCalificar, setMostrarCalificar] = useState(false);
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [resumen, setResumen] = useState<ResumenCalificaciones | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  const [mostrarReporte, setMostrarReporte] = useState(false);
  const [tipoReporte, setTipoReporte] = useState('');
  const [descReporte, setDescReporte] = useState('');
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [reportes, setReportes] = useState<Reporte[]>([]);

  const fin = sumarHoras(inicio, duracion);
  const reservados = estado?.cargadores_reservados || [];
  const enUso = estado?.cargadores_en_uso || [];
  const compatibles = conexiones.map((c, i) => ({ c, id: `${ocmId}-${i + 1}` })).filter(({ c }) => esCompatible(c.ConnectionType?.Title || ''));
  const hayDisponible = compatibles.some(({ id }) => !reservados.includes(id));
  const estadoPanel = estado?.estado === 'mantenimiento' || estado?.estado === 'inactiva'
    ? String(estado.estado)
    : compatibles.length > 0 && !hayDisponible ? 'reservada' : 'disponible';

  const refrescarEstado = useCallback(async () => {
    try {
      const actualizado = await obtenerEstadoEstacion(ocmId);
      setEstado(actualizado);
      setEstadoAdmin(actualizado.estado === 'mantenimiento' || actualizado.estado === 'inactiva' ? actualizado.estado : 'activa');
      return actualizado;
    } catch {
      return null;
    }
  }, [ocmId]);

  useEffect(() => {
    let cancelado = false;
    setEstado(null);
    setMostrarCalificar(false); setMostrarReporte(false);
    setPuntaje(0); setComentario(''); setResumen(null); setVerTodas(false);
    setTipoReporte(''); setDescReporte(''); setReportes([]);
    setInicio(proximaHora()); setDuracion(2);
    setPagoReserva(null); setReservaPendiente(null); setCargadorSeleccionado(null); setPrecioEstimado(null);

    void refrescarEstado();
    calificacionesDeEstacion(ocmId)
      .then((d) => !cancelado && setResumen(d))
      .catch(() => !cancelado && setResumen({ promedio: 0, total: 0, calificaciones: [] }));
    reportesDeEstacion(ocmId).then((d) => !cancelado && setReportes(d)).catch(() => !cancelado && setReportes([]));
    if (usuario) {
      listarFavoritos().then((f) => !cancelado && setEsFavorito(f.some((x) => x.estacion_ocm_id === ocmId))).catch(() => undefined);
      listarMetodosPago().then((m) => !cancelado && setMetodosPago(m)).catch(() => undefined);
    }
    return () => { cancelado = true; };
  }, [ocmId, usuario, refrescarEstado]);

  useEffect(() => escuchar('estaciones-actualizadas', () => void refrescarEstado()), [refrescarEstado]);

  // Mientras el detalle está abierto se ve en vivo cuando otro usuario reserva o empieza a cargar.
  useEffect(() => {
    const intervalo = setInterval(() => void refrescarEstado(), SEGUNDOS_REFRESCO_DETALLE * 1000);
    return () => clearInterval(intervalo);
  }, [refrescarEstado]);

  // Cotización en vivo del cargador seleccionado (POST /reservas/cotizar).
  useEffect(() => {
    if (!cargadorSeleccionado) return setPrecioEstimado(null);
    const cargador = conexiones[Number(cargadorSeleccionado.split('-').pop()) - 1];
    let cancelado = false;
    setCargandoPrecio(true);
    cotizarReserva({ estacion_ocm_id: ocmId, cargador_id: cargadorSeleccionado, estacion_nombre: nombre, operador, tipo_cargador: cargador?.ConnectionType?.Title || '', potencia_kw: cargador?.PowerKW, duracion_horas: duracion })
      .then((c) => !cancelado && setPrecioEstimado(c.total))
      .catch(() => !cancelado && setPrecioEstimado(null))
      .finally(() => !cancelado && setCargandoPrecio(false));
    return () => { cancelado = true; };
  }, [cargadorSeleccionado, duracion, nombre, operador, ocmId]);

  const encabezado = (
    <View style={{ gap: 8 }}>
      <Text style={s.nombre}>{nombre}</Text>
      <View style={s.filaIcono}>
        <Icono name="location-dot" size={13} color={colors.primary} />
        <Text style={[s.texto, { flex: 1 }]}>{direccion}{ciudad ? ` · ${ciudad}` : ''}</Text>
      </View>
      <View style={s.filaIcono}>
        <Icono name="building" size={12} color={colors.textDim} />
        <Text style={s.textoDim}>Operador: {operador}</Text>
      </View>
      {estacion.Empresa && estacion.Empresa.nombre !== operador && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: estacion.Empresa.color_hex }} />
          <Text style={s.textoDim}>{estacion.Empresa.nombre}</Text>
        </View>
      )}
      {/* Visibles también sin sesión: son la cara pública de la estación. */}
      <GaleriaFotos fotos={estacion.Fotos || []} nombre={nombre} />
    </View>
  );

  if (!usuario) {
    return (
      <View style={{ gap: 12 }}>
        {encabezado}
        <View style={s.bloqueo}>
          <Icono name="lock" size={16} color={colors.textDim} />
          <Text style={[s.texto, { flex: 1 }]}>Inicia sesión para ver disponibilidad, reservar, calificar y reportar.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Boton titulo="Iniciar sesión" variante="outline" onPress={onLoginRequerido} style={{ flex: 1 }} />
          <Boton titulo="Registrarse" onPress={onRegistroRequerido} style={{ flex: 1 }} />
        </View>
        {lat != null && lon != null && <Boton titulo="Cómo llegar" icono="route" variante="soft" onPress={() => onCalcularRuta(lat, lon)} />}
      </View>
    );
  }

  const toggleFavorito = async () => {
    try {
      if (esFavorito) await quitarFavorito(ocmId);
      else await agregarFavorito({ estacion_ocm_id: ocmId, estacion_nombre: nombre });
      setEsFavorito(!esFavorito);
      notificar({ tipo: 'success', titulo: 'Favoritos', mensaje: esFavorito ? 'Estación quitada de favoritos.' : 'Estación guardada en favoritos.' });
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Favoritos', mensaje: mensajeError(e, 'Error al actualizar favorito') });
    }
  };

  const enviarCalificacion = async () => {
    if (!puntaje) return notificar({ tipo: 'warning', titulo: 'Calificación', mensaje: 'Selecciona una calificación de 1 a 5.' });
    if (contieneLenguajeOfensivo(comentario)) return notificar({ tipo: 'warning', titulo: 'Contenido no permitido', mensaje: mensajeContenidoOfensivo });
    try {
      await calificar({ estacion_ocm_id: ocmId, estacion_nombre: nombre, puntaje, comentario });
      notificar({ tipo: 'success', titulo: 'Calificación enviada', mensaje: 'Tu opinión fue registrada correctamente.' });
      setMostrarCalificar(false);
      setPuntaje(0);
      setComentario('');
      setResumen(await calificacionesDeEstacion(ocmId));
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Calificación', mensaje: mensajeError(e, 'Error al enviar calificación') });
    }
  };

  const enviarReporte = async () => {
    if (!tipoReporte) return notificar({ tipo: 'warning', titulo: 'Reporte', mensaje: 'Selecciona el tipo de problema.' });
    if (contieneLenguajeOfensivo(descReporte)) return notificar({ tipo: 'warning', titulo: 'Contenido no permitido', mensaje: mensajeContenidoOfensivo });
    setEnviandoReporte(true);
    try {
      await crearReporte({ estacion_ocm_id: ocmId, estacion_nombre: nombre, tipo: tipoReporte, descripcion: descReporte });
      notificar({ tipo: 'success', titulo: 'Reporte enviado', mensaje: 'Gracias por ayudarnos a mantener actualizada la estación.' });
      setMostrarReporte(false);
      setTipoReporte('');
      setDescReporte('');
      setReportes(await reportesDeEstacion(ocmId).catch(() => reportes));
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Reporte', mensaje: mensajeError(e, 'Error al enviar reporte') });
    } finally {
      setEnviandoReporte(false);
    }
  };

  const cambiarEstadoAdmin = async (nuevo: EstadoAdmin) => {
    try {
      await cambiarEstadoEstacionOcm(ocmId, nuevo);
      setEstadoAdmin(nuevo);
      setEstado({ ...(estado || {}), estacion_ocm_id: ocmId, estado: nuevo });
      emitir('estaciones-actualizadas');
      notificar({ tipo: 'success', titulo: 'Estación actualizada', mensaje: 'El estado se actualizó correctamente.' });
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Estación', mensaje: mensajeError(e, 'No se pudo actualizar el estado de la estación') });
    }
  };

  const confirmarReserva = async () => {
    if (!cargadorSeleccionado) return notificar({ tipo: 'warning', titulo: 'Reserva', mensaje: 'Selecciona un cargador disponible antes de continuar.' });
    if (inicio < new Date()) return notificar({ tipo: 'warning', titulo: 'Reserva', mensaje: 'No se puede reservar en el pasado. Elige una fecha futura.' });
    setReservando(true);
    try {
      const actual = await refrescarEstado();
      if (actual?.estado === 'mantenimiento' || actual?.estado === 'inactiva') {
        return notificar({ tipo: 'warning', titulo: 'Reserva', mensaje: 'La estación dejó de estar disponible para reservar.' });
      }
      if (actual?.cargadores_reservados?.includes(cargadorSeleccionado)) {
        setCargadorSeleccionado(null);
        return notificar({ tipo: 'warning', titulo: 'Cargador no disponible', mensaje: 'Este cargador acaba de ser reservado. Selecciona otro.' });
      }
      const cargador = conexiones[Number(cargadorSeleccionado.split('-').pop()) - 1];
      const cotizacion = await cotizarReserva({ estacion_ocm_id: ocmId, cargador_id: cargadorSeleccionado, estacion_nombre: nombre, operador, tipo_cargador: cargador?.ConnectionType?.Title || '', potencia_kw: cargador?.PowerKW, duracion_horas: duracion });
      setReservaPendiente({
        estacion_ocm_id: ocmId,
        cargador_id: cargadorSeleccionado,
        estacion_nombre: nombre,
        fecha_hora_inicio: inicio.toISOString(),
        fecha_hora_fin: fin.toISOString(),
      });
      setPagoReserva({ id: `RESERVA-${Date.now()}`, monto: cotizacion.total });
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Reserva', mensaje: mensajeError(e, 'Error al reservar') });
    } finally {
      setReservando(false);
    }
  };

  const alPagar = async ({ transaccion_id }: { transaccion_id: string }) => {
    if (!reservaPendiente) return;
    try {
      const confirmada = await crearReservaConfirmada({ ...reservaPendiente, transaccion_id });
      const ids = new Set(estado?.cargadores_reservados || []);
      if (confirmada.cargador_id) ids.add(confirmada.cargador_id);
      setEstado((a) => ({ ...(a || {}), estacion_ocm_id: ocmId, estado: 'disponible', cargadores_reservados: [...ids] }));
      setCargadorSeleccionado(null);
      emitir('estaciones-actualizadas', { estacionId: ocmId, cargadorId: confirmada.cargador_id || reservaPendiente.cargador_id });
      notificar({ tipo: 'success', titulo: 'Reserva confirmada', mensaje: 'Pago aprobado y reserva aceptada. Al llegar, escanea el QR del cargador desde Mis reservas.' });
    } catch (e) {
      await refrescarEstado();
      notificar({ tipo: 'error', titulo: 'Reserva', mensaje: mensajeError(e, 'El pago fue aprobado, pero no se pudo crear la reserva.') });
    } finally {
      setReservaPendiente(null);
    }
  };

  const insigniaEstado = estado === null
    ? <Insignia texto="Consultando..." />
    : estadoPanel === 'reservada'
      ? <Insignia texto="Hay cargadores reservados" tono="azul" icono="clock" />
      : <Insignia texto={etiquetaEstado(estadoPanel)} tono={tonoEstado(estadoPanel)} icono={estadoPanel === 'disponible' ? 'circle-check' : estadoPanel === 'mantenimiento' ? 'screwdriver-wrench' : 'ban'} />;

  // Las cuentas de administrador y de empresa ven la estación, pero no reservan ni califican.
  const esCliente = !usuario.is_admin && usuario.rol !== 'empresa';

  const calificacionesVisibles = resumen ? (verTodas ? resumen.calificaciones : resumen.calificaciones.slice(0, 2)) : [];

  return (
    <View style={{ gap: 18 }}>
      {encabezado}
      <View style={s.filaEstado}>
        {insigniaEstado}
        {resumen && resumen.total > 0 && (
          <View style={s.notaPromedio}>
            <Icono name="star" size={12} color="#f5b301" />
            <Text style={s.notaTexto}>{resumen.promedio.toFixed(1)}</Text>
            <Text style={s.textoDim}>({resumen.total})</Text>
          </View>
        )}
      </View>

      {usuario.is_admin && (
        <CampoSelect
          etiqueta="Estado administrativo"
          valor={estadoAdmin}
          onChange={(v) => void cambiarEstadoAdmin(v as EstadoAdmin)}
          opciones={[{ valor: 'activa', etiqueta: 'Activa' }, { valor: 'mantenimiento', etiqueta: 'En mantenimiento' }, { valor: 'inactiva', etiqueta: 'Fuera de servicio' }]}
        />
      )}

      {esCliente && !tieneVehiculo && (
        <View style={[s.aviso, { borderColor: colors.warning }]}>
          <Icono name="car" size={16} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={[s.subtitulo, { color: colors.warning }]}>Registra un vehículo</Text>
            <Text style={s.textoDim}>Así podremos mostrar compatibilidad y calcular mejor tus reservas.</Text>
          </View>
          {onRegistrarVehiculo && <Boton titulo="Registrar" pequeno variante="outline" onPress={onRegistrarVehiculo} />}
        </View>
      )}

      {esCliente && (
        <View style={s.accionesGrid}>
          <AccionEstacion icono="heart" titulo={esFavorito ? 'Guardada' : 'Favorito'} color="#ff5c8a" activa={esFavorito} onPress={toggleFavorito} />
          {lat != null && lon != null && <AccionEstacion icono="route" titulo="Cómo llegar" color="#3ea6ff" onPress={() => onCalcularRuta(lat, lon)} />}
          <AccionEstacion icono="star" titulo="Calificar" color="#f5b301" activa={mostrarCalificar} onPress={() => { setMostrarCalificar((v) => !v); setMostrarReporte(false); }} />
          <AccionEstacion icono="bullhorn" titulo="Reportar" color="#ff6b4a" activa={mostrarReporte} onPress={() => { setMostrarReporte((v) => !v); setMostrarCalificar(false); }} />
        </View>
      )}

      {mostrarCalificar && (
        <View style={[s.caja, s.cajaDestacada, { borderColor: 'rgba(245,179,1,0.45)' }]}>
          <Text style={[s.subtitulo, { textAlign: 'center' }]}>¿Cómo fue tu experiencia?</Text>
          <View style={{ alignItems: 'center' }}><Estrellas valor={puntaje} tamano={36} onChange={setPuntaje} /></View>
          <Text style={[s.textoDim, { textAlign: 'center' }]}>{['Toca una estrella', 'Muy mala', 'Mala', 'Regular', 'Buena', '¡Excelente!'][puntaje]}</Text>
          <CampoTexto value={comentario} onChangeText={setComentario} placeholder="Cuéntales a otros conductores (opcional)" multiline />
          <Boton titulo="Enviar calificación" icono="paper-plane" iconoDerecha onPress={enviarCalificacion} disabled={!puntaje} bloque />
        </View>
      )}

      {mostrarReporte && (
        <View style={[s.caja, s.cajaDestacada, { borderColor: 'rgba(255,107,74,0.45)' }]}>
          <Text style={s.subtitulo}>¿Qué problema encontraste?</Text>
          <View style={s.acciones}>
            {TIPOS_REPORTE.map((t) => (
              <Boton key={t.valor} titulo={t.etiqueta} icono={t.icono} pequeno variante={tipoReporte === t.valor ? 'primary' : 'outline'} onPress={() => setTipoReporte(t.valor)} />
            ))}
          </View>
          <CampoTexto value={descReporte} onChangeText={setDescReporte} placeholder="Descripción" multiline />
          <Boton titulo={enviandoReporte ? 'Enviando...' : 'Enviar reporte'} icono="paper-plane" iconoDerecha cargando={enviandoReporte} onPress={enviarReporte} bloque />
        </View>
      )}

      {esCliente && estadoPanel === 'disponible' ? (
        <Paso numero={1} titulo="Elige un cargador" sub="Toca el que quieras reservar" />
      ) : (
        <Text style={s.seccion}>Conectores</Text>
      )}
      {conexiones.length === 0 && <Text style={s.textoDim}>Esta estación no reporta conectores.</Text>}
      {conexiones.map((c, i) => {
        const cargadorId = `${ocmId}-${i + 1}`;
        const tipo = c.ConnectionType?.Title || 'Genérico';
        const compatible = esCompatible(c.ConnectionType?.Title || '');
        const reservado = reservados.includes(cargadorId);
        const usando = enUso.includes(cargadorId);
        const reservaDe = estado?.reservas_por_cargador?.find((r) => r.cargador_id === cargadorId);
        const fueraDeServicio = c.Estado === 'fuera_servicio';
        const bloqueado = reservado || fueraDeServicio || estadoAdmin !== 'activa';
        const seleccionado = cargadorSeleccionado === cargadorId;
        const recomendado = compatible && !bloqueado && !!tipoConectorVehiculo;
        const etiqueta = usando ? 'En uso' : reservado ? 'Reservado' : estadoAdmin === 'mantenimiento' ? 'Mantenimiento' : estadoAdmin === 'inactiva' || fueraDeServicio ? 'Fuera de servicio' : 'Disponible';
        return (
          <Presionable
            key={cargadorId}
            disabled={!esCliente || bloqueado || !compatible}
            onPress={() => setCargadorSeleccionado(seleccionado ? null : cargadorId)}
            escalaPresion={0.98}
            accessibilityRole="radio"
            accessibilityState={{ checked: seleccionado, disabled: !esCliente || bloqueado || !compatible }}
            accessibilityLabel={`${tipo}, ${etiqueta}`}
            style={[s.conector, seleccionado && { borderColor: colors.primary, backgroundColor: colors.primarySoft }, !compatible && { opacity: 0.6 }]}
          >
            <View style={s.conectorFila}>
              <View style={[s.conectorIcono, { backgroundColor: bloqueado ? colors.errorSoft : colors.primarySoft }]}>
                <Icono name="plug" size={16} color={bloqueado ? colors.error : colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.subtitulo} numberOfLines={1}>{tipo}</Text>
                <Text style={s.textoDim}>{c.CurrentType?.Title || 'AC/DC'} · Bahías: {c.Quantity || 1}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.potencia}>{c.PowerKW ? `${c.PowerKW}` : '—'}</Text>
                <Text style={s.textoDim}>kW</Text>
              </View>
              {esCliente && (
                <View style={[s.radio, seleccionado && { borderColor: colors.primary }]}>
                  {seleccionado && <View style={s.radioPunto} />}
                </View>
              )}
            </View>
            <View style={s.filaEntre}>
              <Insignia texto={etiqueta} tono={usando ? 'amarillo' : reservado ? 'azul' : bloqueado ? 'rojo' : 'verde'} icono={usando ? 'bolt' : undefined} />
              {recomendado ? <Insignia texto="Para tu vehículo" tono="verde" icono="check" /> : !compatible ? <Text style={s.textoDim}>No compatible</Text> : <Text style={s.textoDim}>ID {cargadorId}</Text>}
            </View>
            {reservado && reservaDe && <Text style={s.textoDim}><Icono name="user" size={11} color={colors.textDim} />  {usando ? 'Cargando ahora' : 'Reservado'} · {reservaDe.reservado_por}</Text>}
          </Presionable>
        );
      })}

      {estadoPanel === 'disponible' && esCliente && (
        <View style={{ gap: 14 }}>
          <Paso numero={2} titulo="¿Cuándo y cuánto tiempo?" />
          <SelectorDuracion valor={duracion} onChange={setDuracion} />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><SelectorFechaHora valor={inicio} onChange={setInicio} /></View>
            <Boton titulo="Ahora" variante="outline" pequeno onPress={() => setInicio(enUnosMinutos())} style={{ marginBottom: 12 }} />
          </View>
          <Paso numero={3} titulo="Confirma y paga" />
          <View style={[s.precio, { borderColor: colors.primaryBorder }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.textoDim}>Costo estimado</Text>
              <Text style={s.precioValor}>{cargandoPrecio ? 'Calculando…' : precioEstimado != null ? pesos(precioEstimado) : '—'}</Text>
              <Text style={s.textoDim}>Termina: {fechaHora(fin)}</Text>
            </View>
            <Icono name="receipt" size={22} color={colors.primary} />
          </View>
          <View style={s.filaIcono}>
            <Icono name="qrcode" size={13} color={colors.textDim} />
            <Text style={[s.textoDim, { flex: 1 }]}>
              Al llegar, escanea el QR del cargador desde Mis reservas. Si no lo haces dentro de los {MINUTOS_TOLERANCIA_LLEGADA} minutos siguientes a la hora elegida, la reserva se cancela sin reembolso.
            </Text>
          </View>
          <Boton titulo={reservando ? 'Procesando...' : cargadorSeleccionado ? 'Reservar y pagar' : 'Elige un cargador arriba'} icono="calendar-check" cargando={reservando} disabled={!cargadorSeleccionado} onPress={confirmarReserva} bloque />
        </View>
      )}

      <View style={s.caja}>
        <View style={s.filaEntre}>
          <Text style={s.subtitulo}>Calificaciones de usuarios</Text>
          {resumen && <Text style={s.textoDim}>{resumen.promedio.toFixed(1)}/5 ({resumen.total})</Text>}
        </View>
        {!resumen ? <Text style={s.textoDim}>Consultando calificaciones...</Text>
          : resumen.calificaciones.length === 0 ? <Text style={s.textoDim}>Aún no hay calificaciones para esta estación.</Text>
            : calificacionesVisibles.map((c) => (
              <View key={c.id} style={s.item}>
                <View style={s.filaEntre}>
                  <Text style={[s.texto, { fontWeight: '800' }]}>{c.usuario_nombre}</Text>
                  <Text style={s.textoDim}>{fechaCorta(c.fecha)}</Text>
                </View>
                <Estrellas valor={c.puntaje} tamano={12} />
                {c.comentario ? <Text style={s.texto}>{c.comentario}</Text> : null}
              </View>
            ))}
        {resumen && resumen.calificaciones.length > 2 && (
          <Pressable onPress={() => setVerTodas((v) => !v)}>
            <Text style={{ color: colors.primary, fontWeight: '800' }}>{verTodas ? 'Ver menos' : 'Ver más calificaciones'}</Text>
          </Pressable>
        )}
      </View>

      <View style={s.caja}>
        <View style={s.filaEntre}>
          <Text style={s.subtitulo}>Incidencias reportadas</Text>
          <Text style={s.textoDim}>{reportes.length}</Text>
        </View>
        {reportes.length === 0 ? <Text style={s.textoDim}>No hay incidencias reportadas.</Text> : reportes.slice(0, 5).map((r) => (
          <View key={r.id} style={s.item}>
            <View style={s.filaEntre}>
              <Text style={[s.texto, { fontWeight: '800', textTransform: 'capitalize' }]}>{r.tipo.replace('_', ' ')}</Text>
              <Insignia texto={etiquetaEstado(r.estado || 'abierto')} tono={tonoEstado(r.estado || 'abierto')} />
            </View>
            <Text style={s.texto}>{r.descripcion || 'Sin descripción'}</Text>
          </View>
        ))}
      </View>

      <Text style={[s.textoDim, { textAlign: 'center', fontSize: 11 }]}>OCM ID: {ocmId}</Text>

      <ModalPago
        visible={!!pagoReserva}
        tipo="reserva"
        tituloItem={nombre}
        monto={pagoReserva?.monto ?? 0}
        idReferencia={pagoReserva?.id}
        reserva={reservaPendiente ?? undefined}
        metodosGuardados={metodosPago}
        onCerrar={() => { setPagoReserva(null); setReservaPendiente(null); }}
        onExito={alPagar}
      />
    </View>
  );
}

// Botón grande de acción (icono en círculo de color + texto): fácil de tocar en el celular.
function AccionEstacion({ icono, titulo, color, activa = false, onPress }: { icono: string; titulo: string; color: string; activa?: boolean; onPress: () => void }) {
  const s = useThemedStyles(crearEstilos);
  return (
    <Presionable
      onPress={onPress}
      elevarAlPasar
      accessibilityRole="button"
      accessibilityState={{ selected: activa }}
      accessibilityLabel={titulo}
      style={[s.accion, activa && { borderColor: color, backgroundColor: `${color}1f` }]}
    >
      <View style={[s.accionIcono, { backgroundColor: activa ? color : `${color}26` }]}>
        <Icono name={icono} size={17} color={activa ? '#fff' : color} />
      </View>
      <Text style={s.accionTexto} numberOfLines={1}>{titulo}</Text>
    </Presionable>
  );
}

// Encabezado numerado de cada paso de la reserva.
function Paso({ numero, titulo, sub }: { numero: number; titulo: string; sub?: string }) {
  const s = useThemedStyles(crearEstilos);
  return (
    <View style={s.paso}>
      <View style={s.pasoNumero}><Text style={s.pasoNumeroTexto}>{numero}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.subtitulo}>{titulo}</Text>
        {sub && <Text style={s.textoDim}>{sub}</Text>}
      </View>
    </View>
  );
}

const crearEstilos = (c: Palette) => StyleSheet.create({
  filaIcono: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaEstado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  notaPromedio: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: 'rgba(245,179,1,0.14)' },
  notaTexto: { color: c.text, fontWeight: '900', fontSize: 13 },
  accionesGrid: { flexDirection: 'row', gap: 10 },
  accion: { flex: 1, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardElevated },
  accionIcono: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  accionTexto: { color: c.text, fontSize: 12, fontWeight: '800' },
  cajaDestacada: { padding: Spacing.lg, gap: 14 },
  paso: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  pasoNumero: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  pasoNumeroTexto: { color: '#fff', fontWeight: '900', fontSize: 13 },
  conectorFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  conectorIcono: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  potencia: { color: c.text, fontSize: 20, fontWeight: '900', lineHeight: 22 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioPunto: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.primary },
  precioValor: { color: c.text, fontSize: 22, fontWeight: '900' },
  nombre: { color: c.text, fontSize: 22, fontWeight: '900', lineHeight: 28 },
  texto: { color: c.textMuted, fontSize: 13.5, lineHeight: 19 },
  textoDim: { color: c.textDim, fontSize: 12.5, lineHeight: 18 },
  subtitulo: { color: c.text, fontSize: 14.5, fontWeight: '800' },
  seccion: { color: c.textDim, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  bloqueo: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: Radius.md, backgroundColor: c.cardElevated },
  aviso: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: Radius.md, borderWidth: 1, backgroundColor: c.warningSoft },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  caja: { gap: 12, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardElevated },
  conector: { gap: 12, padding: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardElevated },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  precio: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: Radius.lg, borderWidth: 1, backgroundColor: c.primarySoft },
  item: { gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border },
});
