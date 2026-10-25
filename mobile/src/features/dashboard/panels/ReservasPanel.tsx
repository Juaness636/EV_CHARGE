// Panel de reservas: historial, nueva reserva con cargadores compatibles y pago,
// edición de reservas pendientes, cancelación con reembolso y eliminación.
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  actualizarReserva, cancelarReserva, crearReservaConfirmada, eliminarReserva, escanearQr, misReservas, terminarCarga,
  MINUTOS_ANTICIPACION_QR, MINUTOS_TOLERANCIA_LLEGADA, type Reserva, type ReservaCreate,
} from '../../../api/reservas.api';
import { listarVehiculos } from '../../../api/vehiculos.api';
import { listarMetodosPago, type MetodoPago } from '../../../api/metodosPago.api';
import { obtenerEstadoEstacion, type EstadoEstacion } from '../../../api/estado.api';
import { cotizarReserva } from '../../../api/tarifas.api';
import { mensajeError } from '../../../api/httpClient';
import { emitir } from '../../../utils/eventos';
import { conectorCoincide, etiquetaEstado, nombreEstacion } from '../../../utils/estaciones';
import { fechaHora, enUnosMinutos, pesos, proximaHora, sumarHoras } from '../../../utils/formato';
import { useCarga, useEstacionesMapa } from '../../../utils/useCarga';
import { ModalPago } from '../../../components/ModalPago';
import { confirmar, notificar } from '../../../components/Notificaciones';
import { Alerta, Boton, CampoSelect, Cargando, Dato, Insignia, ItemLista, KPI, SelectorDuracion, SelectorFechaHora, Tarjeta, tonoEstado, Vacio } from '../../../components/ui';
import type { PropsPanel } from '../tipos';
import { AvisoVehiculo, totalReservasPagadas } from './PanelesResumen';
import { EstadoError } from '../../../components/EstadoError';
import { EscanerQR } from '../../../components/EscanerQR';

const etiquetaReserva = (r: Reserva) => (
  r.estado === 'activa' ? 'Aceptada'
    : r.estado === 'en_curso' ? 'Cargando'
      : r.estado === 'realizada' ? 'Realizada'
        : r.estado === 'cancelada' && r.motivo_cancelacion === 'no_llego' ? 'Cancelada (no llegó)'
          : r.estado || 'pendiente'
);

// Franja para escanear el QR: desde 15 min antes del inicio hasta 30 min después.
const ventanaQr = (r: Reserva) => {
  const inicio = new Date(r.fecha_hora_inicio).getTime();
  return { desde: new Date(inicio - MINUTOS_ANTICIPACION_QR * 60000), hasta: new Date(inicio + MINUTOS_TOLERANCIA_LLEGADA * 60000) };
};
// "demo-est-0001-2" se muestra como "#2"; los ids reales de cargador se dejan como están.
const etiquetaCargador = (r: Reserva) => {
  const id = r.cargador_id || '';
  if (!id || id.endsWith('-general')) return 'Cualquiera de la estación';
  const numero = id.startsWith(`${r.estacion_ocm_id}-`) ? id.slice(r.estacion_ocm_id.length + 1) : '';
  return /^\d+$/.test(numero) ? `#${numero}` : id;
};
// Cada cuánto se recargan las reservas mientras el panel está abierto (para ver la cancelación automática).
const SEGUNDOS_REFRESCO = 30;

