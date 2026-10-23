// Paneles de gestión: Vehículos (CRUD + activar) y métodos de pago (CRUD).
import React, { useState } from 'react';
import { View } from 'react-native';
import { actualizarVehiculo, crearVehiculo, eliminarVehiculo, listarVehiculos, type Vehiculo } from '../../../api/vehiculos.api';
import { actualizarMetodoPago, crearMetodoPago, eliminarMetodoPago, listarMetodosPago, type MetodoPago, type MetodoPagoCreate } from '../../../api/metodosPago.api';
import { mensajeError } from '../../../api/httpClient';
import { TIPOS_CONECTOR } from '../../../utils/estaciones';
import { fechaCorta } from '../../../utils/formato';
import { useCarga } from '../../../utils/useCarga';
import { MetodoPagoForm } from '../../../components/MetodoPagoForm';
import { confirmar, notificar } from '../../../components/Notificaciones';
import { Alerta, Boton, CampoSelect, CampoTexto, Cargando, Dato, Insignia, ItemLista, Tarjeta, Vacio } from '../../../components/ui';
import type { PropsPanel } from '../tipos';

const formularioVacio = { marca: '', modelo: '', anio: '', autonomia_km: '', tipo_conector: 'CCS' };

export function VehiculosPanel({ version }: PropsPanel) {
  const { datos: vehiculos, cargando, error, recargar } = useCarga(listarVehiculos, [] as Vehiculo[], [version]);
  const [mostrar, setMostrar] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(formularioVacio);
    setMostrar((v) => !v || editando !== null);
  };

  const editar = (v: Vehiculo) => {
    setEditando(v.id);
    setForm({ marca: v.marca, modelo: v.modelo, anio: v.anio?.toString() || '', autonomia_km: v.autonomia_km?.toString() || '', tipo_conector: v.tipo_conector });
    setMostrar(true);
  };

  const guardar = async () => {
    if (!form.marca.trim() || !form.modelo.trim()) return notificar({ tipo: 'warning', titulo: 'Vehículo', mensaje: 'La marca y el modelo son obligatorios.' });
    const anio = form.anio ? Number(form.anio) : undefined;
    if (anio !== undefined && (anio < 1990 || anio > new Date().getFullYear() + 1)) return notificar({ tipo: 'warning', titulo: 'Vehículo', mensaje: 'Ingresa un año válido.' });
    setGuardando(true);
    try {
      const payload = { marca: form.marca.trim(), modelo: form.modelo.trim(), tipo_conector: form.tipo_conector, anio, autonomia_km: form.autonomia_km ? Number(form.autonomia_km) : undefined };
      if (editando) await actualizarVehiculo(editando, payload);
      else await crearVehiculo(payload);
      notificar({ tipo: 'success', titulo: 'Operación completada', mensaje: editando ? 'Vehículo actualizado correctamente.' : 'Vehículo registrado correctamente.' });
      setMostrar(false);
      setEditando(null);
      setForm(formularioVacio);
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Vehículo', mensaje: mensajeError(e) });
    } finally {
      setGuardando(false);
    }
  };

  const ejecutar = async (accion: () => Promise<unknown>, exito: string) => {
    try {
      await accion();
      notificar({ tipo: 'success', titulo: 'Operación completada', mensaje: exito });
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Vehículo', mensaje: mensajeError(e) });
    }
  };

  const eliminar = async (v: Vehiculo) => {
    if (!(await confirmar({ titulo: 'Eliminar vehículo', mensaje: `¿Deseas eliminar ${v.marca} ${v.modelo}? Esta acción quedará registrada en tus notificaciones.`, confirmarTexto: 'Eliminar' }))) return;
    await ejecutar(() => eliminarVehiculo(v.id), 'Vehículo eliminado correctamente.');
  };

  return (
    <>
      <Boton titulo={mostrar && !editando ? 'Cerrar formulario' : '+ Agregar vehículo'} variante="soft" onPress={abrirNuevo} style={{ alignSelf: 'flex-start' }} />
      {mostrar && (
        <Tarjeta>
          <CampoTexto etiqueta="Marca" requerido value={form.marca} onChangeText={(v) => setForm({ ...form, marca: v })} placeholder="Ej. Renault" />
          <CampoTexto etiqueta="Modelo" requerido value={form.modelo} onChangeText={(v) => setForm({ ...form, modelo: v })} placeholder="Ej. Zoe" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><CampoTexto etiqueta="Año" value={form.anio} onChangeText={(v) => setForm({ ...form, anio: v.replace(/\D/g, '').slice(0, 4) })} keyboardType="number-pad" placeholder="2024" /></View>
            <View style={{ flex: 1 }}><CampoTexto etiqueta="Autonomía (km)" value={form.autonomia_km} onChangeText={(v) => setForm({ ...form, autonomia_km: v.replace(/\D/g, '') })} keyboardType="number-pad" placeholder="300" /></View>
          </View>
          <CampoSelect etiqueta="Conector" valor={form.tipo_conector} onChange={(v) => setForm({ ...form, tipo_conector: v })} opciones={TIPOS_CONECTOR.map((t) => ({ valor: t, etiqueta: t }))} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton titulo={editando ? 'Guardar cambios' : 'Guardar'} cargando={guardando} onPress={guardar} />
            <Boton titulo="Cancelar" variante="outline" onPress={() => { setMostrar(false); setEditando(null); }} />
          </View>
        </Tarjeta>
      )}
      {error ? <Alerta texto={error} /> : null}
      {cargando && !vehiculos.length ? <Cargando /> : vehiculos.length === 0 ? <Vacio texto="No tienes vehículos registrados." icono="car" /> : vehiculos.map((v) => (
        <ItemLista
          key={v.id}
          titulo={`${v.marca} ${v.modelo}`}
          insignia={<Insignia texto={v.activo ? 'Activo' : 'Inactivo'} tono={v.activo ? 'verde' : 'rojo'} />}
          acciones={<>
            {!v.activo && <Boton titulo="Activar" pequeno variante="soft" onPress={() => void ejecutar(() => actualizarVehiculo(v.id, { activo: true }), 'Vehículo activado.')} />}
            <Boton titulo="Editar" pequeno variante="outline" onPress={() => editar(v)} />
            <Boton titulo="Eliminar" pequeno variante="danger" onPress={() => void eliminar(v)} />
          </>}
        >
          <Dato etiqueta="Conector" valor={v.tipo_conector} />
          {v.autonomia_km ? <Dato etiqueta="Autonomía" valor={`${v.autonomia_km} km`} /> : null}
          {v.anio ? <Dato etiqueta="Año" valor={v.anio} /> : null}
        </ItemLista>
      ))}
    </>
  );
}

