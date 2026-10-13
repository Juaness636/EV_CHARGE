// Gestión de estaciones del administrador: crear/editar estaciones propias con sus
// cargadores, editar datos de estaciones de OpenChargeMap, activar/desactivar y eliminar.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  actualizarEstacion, actualizarEstacionOcm, cambiarEstadoEstacion, cambiarEstadoEstacionOcm, crearEstacion,
  eliminarEstacionAdmin, eliminarEstacionOcmAdmin, listarEstacionesOcmAdmin, type AdminEstacionOcm, type EstacionCargadorData,
} from '../../../api/admin.api';
import { useTheme } from '../../../theme/ThemeContext';
import { Radius } from '../../../theme/spacing';
import { etiquetaEstado, TIPOS_CONECTOR } from '../../../utils/estaciones';
import { useCarga } from '../../../utils/useCarga';
import { confirmar, notificar } from '../../../components/Notificaciones';
import { Alerta, Boton, CampoSelect, CampoTexto, Cargando, Chips, Dato, Insignia, ItemLista, Tarjeta, tonoEstado, Vacio } from '../../../components/ui';
import { ejecutarAdmin, type PropsAdmin } from './AdminPaneles';

type EstadoEstacion = 'activa' | 'mantenimiento' | 'inactiva';
type FilaEstacion = Omit<AdminEstacionOcm, 'conectores'> & { descripcion?: string; tipo_conector?: string; potencia_kw?: number; conectores?: Array<AdminEstacionOcm['conectores'][number] & { id?: string }> };

const formularioVacio = { id: '', nombre: '', direccion: '', lat: '', lon: '', tipo_conector: 'CCS', potencia_kw: '', descripcion: '', operador: 'EV Charge', estado: 'activa' as EstadoEstacion };

