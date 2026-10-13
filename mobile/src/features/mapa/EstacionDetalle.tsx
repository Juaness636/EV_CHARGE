// Detalle de una estación: estado, conectores, calificaciones, incidencias, reserva con
// cotización y pago, favoritos, calificar y reportar. Equivale a EstacionDetalle.tsx del web.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Usuario } from '../../api/auth.api';
import { obtenerEstadoEstacion, type EstadoEstacion } from '../../api/estado.api';
import { listarFavoritos, agregarFavorito, quitarFavorito } from '../../api/favoritos.api';
import { calificar, calificacionesDeEstacion, type ResumenCalificaciones } from '../../api/calificaciones.api';
import { crearReporte, reportesDeEstacion, type Reporte } from '../../api/reportes.api';
import { crearReservaConfirmada, type ReservaCreate } from '../../api/reservas.api';
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
import { fechaCorta, fechaHora, pesos, proximaHora, sumarHoras } from '../../utils/formato';
import { ModalPago } from '../../components/ModalPago';
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

  // Cotización en vivo del cargador seleccionado (POST /reservas/cotizar).
  useEffect(() => {
    if (!cargadorSeleccionado) return setPrecioEstimado(null);
    const cargador = conexiones[Number(cargadorSeleccionado.split('-').pop()) - 1];
    let cancelado = false;
    setCargandoPrecio(true);
    cotizarReserva({ estacion_nombre: nombre, operador, tipo_cargador: cargador?.ConnectionType?.Title || '', potencia_kw: cargador?.PowerKW, duracion_horas: duracion })
      .then((c) => !cancelado && setPrecioEstimado(c.total))
      .catch(() => !cancelado && setPrecioEstimado(null))
      .finally(() => !cancelado && setCargandoPrecio(false));
    return () => { cancelado = true; };
  }, [cargadorSeleccionado, duracion, nombre, operador]);

  const encabezado = (
    <View style={{ gap: 6 }}>
      <Text style={s.nombre}>{nombre}</Text>
      <Text style={s.texto}><Icono name="location-dot" size={12} color={colors.textDim} />  {direccion}{ciudad ? ` · ${ciudad}` : ''}</Text>
      <Text style={s.textoDim}>Operador: {operador}</Text>
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
      const cotizacion = await cotizarReserva({ estacion_nombre: nombre, operador, tipo_cargador: cargador?.ConnectionType?.Title || '', potencia_kw: cargador?.PowerKW, duracion_horas: duracion });
      setReservaPendiente({
        estacion_ocm_id: ocmId,
        cargador_id: cargadorSeleccionado,
        estacion_nombre: nombre,
        fecha_hora_inicio: inicio.toISOString(),
        fecha_hora_fin: fin.toISOString(),
        costo_pagado: cotizacion.total,
      });
      setPagoReserva({ id: `RESERVA-${Date.now()}`, monto: cotizacion.total });
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Reserva', mensaje: mensajeError(e, 'Error al reservar') });
    } finally {
      setReservando(false);
    }
  };

  const alPagar = async () => {
    if (!reservaPendiente) return;
    try {
      const confirmada = await crearReservaConfirmada(reservaPendiente);
      const ids = new Set(estado?.cargadores_reservados || []);
      if (confirmada.cargador_id) ids.add(confirmada.cargador_id);
      setEstado((a) => ({ ...(a || {}), estacion_ocm_id: ocmId, estado: 'disponible', cargadores_reservados: [...ids] }));
      setCargadorSeleccionado(null);
      emitir('estaciones-actualizadas', { estacionId: ocmId, cargadorId: confirmada.cargador_id || reservaPendiente.cargador_id });
      notificar({ tipo: 'success', titulo: 'Reserva confirmada', mensaje: 'Pago aprobado y reserva aceptada correctamente.' });
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

  const calificacionesVisibles = resumen ? (verTodas ? resumen.calificaciones : resumen.calificaciones.slice(0, 2)) : [];

  return (
    <View style={{ gap: 14 }}>
      {encabezado}
      {insigniaEstado}

      {usuario.is_admin && (
        <CampoSelect
          etiqueta="Estado administrativo"
          valor={estadoAdmin}
          onChange={(v) => void cambiarEstadoAdmin(v as EstadoAdmin)}
          opciones={[{ valor: 'activa', etiqueta: 'Activa' }, { valor: 'mantenimiento', etiqueta: 'En mantenimiento' }, { valor: 'inactiva', etiqueta: 'Fuera de servicio' }]}
        />
      )}

      {!usuario.is_admin && !tieneVehiculo && (
        <View style={[s.aviso, { borderColor: colors.warning }]}>
          <Icono name="car" size={16} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={[s.subtitulo, { color: colors.warning }]}>Registra un vehículo</Text>
            <Text style={s.textoDim}>Así podremos mostrar compatibilidad y calcular mejor tus reservas.</Text>
          </View>
          {onRegistrarVehiculo && <Boton titulo="Registrar" pequeno variante="outline" onPress={onRegistrarVehiculo} />}
        </View>
      )}

      {!usuario.is_admin && (
        <View style={s.acciones}>
          <Boton titulo="Favorito" pequeno icono="star" variante={esFavorito ? 'primary' : 'outline'} onPress={toggleFavorito} />
          {lat != null && lon != null && <Boton titulo="Ruta" pequeno icono="route" variante="soft" onPress={() => onCalcularRuta(lat, lon)} />}
          <Boton titulo="Calificar" pequeno icono="star-half-stroke" variante={mostrarCalificar ? 'soft' : 'outline'} onPress={() => setMostrarCalificar((v) => !v)} />
          <Boton titulo="Reportar" pequeno icono="bullhorn" variante={mostrarReporte ? 'soft' : 'outline'} onPress={() => setMostrarReporte((v) => !v)} />
        </View>
      )}

      {mostrarCalificar && (
        <View style={s.caja}>
          <Text style={s.subtitulo}>Tu calificación</Text>
          <Estrellas valor={puntaje} tamano={26} onChange={setPuntaje} />
          <CampoTexto value={comentario} onChangeText={setComentario} placeholder="Comentario (opcional)" multiline />
          <Boton titulo="Enviar calificación" pequeno onPress={enviarCalificacion} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}

      {mostrarReporte && (
        <View style={s.caja}>
          <Text style={s.subtitulo}>¿Qué problema encontraste?</Text>
          <View style={s.acciones}>
            {TIPOS_REPORTE.map((t) => (
              <Boton key={t.valor} titulo={t.etiqueta} icono={t.icono} pequeno variante={tipoReporte === t.valor ? 'primary' : 'outline'} onPress={() => setTipoReporte(t.valor)} />
            ))}
          </View>
          <CampoTexto value={descReporte} onChangeText={setDescReporte} placeholder="Descripción" multiline />
          <Boton titulo={enviandoReporte ? 'Enviando...' : 'Enviar reporte'} pequeno cargando={enviandoReporte} onPress={enviarReporte} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}

      <Text style={s.seccion}>Conectores</Text>
      {conexiones.length === 0 && <Text style={s.textoDim}>Esta estación no reporta conectores.</Text>}
      {conexiones.map((c, i) => {
        const cargadorId = `${ocmId}-${i + 1}`;
        const tipo = c.ConnectionType?.Title || 'Genérico';
        const compatible = esCompatible(c.ConnectionType?.Title || '');
        const reservado = reservados.includes(cargadorId);
        const reservaDe = estado?.reservas_por_cargador?.find((r) => r.cargador_id === cargadorId);
        const bloqueado = reservado || estadoAdmin !== 'activa';
        const seleccionado = cargadorSeleccionado === cargadorId;
        const recomendado = compatible && !bloqueado && !!tipoConectorVehiculo;
        const etiqueta = reservado ? 'Reservado' : estadoAdmin === 'mantenimiento' ? 'Mantenimiento' : estadoAdmin === 'inactiva' ? 'Fuera de servicio' : 'Disponible';
        return (
          <View key={cargadorId} style={[s.conector, seleccionado && { borderColor: colors.primary, backgroundColor: colors.primarySoft }, !compatible && { opacity: 0.6 }]}>
            <View style={s.filaEntre}>
              <Text style={s.subtitulo}><Icono name="plug" size={13} color={colors.primary} />  {tipo}</Text>
              {recomendado && <Insignia texto="Para tu vehículo" tono="verde" icono="check" />}
            </View>
            <Text style={s.textoDim}>{c.PowerKW ? `${c.PowerKW} kW` : 'Potencia no especificada'} · {c.CurrentType?.Title || 'AC/DC'} · Bahías: {c.Quantity || 1}</Text>
            <View style={s.filaEntre}>
              <Text style={s.textoDim}>ID: {cargadorId}</Text>
              <Insignia texto={etiqueta} tono={reservado ? 'azul' : bloqueado ? 'rojo' : 'verde'} />
            </View>
            {reservado && reservaDe && <Text style={s.textoDim}><Icono name="user" size={11} color={colors.textDim} />  Reservado por {reservaDe.reservado_por}</Text>}
            {!usuario.is_admin && (
              <Boton
                titulo={seleccionado ? 'Cargador seleccionado' : bloqueado ? 'No disponible' : compatible ? 'Seleccionar cargador' : 'No compatible'}
                pequeno
                variante={seleccionado ? 'primary' : 'outline'}
                disabled={bloqueado || !compatible}
                onPress={() => setCargadorSeleccionado(seleccionado ? null : cargadorId)}
              />
            )}
          </View>
        );
      })}

      {estadoPanel === 'disponible' && !usuario.is_admin && (
        <View style={s.caja}>
          <Text style={s.subtitulo}><Icono name="calendar-plus" size={13} color={colors.primary} />  Reservar</Text>
          <SelectorDuracion valor={duracion} onChange={setDuracion} />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><SelectorFechaHora valor={inicio} onChange={setInicio} /></View>
            <Boton titulo="Ahora" variante="outline" pequeno onPress={() => setInicio(proximaHora())} style={{ marginBottom: 12 }} />
          </View>
          <Text style={s.textoDim}>Fin: {fechaHora(fin)}</Text>
          <View style={[s.precio, { borderColor: colors.primaryBorder }]}>
            <Text style={s.texto}><Icono name="receipt" size={12} color={colors.primary} />  Costo estimado</Text>
            <Text style={[s.subtitulo, { color: colors.primary }]}>{cargandoPrecio ? 'Calculando…' : precioEstimado != null ? pesos(precioEstimado) : 'Selecciona un cargador'}</Text>
          </View>
          <Boton titulo={reservando ? 'Procesando...' : 'Confirmar reserva'} icono="calendar-check" cargando={reservando} disabled={!cargadorSeleccionado} onPress={confirmarReserva} bloque />
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
        metodosGuardados={metodosPago}
        onCerrar={() => { setPagoReserva(null); setReservaPendiente(null); }}
        onExito={alPagar}
      />
    </View>
  );
}

const crearEstilos = (c: Palette) => StyleSheet.create({
  nombre: { color: c.text, fontSize: 19, fontWeight: '900' },
  texto: { color: c.textMuted, fontSize: 13.5, lineHeight: 19 },
  textoDim: { color: c.textDim, fontSize: 12.5, lineHeight: 18 },
  subtitulo: { color: c.text, fontSize: 14.5, fontWeight: '800' },
  seccion: { color: c.textDim, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  bloqueo: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: Radius.md, backgroundColor: c.cardElevated },
  aviso: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: Radius.md, borderWidth: 1, backgroundColor: c.warningSoft },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  caja: { gap: 10, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardElevated },
  conector: { gap: 7, padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardElevated },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  precio: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: Radius.md, borderWidth: 1, backgroundColor: c.primarySoft },
  item: { gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border },
});