export function ReservasPanel({ version, irA }: PropsPanel) {
  const { datos, cargando, error, recargar, fallo } = useCarga(async () => {
    const [reservas, vehiculos] = await Promise.all([misReservas(), listarVehiculos()]);
    return { reservas, vehiculos };
  }, { reservas: [] as Reserva[], vehiculos: [] as Awaited<ReturnType<typeof listarVehiculos>> }, [version]);
  const { reservas, vehiculos } = datos;

  const [mostrar, setMostrar] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [estacionId, setEstacionId] = useState('');
  const [cargadorId, setCargadorId] = useState('');
  const [duracion, setDuracion] = useState(2);
  const [inicio, setInicio] = useState<Date>(proximaHora());
  const [estadoEstacion, setEstadoEstacion] = useState<EstadoEstacion | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [pago, setPago] = useState<{ id: string; monto: number; reserva: ReservaCreate } | null>(null);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const estaciones = useEstacionesMapa(mostrar);
  const [escaneando, setEscaneando] = useState<Reserva | null>(null);

  useEffect(() => {
    const intervalo = setInterval(() => void recargar(), SEGUNDOS_REFRESCO * 1000);
    return () => clearInterval(intervalo);
  }, [recargar]);

  const vehiculoActivo = vehiculos.find((v) => v.activo);
  const estacion = estaciones.find((e) => String(e.ID) === estacionId);
  const noDisponible = estadoEstacion?.estado === 'mantenimiento' || estadoEstacion?.estado === 'inactiva';

  const cargadores = useMemo(() => (estacion?.Connections || []).map((c, i) => {
    const id = `${estacionId}-${i + 1}`;
    return {
      id,
      c,
      compatible: !vehiculoActivo || conectorCoincide(c.ConnectionType?.Title || '', vehiculoActivo.tipo_conector),
      reservado: Boolean(estadoEstacion?.cargadores_reservados?.includes(id)),
    };
  }), [estacion, estacionId, vehiculoActivo, estadoEstacion]);
  const disponibles = cargadores.filter((x) => x.compatible && (!x.reservado || (editando && x.id === cargadorId)));

  useEffect(() => {
    if (!estacionId) return setEstadoEstacion(null);
    let cancelado = false;
    obtenerEstadoEstacion(estacionId).then((e) => !cancelado && setEstadoEstacion(e)).catch(() => !cancelado && setEstadoEstacion(null));
    return () => { cancelado = true; };
  }, [estacionId]);

  const limpiar = () => {
    setEditando(null);
    setEstacionId('');
    setCargadorId('');
    setDuracion(2);
    setInicio(proximaHora());
  };

  const seleccionarEstacion = (id: string) => {
    setEstacionId(id);
    const est = estaciones.find((e) => String(e.ID) === id);
    const primero = (est?.Connections || []).findIndex((c) => !vehiculoActivo || conectorCoincide(c.ConnectionType?.Title || '', vehiculoActivo.tipo_conector));
    setCargadorId(primero >= 0 ? `${id}-${primero + 1}` : '');
  };

  const editar = (r: Reserva) => {
    const horas = Math.max(1, Math.round((new Date(r.fecha_hora_fin).getTime() - new Date(r.fecha_hora_inicio).getTime()) / 3600000));
    setEditando(r.id);
    setEstacionId(r.estacion_ocm_id);
    setCargadorId(r.cargador_id || '');
    setDuracion(Math.min(8, horas));
    setInicio(new Date(r.fecha_hora_inicio));
    setMostrar(true);
  };

  const guardar = async () => {
    if (!vehiculoActivo) return notificar({ tipo: 'warning', titulo: 'Reserva', mensaje: 'Activa un vehículo antes de realizar una reserva.' });
    if (!estacionId || !cargadorId) return notificar({ tipo: 'warning', titulo: 'Reserva', mensaje: 'Debes seleccionar la estación y el cargador.' });
    if (inicio < new Date()) return notificar({ tipo: 'warning', titulo: 'Reserva', mensaje: 'No se puede reservar en el pasado.' });
    if (noDisponible) return notificar({ tipo: 'warning', titulo: 'Reserva', mensaje: 'La estación no admite reservas en este momento.' });
    const payload: ReservaCreate = {
      estacion_ocm_id: estacionId,
      cargador_id: cargadorId,
      estacion_nombre: estacion ? nombreEstacion(estacion) : reservas.find((r) => r.id === editando)?.estacion_nombre || '',
      fecha_hora_inicio: inicio.toISOString(),
      fecha_hora_fin: sumarHoras(inicio, duracion).toISOString(),
    };
    setProcesando(true);
    try {
      if (editando) {
        await actualizarReserva(editando, payload);
        notificar({ tipo: 'success', titulo: 'Reserva', mensaje: 'Reserva actualizada correctamente.' });
        setMostrar(false);
        limpiar();
        await recargar();
        return;
      }
      const cargador = estacion?.Connections?.[Number(cargadorId.split('-').pop()) - 1];
      const monto = await cotizarReserva({
        estacion_ocm_id: payload.estacion_ocm_id,
        cargador_id: payload.cargador_id || undefined,
        estacion_nombre: payload.estacion_nombre || '',
        operador: estacion?.OperatorInfo?.Title,
        tipo_cargador: cargador?.ConnectionType?.Title || '',
        potencia_kw: cargador?.PowerKW,
        duracion_horas: duracion,
      }).then((c) => c.total).catch(() => duracion * 5000);
      setMetodos(await listarMetodosPago().catch(() => []));
      setPago({ id: `RESERVA-${Date.now()}`, monto, reserva: payload });
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Reserva', mensaje: mensajeError(e) });
    } finally {
      setProcesando(false);
    }
  };

  const alPagar = async ({ transaccion_id }: { transaccion_id: string }) => {
    if (!pago) return;
    try {
      await crearReservaConfirmada({ ...pago.reserva, transaccion_id });
      emitir('estaciones-actualizadas', { estacionId: pago.reserva.estacion_ocm_id, cargadorId: pago.reserva.cargador_id });
      notificar({ tipo: 'success', titulo: 'Reserva confirmada', mensaje: 'Pago aprobado y reserva aceptada. Al llegar, toca "Escanear QR" en esta reserva.' });
      setMostrar(false);
      limpiar();
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Reserva', mensaje: mensajeError(e, 'El pago fue aprobado, pero no se pudo crear la reserva.') });
    }
  };

  const cancelar = async (r: Reserva) => {
    if (!(await confirmar({ titulo: 'Cancelar reserva', mensaje: `¿Deseas cancelar tu reserva en ${r.estacion_nombre || 'esta estación'}? Esta acción quedará registrada.`, confirmarTexto: 'Sí, cancelar reserva' }))) return;
    try {
      const respuesta = await cancelarReserva(r.id);
      notificar({ tipo: 'success', titulo: 'Reserva cancelada', mensaje: respuesta.mensaje || 'Reserva cancelada correctamente. El importe fue devuelto.' });
      emitir('estaciones-actualizadas');
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Reserva', mensaje: mensajeError(e) });
    }
  };

  const validarQr = async (codigo: string) => {
    if (!escaneando) return;
    // Si el código no sirve, la excepción la muestra el lector y el usuario puede reintentar.
    const respuesta = await escanearQr(escaneando.id, codigo);
    setEscaneando(null);
    notificar({ tipo: 'success', titulo: 'Cargador desbloqueado', mensaje: respuesta.mensaje });
    emitir('estaciones-actualizadas', { estacionId: escaneando.estacion_ocm_id, cargadorId: escaneando.cargador_id });
    await recargar();
  };

  const terminar = async (r: Reserva) => {
    if (!(await confirmar({ titulo: 'Terminar carga', mensaje: '¿Ya desconectaste tu vehículo? El cargador quedará libre para otros conductores.', confirmarTexto: 'Sí, terminar' }))) return;
    try {
      const respuesta = await terminarCarga(r.id);
      notificar({ tipo: 'success', titulo: 'Carga terminada', mensaje: respuesta.mensaje });
      emitir('estaciones-actualizadas', { estacionId: r.estacion_ocm_id, cargadorId: r.cargador_id });
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Terminar carga', mensaje: mensajeError(e) });
    }
  };

  const eliminar = async (r: Reserva) => {
    if (!(await confirmar({ titulo: 'Eliminar reserva', mensaje: '¿Deseas eliminar esta reserva de tu historial?', confirmarTexto: 'Eliminar' }))) return;
    try {
      await eliminarReserva(r.id);
      notificar({ tipo: 'success', titulo: 'Reserva', mensaje: 'Reserva eliminada correctamente.' });
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Reserva', mensaje: mensajeError(e) });
    }
  };

  const sinVehiculo = vehiculos.length === 0;

  return (
    <>
      <Tarjeta style={{ gap: 6 }}>
        <Dato etiqueta="Historial de reservas" valor="Consulta tus reservas, su estado y el valor confirmado. También puedes reservar desde el mapa." />
      </Tarjeta>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <KPI etiqueta="Reservas registradas" valor={reservas.length} icono="list" />
        <KPI etiqueta="Reservas activas" valor={reservas.filter((r) => r.estado === 'activa' || r.estado === 'en_curso').length} icono="calendar-check" />
        <KPI etiqueta="Total reservado" valor={sinVehiculo ? '—' : pesos(totalReservasPagadas(reservas))} icono="wallet" />
      </View>
      {sinVehiculo && <AvisoVehiculo texto="Registra un vehículo para reservar cargadores compatibles y ver los valores estimados." onRegistrar={() => irA('Vehículos')} />}

      <Boton titulo={mostrar ? 'Cerrar formulario' : '+ Nueva reserva'} variante="soft" onPress={() => { limpiar(); setMostrar((v) => !v); }} style={{ alignSelf: 'flex-start' }} />
      {mostrar && (
        <Tarjeta>
          {!vehiculoActivo && <Alerta tipo="warning" texto="Activa un vehículo en el apartado Vehículos para mostrar sus cargadores compatibles." />}
          <CampoSelect
            etiqueta="Estación"
            valor={estacionId}
            onChange={seleccionarEstacion}
            deshabilitado={Boolean(editando)}
            buscable
            placeholder={estaciones.length ? 'Selecciona una estación' : 'Cargando estaciones...'}
            opciones={estaciones.map((e) => ({ valor: String(e.ID), etiqueta: nombreEstacion(e), descripcion: [e.AddressInfo?.AddressLine1, e.ciudad || e.AddressInfo?.Town].filter(Boolean).join(' · ') }))}
          />
          {estacionId ? <View style={{ marginBottom: 8 }}><Insignia texto={etiquetaEstado(estadoEstacion?.estado as string)} tono={tonoEstado(String(estadoEstacion?.estado || 'disponible'))} /></View> : null}
          <CampoSelect
            etiqueta="Cargador"
            valor={cargadorId}
            onChange={setCargadorId}
            placeholder="Selecciona un cargador compatible"
            opciones={cargadores.map(({ id, c, compatible, reservado }) => ({
              valor: id,
              etiqueta: `${c.ConnectionType?.Title || 'Genérico'} · ${c.PowerKW || '—'} kW`,
              descripcion: `ID ${id} · ${noDisponible ? 'No disponible' : reservado && id !== cargadorId ? 'Reservado' : !compatible ? 'No compatible' : 'Disponible'}`,
              deshabilitada: noDisponible || !compatible || (reservado && id !== cargadorId),
            }))}
            ayuda={
              estacion && !disponibles.length && !noDisponible
                ? 'Esta estación no tiene cargadores compatibles y disponibles para tu vehículo activo.'
                : vehiculoActivo ? `Compatible con ${vehiculoActivo.marca} ${vehiculoActivo.modelo} · ${vehiculoActivo.tipo_conector}` : undefined
            }
          />
          <SelectorDuracion valor={duracion} onChange={setDuracion} />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><SelectorFechaHora valor={inicio} onChange={setInicio} /></View>
            <Boton titulo="Ahora" variante="outline" pequeno onPress={() => setInicio(enUnosMinutos())} style={{ marginBottom: 12 }} />
          </View>
          <Dato etiqueta="Fin" valor={fechaHora(sumarHoras(inicio, duracion))} />
          {noDisponible && <Alerta tipo="warning" texto={`Esta estación está ${estadoEstacion?.estado === 'mantenimiento' ? 'en mantenimiento' : 'fuera de servicio'} y no admite reservas.`} />}
          <Boton
            titulo={editando ? 'Guardar cambios' : 'Continuar al pago'}
            icono={editando ? 'floppy-disk' : 'credit-card'}
            cargando={procesando}
            disabled={noDisponible || !vehiculoActivo || !cargadorId || !disponibles.some((x) => x.id === cargadorId)}
            onPress={guardar}
            style={{ marginTop: 10 }}
          />
        </Tarjeta>
      )}

      {error ? <EstadoError error={fallo} onReintentar={recargar} compacto /> : null}
      {cargando && !reservas.length ? <Cargando /> : reservas.length === 0 ? <Vacio texto="No tienes reservas." icono="calendar" /> : reservas.map((r) => (
        <ItemLista
          key={r.id}
          titulo={r.estacion_nombre || r.estacion_ocm_id}
          insignia={<Insignia texto={etiquetaReserva(r)} tono={tonoEstado(r.estado)} />}
          acciones={(r.estado === 'pendiente' || r.estado === 'activa' || r.estado === 'en_curso' || r.estado === 'realizada' || r.estado === 'cancelada') ? <>
            {r.estado === 'activa' && <Boton titulo="Escanear QR" icono="qrcode" pequeno onPress={() => setEscaneando(r)} />}
            {r.estado === 'en_curso' && <Boton titulo="Terminar carga" icono="plug-circle-xmark" pequeno onPress={() => void terminar(r)} />}
            {r.estado === 'pendiente' && <Boton titulo="Editar" pequeno variante="outline" onPress={() => editar(r)} />}
            {(r.estado === 'pendiente' || r.estado === 'activa') && <Boton titulo="Cancelar" pequeno variante="danger" onPress={() => void cancelar(r)} />}
            {(r.estado === 'realizada' || r.estado === 'cancelada') && <Boton titulo="Eliminar" pequeno variante="danger" onPress={() => void eliminar(r)} />}
          </> : undefined}
        >
          <Dato etiqueta="Cargador" valor={etiquetaCargador(r)} />
          <Dato etiqueta="Inicio" valor={fechaHora(r.fecha_hora_inicio)} />
          <Dato etiqueta="Fin" valor={fechaHora(r.fecha_hora_fin)} />
          <Dato etiqueta="Valor" valor={sinVehiculo ? 'Registra un vehículo para estimar el costo' : pesos(r.costo_pagado)} />
          {r.estado === 'activa' && (
            <Alerta
              tipo="info"
              texto={`Al llegar, toca "Escanear QR" y lee el código pegado en tu cargador. Puedes hacerlo entre ${fechaHora(ventanaQr(r).desde)} y ${fechaHora(ventanaQr(r).hasta)}; si no, la reserva se cancela sola, sin reembolso, y el cargador queda libre.`}
            />
          )}
          {r.estado === 'en_curso' && <Alerta tipo="success" texto={`Cargando desde ${fechaHora(r.iniciada_en)}; cuando desconectes el vehículo, toca "Terminar carga".`} />}
          {r.estado === 'cancelada' && r.motivo_cancelacion === 'no_llego' && (
            <Alerta tipo="warning" texto={`Se canceló porque no escaneaste el QR dentro de los ${MINUTOS_TOLERANCIA_LLEGADA} minutos siguientes a la hora reservada.`} />
          )}
        </ItemLista>
      ))}

      <ModalPago
        visible={!!pago}
        tipo="reserva"
        tituloItem={pago?.reserva.estacion_nombre || 'Estación EV Charge'}
        monto={pago?.monto ?? 0}
        idReferencia={pago?.id}
        reserva={pago?.reserva}
        metodosGuardados={metodos}
        onCerrar={() => setPago(null)}
        onExito={alPagar}
      />

      <EscanerQR
        visible={!!escaneando}
        titulo="Escanear QR del cargador"
        detalle={escaneando ? `${escaneando.estacion_nombre || 'Tu estación'} · ${fechaHora(escaneando.fecha_hora_inicio)}` : undefined}
        onCerrar={() => setEscaneando(null)}
        onCodigo={validarQr}
      />
    </>
  );
}