export function EstacionesAdmin({ version }: PropsAdmin) {
  const { colors } = useTheme();
  const { datos, cargando, error, recargar } = useCarga(listarEstacionesOcmAdmin, [] as AdminEstacionOcm[], [version]);
  const estaciones = datos as FilaEstacion[];
  const [form, setForm] = useState(formularioVacio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoOcm, setEditandoOcm] = useState(false);
  const [cargadores, setCargadores] = useState<EstacionCargadorData[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'todos' | EstadoEstacion>('todos');
  const [guardando, setGuardando] = useState(false);

  const filtradas = estaciones.filter((e) => {
    const texto = `${e.id} ${e.nombre} ${e.operador}`.toLowerCase();
    return (!busqueda || texto.includes(busqueda.toLowerCase())) && (filtro === 'todos' || e.estado === filtro);
  });

  const reiniciar = () => {
    setForm(formularioVacio);
    setEditandoId(null);
    setEditandoOcm(false);
    setCargadores([]);
    setMostrarForm(false);
  };

  const editar = (e: FilaEstacion) => {
    const externa = e.origen === 'OpenChargeMap';
    setEditandoId(String(e.id));
    setEditandoOcm(externa);
    setCargadores(externa ? [] : (e.conectores || []).map((c) => ({ id: c.id ? String(c.id) : undefined, tipo_conector: String(c.tipo || 'CCS'), potencia_kw: Number(c.potencia_kw || 0), corriente: c.corriente || 'No especificada', bahias: Number(c.bahias || 1) })));
    setForm({
      id: String(e.id), nombre: e.nombre || '', direccion: e.direccion || '', lat: String(e.lat ?? ''), lon: String(e.lon ?? ''),
      tipo_conector: e.tipo_conector || e.conectores?.[0]?.tipo || 'CCS', potencia_kw: String(e.potencia_kw ?? e.conectores?.[0]?.potencia_kw ?? ''),
      descripcion: e.descripcion || '', operador: e.operador || 'EV Charge', estado: (e.estado || 'activa') as EstadoEstacion,
    });
    setMostrarForm(true);
  };

  const guardar = async () => {
    const lat = Number(form.lat);
    const lon = Number(form.lon);
    const potencia = Number(form.potencia_kw);
    if (!form.nombre.trim()) return notificar({ tipo: 'warning', titulo: 'Estación', mensaje: 'El nombre es obligatorio.' });
    if (!form.lat || !form.lon || Number.isNaN(lat) || Number.isNaN(lon)) return notificar({ tipo: 'warning', titulo: 'Estación', mensaje: 'Ingresa una latitud y longitud válidas.' });
    if (!editandoOcm && (!form.potencia_kw || Number.isNaN(potencia))) return notificar({ tipo: 'warning', titulo: 'Estación', mensaje: 'Ingresa la potencia en kW.' });
    setGuardando(true);
    try {
      if (editandoId && editandoOcm) {
        await ejecutarAdmin(() => actualizarEstacionOcm(editandoId, { nombre: form.nombre.trim(), direccion: form.direccion.trim(), operador: form.operador.trim(), lat, lon, estado: form.estado }), recargar);
      } else {
        const payload = {
          id: form.id.trim() || undefined,
          nombre: form.nombre.trim(),
          direccion: form.direccion.trim() || undefined,
          lat, lon,
          tipo_conector: form.tipo_conector,
          potencia_kw: potencia,
          descripcion: form.descripcion.trim(),
          operador: form.operador.trim() || 'EV Charge',
          estado: form.estado,
          cargadores: cargadores.filter((c) => c.tipo_conector && Number.isFinite(c.potencia_kw)),
        };
        await ejecutarAdmin(() => (editandoId ? actualizarEstacion(editandoId, payload) : crearEstacion(payload)), recargar, editandoId ? 'Estación actualizada.' : 'Estación creada.');
      }
      reiniciar();
    } finally {
      setGuardando(false);
    }
  };

  const actualizarCargador = (indice: number, cambios: Partial<EstacionCargadorData>) =>
    setCargadores((lista) => lista.map((c, i) => (i === indice ? { ...c, ...cambios } : c)));

  const agregarCargador = () => setCargadores((lista) => lista.length
    ? [...lista, { tipo_conector: 'CCS', potencia_kw: 22, corriente: 'AC', bahias: 1 }]
    : [{ tipo_conector: form.tipo_conector || 'CCS', potencia_kw: Number(form.potencia_kw) || 22, corriente: 'No especificada', bahias: 1 }, { tipo_conector: 'CCS', potencia_kw: 22, corriente: 'AC', bahias: 1 }]);

  const eliminar = async (e: FilaEstacion) => {
    if (!(await confirmar({ titulo: 'Eliminar estación', mensaje: `¿Deseas eliminar ${e.nombre}? Dejará de mostrarse en el mapa.`, confirmarTexto: 'Eliminar' }))) return;
    await ejecutarAdmin(() => (e.origen === 'OpenChargeMap' ? eliminarEstacionOcmAdmin(String(e.id)) : eliminarEstacionAdmin(String(e.id))), recargar, 'Estación eliminada.');
  };

  const alternarEstado = (e: FilaEstacion) => {
    const nuevo: EstadoEstacion = e.estado === 'activa' ? 'inactiva' : 'activa';
    return ejecutarAdmin(() => (e.origen === 'OpenChargeMap' ? cambiarEstadoEstacionOcm(String(e.id), nuevo) : cambiarEstadoEstacion(String(e.id), nuevo)), recargar);
  };

  return (
    <>
      <Boton titulo={mostrarForm ? 'Cerrar formulario' : '+ Crear estación'} variante="soft" onPress={() => (mostrarForm ? reiniciar() : setMostrarForm(true))} style={{ alignSelf: 'flex-start' }} />
      {mostrarForm && (
        <Tarjeta>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>{editandoId ? `Editar estación${editandoOcm ? ' (OpenChargeMap)' : ''}` : 'Nueva estación'}</Text>
          <View style={styles.grid}>
            <View style={styles.celda}><CampoTexto etiqueta="ID de estación" value={form.id} onChangeText={(v) => setForm({ ...form, id: v })} placeholder="Ej. EV-001" editable={!editandoId} /></View>
            <View style={styles.celda}><CampoTexto etiqueta="Nombre" requerido value={form.nombre} onChangeText={(v) => setForm({ ...form, nombre: v })} placeholder="Nombre de la estación" /></View>
            <View style={styles.celda}><CampoTexto etiqueta="Proveedor" value={form.operador} onChangeText={(v) => setForm({ ...form, operador: v })} placeholder="EV Charge" /></View>
            <View style={styles.celda}><CampoTexto etiqueta="Dirección" value={form.direccion} onChangeText={(v) => setForm({ ...form, direccion: v })} placeholder="Cra 123 #45-67" /></View>
            <View style={styles.celda}><CampoTexto etiqueta="Latitud" requerido value={form.lat} onChangeText={(v) => setForm({ ...form, lat: v.replace(/[^\d.-]/g, '') })} keyboardType="numbers-and-punctuation" placeholder="4.711" /></View>
            <View style={styles.celda}><CampoTexto etiqueta="Longitud" requerido value={form.lon} onChangeText={(v) => setForm({ ...form, lon: v.replace(/[^\d.-]/g, '') })} keyboardType="numbers-and-punctuation" placeholder="-74.072" /></View>
            {!editandoOcm && <View style={styles.celda}><CampoSelect etiqueta="Tipo de conector" valor={form.tipo_conector} onChange={(v) => setForm({ ...form, tipo_conector: v })} opciones={TIPOS_CONECTOR.map((t) => ({ valor: t, etiqueta: t }))} /></View>}
            {!editandoOcm && <View style={styles.celda}><CampoTexto etiqueta="Potencia (kW)" requerido value={form.potencia_kw} onChangeText={(v) => setForm({ ...form, potencia_kw: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" placeholder="22" /></View>}
            <View style={styles.celda}><CampoSelect etiqueta="Estado" valor={form.estado} onChange={(v) => setForm({ ...form, estado: v as EstadoEstacion })} opciones={[{ valor: 'activa', etiqueta: 'Activa' }, { valor: 'mantenimiento', etiqueta: 'Mantenimiento' }, { valor: 'inactiva', etiqueta: 'Fuera de servicio' }]} /></View>
          </View>

          {!editandoOcm && (
            <View style={[styles.cargadores, { borderColor: colors.border }]}>
              <View style={styles.filaEntre}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>Cargadores de la estación</Text>
                <Boton titulo="+ Agregar cargador" pequeno variante="outline" onPress={agregarCargador} />
              </View>
              {cargadores.length === 0 && <Text style={{ color: colors.textDim, fontSize: 12.5 }}>Agrega los cargadores disponibles en esta estación.</Text>}
              {cargadores.map((c, i) => (
                <View key={`${c.id || 'nuevo'}-${i}`} style={[styles.cargador, { borderColor: colors.border }]}>
                  <View style={styles.celda}><CampoSelect etiqueta={`Conector ${i + 1}`} valor={c.tipo_conector} onChange={(v) => actualizarCargador(i, { tipo_conector: v })} opciones={TIPOS_CONECTOR.map((t) => ({ valor: t, etiqueta: t }))} /></View>
                  <View style={styles.celdaPequena}><CampoTexto etiqueta="Potencia (kW)" value={String(c.potencia_kw ?? '')} onChangeText={(v) => actualizarCargador(i, { potencia_kw: Number(v.replace(/[^\d.]/g, '')) || 0 })} keyboardType="decimal-pad" /></View>
                  <View style={styles.celdaPequena}><CampoTexto etiqueta="Bahías" value={String(c.bahias ?? 1)} onChangeText={(v) => actualizarCargador(i, { bahias: Number(v.replace(/\D/g, '')) || 1 })} keyboardType="number-pad" /></View>
                  {cargadores.length > 1 && <Boton titulo="Quitar" pequeno variante="danger" onPress={() => setCargadores((l) => l.filter((_, j) => j !== i))} style={{ alignSelf: 'center' }} />}
                </View>
              ))}
            </View>
          )}

          {!editandoOcm && <CampoTexto etiqueta="Descripción" value={form.descripcion} onChangeText={(v) => setForm({ ...form, descripcion: v })} multiline placeholder="Detalles relevantes de la estación" />}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton titulo={editandoId ? 'Guardar cambios' : 'Crear estación'} cargando={guardando} onPress={guardar} />
            <Boton titulo="Cancelar" variante="outline" onPress={reiniciar} />
          </View>
        </Tarjeta>
      )}

      <CampoTexto icono="magnifying-glass" value={busqueda} onChangeText={setBusqueda} placeholder="Buscar estación por ID, nombre o proveedor" />
      <Chips valor={filtro} onChange={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todos' }, { valor: 'activa', etiqueta: 'Activas' }, { valor: 'mantenimiento', etiqueta: 'Mantenimiento' }, { valor: 'inactiva', etiqueta: 'Fuera de servicio' }]} />
      <Text style={{ color: colors.textDim, fontSize: 12.5 }}>{filtradas.length} estaciones</Text>

      {error ? <Alerta texto={error} /> : null}
      {cargando && !estaciones.length ? <Cargando /> : filtradas.length === 0 ? <Vacio texto="No hay estaciones para este filtro." icono="charging-station" /> : filtradas.slice(0, 200).map((e) => {
        const externa = e.origen === 'OpenChargeMap';
        return (
          <ItemLista
            key={`${externa ? 'ocm' : 'propia'}-${e.id}`}
            titulo={e.nombre}
            insignia={<Insignia texto={etiquetaEstado(e.estado)} tono={tonoEstado(e.estado)} />}
            acciones={<>
              <Boton titulo="Editar" pequeno variante="outline" onPress={() => editar(e)} />
              <Boton titulo={e.estado === 'activa' ? 'Fuera de servicio' : 'Activar'} pequeno variante={e.estado === 'activa' ? 'outline' : 'soft'} onPress={() => void alternarEstado(e)} />
              <Boton titulo="Eliminar" pequeno variante="danger" onPress={() => void eliminar(e)} />
            </>}
          >
            <Dato etiqueta="ID" valor={String(e.id)} />
            <Dato etiqueta="Origen" valor={externa ? 'OpenChargeMap' : 'EV Charge'} />
            <Dato etiqueta="Proveedor" valor={e.operador || '—'} />
            {e.direccion ? <Dato etiqueta="Dirección" valor={e.direccion} /> : null}
            {e.conectores?.length ? <Dato etiqueta="Conectores" valor={e.conectores.map((c) => `${c.tipo}${c.potencia_kw ? ` ${c.potencia_kw} kW` : ''}`).join(', ')} /> : null}
          </ItemLista>
        );
      })}
      {filtradas.length > 200 && <Text style={{ color: colors.textDim, textAlign: 'center' }}>Mostrando 200 de {filtradas.length}. Usa la búsqueda para encontrar otras estaciones.</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  celda: { flexGrow: 1, flexBasis: 220 },
  celdaPequena: { flexGrow: 1, flexBasis: 110 },
  cargadores: { borderWidth: 1, borderRadius: Radius.md, padding: 12, gap: 10, marginBottom: 12 },
  cargador: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, borderTopWidth: 1, paddingTop: 10 },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