export function PagosPanel({ version }: PropsPanel) {
  const { datos: pagos, cargando, error, recargar } = useCarga(listarMetodosPago, [] as MetodoPago[], [version]);
  const [mostrar, setMostrar] = useState(false);
  const [editando, setEditando] = useState<MetodoPago | null>(null);

  const guardar = async (payload: MetodoPagoCreate) => {
    try {
      if (editando) await actualizarMetodoPago(editando.id, payload);
      else await crearMetodoPago({ ...payload, estado: true });
      notificar({ tipo: 'success', titulo: 'Operación completada', mensaje: editando ? 'Método de pago actualizado correctamente.' : 'Método de pago agregado correctamente.' });
      setMostrar(false);
      setEditando(null);
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Métodos de pago', mensaje: mensajeError(e) });
    }
  };

  const eliminar = async (p: MetodoPago) => {
    if (!(await confirmar({ titulo: 'Eliminar método de pago', mensaje: `¿Deseas eliminar ${p.tipo} terminado en ${p.numero.slice(-4)}?`, confirmarTexto: 'Eliminar' }))) return;
    try {
      await eliminarMetodoPago(p.id);
      notificar({ tipo: 'success', titulo: 'Operación completada', mensaje: 'Método de pago eliminado.' });
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Métodos de pago', mensaje: mensajeError(e) });
    }
  };

  return (
    <>
      <Boton titulo={mostrar && !editando ? 'Cerrar formulario' : '+ Agregar método'} variante="soft" onPress={() => { setEditando(null); setMostrar((v) => !v || editando !== null); }} style={{ alignSelf: 'flex-start' }} />
      {mostrar && (
        <Tarjeta>
          <MetodoPagoForm
            initial={editando}
            submitLabel={editando ? 'Actualizar método' : 'Guardar método'}
            onSubmit={guardar}
            onCancel={() => { setMostrar(false); setEditando(null); }}
          />
        </Tarjeta>
      )}
      {error ? <Alerta texto={error} /> : null}
      {cargando && !pagos.length ? <Cargando /> : pagos.length === 0 ? <Vacio texto="No tienes métodos de pago registrados." icono="credit-card" /> : pagos.map((p) => (
        <ItemLista
          key={p.id}
          titulo={p.tipo}
          insignia={<Insignia texto={p.estado ? 'Activo' : 'Inactivo'} tono={p.estado ? 'verde' : 'rojo'} />}
          acciones={<>
            <Boton titulo="Editar" pequeno variante="outline" onPress={() => { setEditando(p); setMostrar(true); }} />
            <Boton titulo="Eliminar" pequeno variante="danger" onPress={() => void eliminar(p)} />
          </>}
        >
          <Dato etiqueta="Termina en" valor={p.numero.slice(-4)} />
          <Dato etiqueta="Registrado" valor={fechaCorta(p.created_at)} />
        </ItemLista>
      ))}
    </>
  );
}
