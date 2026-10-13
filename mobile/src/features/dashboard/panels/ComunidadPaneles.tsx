// Paneles de comunidad: mis reportes de incidencias y mis calificaciones de estaciones.
import React, { useState } from 'react';
import { actualizarReporte, crearReporte, eliminarReporte, misReportes, type Reporte } from '../../../api/reportes.api';
import { actualizarCalificacion, calificar, eliminarCalificacion, misCalificaciones, type Calificacion } from '../../../api/calificaciones.api';
import { mensajeError } from '../../../api/httpClient';
import { contieneLenguajeOfensivo, mensajeContenidoOfensivo } from '../../../utils/contentFilter';
import { etiquetaEstado, nombreEstacion } from '../../../utils/estaciones';
import { fechaHora } from '../../../utils/formato';
import { useCarga, useEstacionesMapa } from '../../../utils/useCarga';
import type { EstacionOCM } from '../../mapa/types';
import { confirmar, notificar } from '../../../components/Notificaciones';
import { Alerta, Boton, CampoSelect, CampoTexto, Cargando, Dato, Estrellas, Etiqueta, Insignia, ItemLista, Tarjeta, tonoEstado, Vacio } from '../../../components/ui';
import type { PropsPanel } from '../tipos';

const TIPOS_REPORTE = [
  { valor: 'averia', etiqueta: 'Avería' },
  { valor: 'fuera_servicio', etiqueta: 'Fuera de servicio' },
  { valor: 'ocupado', etiqueta: 'Ocupado' },
  { valor: 'otro', etiqueta: 'Otro' },
];

function SelectorEstacion({ estaciones, valor, onChange, deshabilitado }: { estaciones: EstacionOCM[]; valor: string; onChange: (id: string, nombre: string) => void; deshabilitado?: boolean }) {
  return (
    <CampoSelect
      etiqueta="Estación"
      requerido
      valor={valor}
      buscable
      deshabilitado={deshabilitado}
      placeholder={estaciones.length ? 'Selecciona una estación' : 'Cargando estaciones...'}
      onChange={(id) => onChange(id, nombreEstacion(estaciones.find((e) => String(e.ID) === id)))}
      opciones={estaciones.map((e) => ({ valor: String(e.ID), etiqueta: nombreEstacion(e), descripcion: [e.AddressInfo?.AddressLine1, e.ciudad || e.AddressInfo?.Town].filter(Boolean).join(' · ') }))}
    />
  );
}

const reporteVacio = { estacion_ocm_id: '', estacion_nombre: '', tipo: 'averia', descripcion: '' };

export function ReportesPanel({ version }: PropsPanel) {
  const { datos: reportes, cargando, error, recargar } = useCarga(misReportes, [] as Reporte[], [version]);
  const [mostrar, setMostrar] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(reporteVacio);
  const [guardando, setGuardando] = useState(false);
  const estaciones = useEstacionesMapa(mostrar);

  const guardar = async () => {
    if (!form.estacion_ocm_id) return notificar({ tipo: 'warning', titulo: 'Reporte', mensaje: 'Selecciona la estación.' });
    if (!form.descripcion.trim()) return notificar({ tipo: 'warning', titulo: 'Reporte', mensaje: 'La descripción del reporte es obligatoria.' });
    if (contieneLenguajeOfensivo(form.descripcion)) return notificar({ tipo: 'warning', titulo: 'Contenido no permitido', mensaje: mensajeContenidoOfensivo });
    setGuardando(true);
    try {
      if (editando) await actualizarReporte(editando, { tipo: form.tipo, descripcion: form.descripcion.trim() });
      else await crearReporte({ ...form, descripcion: form.descripcion.trim() });
      notificar({ tipo: 'success', titulo: 'Reporte', mensaje: editando ? 'Reporte actualizado correctamente.' : 'Reporte enviado correctamente.' });
      setMostrar(false);
      setEditando(null);
      setForm(reporteVacio);
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Reporte', mensaje: mensajeError(e) });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (r: Reporte) => {
    if (!(await confirmar({ titulo: 'Eliminar reporte', mensaje: 'Esta acción quedará registrada en tus notificaciones.', confirmarTexto: 'Eliminar' }))) return;
    try {
      await eliminarReporte(r.id);
      notificar({ tipo: 'success', titulo: 'Reporte', mensaje: 'Reporte eliminado.' });
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Reporte', mensaje: mensajeError(e) });
    }
  };

  return (
    <>
      <Boton titulo={mostrar && !editando ? 'Cerrar formulario' : '+ Nuevo reporte'} variante="soft" onPress={() => { setEditando(null); setForm(reporteVacio); setMostrar((v) => !v || editando !== null); }} style={{ alignSelf: 'flex-start' }} />
      {mostrar && (
        <Tarjeta>
          {editando
            ? <Dato etiqueta="Estación" valor={form.estacion_nombre || form.estacion_ocm_id} />
            : <SelectorEstacion estaciones={estaciones} valor={form.estacion_ocm_id} onChange={(id, nombre) => setForm({ ...form, estacion_ocm_id: id, estacion_nombre: nombre })} />}
          <CampoSelect etiqueta="Tipo" valor={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} opciones={TIPOS_REPORTE.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))} />
          <CampoTexto etiqueta="Descripción" requerido value={form.descripcion} onChangeText={(v) => setForm({ ...form, descripcion: v })} multiline placeholder="Describe el problema encontrado" />
          <Boton titulo={editando ? 'Guardar cambios' : 'Enviar reporte'} cargando={guardando} onPress={guardar} style={{ alignSelf: 'flex-start' }} />
        </Tarjeta>
      )}
      {error ? <Alerta texto={error} /> : null}
      {cargando && !reportes.length ? <Cargando /> : reportes.length === 0 ? <Vacio texto="No tienes reportes." icono="triangle-exclamation" /> : reportes.map((r) => (
        <ItemLista
          key={r.id}
          titulo={r.estacion_nombre || r.estacion_ocm_id}
          insignia={<Insignia texto={etiquetaEstado(r.estado || 'abierto')} tono={tonoEstado(r.estado || 'abierto')} />}
          acciones={r.estado === 'abierto' || !r.estado ? <>
            <Boton titulo="Editar" pequeno variante="outline" onPress={() => { setEditando(r.id); setForm({ estacion_ocm_id: r.estacion_ocm_id, estacion_nombre: r.estacion_nombre || '', tipo: r.tipo, descripcion: r.descripcion || '' }); setMostrar(true); }} />
            <Boton titulo="Eliminar" pequeno variante="danger" onPress={() => void eliminar(r)} />
          </> : undefined}
        >
          <Dato etiqueta="Tipo" valor={TIPOS_REPORTE.find((t) => t.valor === r.tipo)?.etiqueta || r.tipo} />
          <Dato etiqueta="Descripción" valor={r.descripcion || 'Sin descripción'} />
          <Dato etiqueta="Fecha" valor={fechaHora(r.fecha)} />
        </ItemLista>
      ))}
    </>
  );
}

const calificacionVacia = { estacion_ocm_id: '', estacion_nombre: '', puntaje: 5, comentario: '' };

export function CalificacionesPanel({ version }: PropsPanel) {
  const { datos: calificaciones, cargando, error, recargar } = useCarga(misCalificaciones, [] as Calificacion[], [version]);
  const [mostrar, setMostrar] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(calificacionVacia);
  const [guardando, setGuardando] = useState(false);
  const estaciones = useEstacionesMapa(mostrar);

  const guardar = async () => {
    if (!form.estacion_ocm_id) return notificar({ tipo: 'warning', titulo: 'Calificación', mensaje: 'Selecciona la estación.' });
    if (!form.comentario.trim()) return notificar({ tipo: 'warning', titulo: 'Calificación', mensaje: 'El comentario es obligatorio.' });
    if (contieneLenguajeOfensivo(form.comentario)) return notificar({ tipo: 'warning', titulo: 'Contenido no permitido', mensaje: mensajeContenidoOfensivo });
    setGuardando(true);
    try {
      if (editando) await actualizarCalificacion(editando, { puntaje: form.puntaje, comentario: form.comentario.trim() });
      else await calificar({ ...form, comentario: form.comentario.trim() });
      notificar({ tipo: 'success', titulo: 'Calificación', mensaje: editando ? 'Calificación actualizada correctamente.' : 'Calificación guardada correctamente.' });
      setMostrar(false);
      setEditando(null);
      setForm(calificacionVacia);
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Calificación', mensaje: mensajeError(e) });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (c: Calificacion) => {
    if (!(await confirmar({ titulo: 'Eliminar calificación', mensaje: 'Esta acción quedará registrada en tus notificaciones.', confirmarTexto: 'Eliminar' }))) return;
    try {
      await eliminarCalificacion(c.id);
      notificar({ tipo: 'success', titulo: 'Calificación', mensaje: 'Calificación eliminada.' });
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Calificación', mensaje: mensajeError(e) });
    }
  };

  return (
    <>
      <Boton titulo={mostrar && !editando ? 'Cerrar formulario' : '+ Nueva calificación'} variante="soft" onPress={() => { setEditando(null); setForm(calificacionVacia); setMostrar((v) => !v || editando !== null); }} style={{ alignSelf: 'flex-start' }} />
      {mostrar && (
        <Tarjeta>
          {editando
            ? <Dato etiqueta="Estación" valor={form.estacion_nombre || form.estacion_ocm_id} />
            : <SelectorEstacion estaciones={estaciones} valor={form.estacion_ocm_id} onChange={(id, nombre) => setForm({ ...form, estacion_ocm_id: id, estacion_nombre: nombre })} />}
          <Etiqueta texto="Puntaje" />
          <Estrellas valor={form.puntaje} tamano={28} onChange={(p) => setForm({ ...form, puntaje: p })} />
          <CampoTexto etiqueta="Comentario" requerido value={form.comentario} onChangeText={(v) => setForm({ ...form, comentario: v })} multiline placeholder="Cuéntanos tu experiencia" />
          <Boton titulo={editando ? 'Guardar cambios' : 'Guardar calificación'} cargando={guardando} onPress={guardar} style={{ alignSelf: 'flex-start' }} />
        </Tarjeta>
      )}
      {error ? <Alerta texto={error} /> : null}
      {cargando && !calificaciones.length ? <Cargando /> : calificaciones.length === 0 ? <Vacio texto="No tienes calificaciones." icono="star-half-stroke" /> : calificaciones.map((c) => (
        <ItemLista
          key={c.id}
          titulo={c.estacion_nombre || c.estacion_ocm_id}
          insignia={<Estrellas valor={c.puntaje} tamano={13} />}
          acciones={<>
            <Boton titulo="Editar" pequeno variante="outline" onPress={() => { setEditando(c.id); setForm({ estacion_ocm_id: c.estacion_ocm_id, estacion_nombre: c.estacion_nombre || '', puntaje: c.puntaje, comentario: c.comentario || '' }); setMostrar(true); }} />
            <Boton titulo="Eliminar" pequeno variante="danger" onPress={() => void eliminar(c)} />
          </>}
        >
          <Dato etiqueta="Comentario" valor={c.comentario || 'Sin comentario'} />
          <Dato etiqueta="Publicada" valor={fechaHora(c.fecha)} />
        </ItemLista>
      ))}
    </>
  );
}
